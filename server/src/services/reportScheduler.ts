import cron from 'node-cron';
import type { Pool } from 'pg';
import { computeReportSummary } from './report.service.js';
import { sendReportEmail } from './email.service.js';

const FREQUENCY_DAYS: Record<string, number> = { weekly: 7, monthly: 30 };

export function isScheduleDue(frequency: string, lastSentAt: Date | null, now: Date): boolean {
  const days = FREQUENCY_DAYS[frequency];
  if (!days) return false;
  if (!lastSentAt) return true;
  const elapsedMs = now.getTime() - lastSentAt.getTime();
  return elapsedMs >= days * 24 * 60 * 60 * 1000;
}

export async function runDueScheduledReports(pool: Pool, now: Date = new Date()): Promise<void> {
  const due = await pool.query(
    `SELECT id, user_id, frequency, recipient_email, last_sent_at
     FROM scheduled_reports WHERE enabled = true AND recipient_email != ''`
  );

  for (const row of due.rows) {
    if (!isScheduleDue(row.frequency, row.last_sent_at ? new Date(row.last_sent_at) : null, now)) continue;
    try {
      const days = FREQUENCY_DAYS[row.frequency] ?? 30;
      const summary = await computeReportSummary(pool, row.user_id, days);
      await sendReportEmail(row.recipient_email, row.frequency, summary);
      await pool.query('UPDATE scheduled_reports SET last_sent_at = now() WHERE id = $1', [row.id]);
    } catch (err) {
      console.error(`Scheduled report failed for user ${row.user_id}:`, err);
    }
  }
}

// Checked hourly — cheap query, and isScheduleDue only fires once the frequency window has
// actually elapsed, so this doesn't spam emails even at this check granularity.
export function startReportScheduler(pool: Pool) {
  cron.schedule('0 * * * *', () => {
    runDueScheduledReports(pool).catch((err) => console.error('Report scheduler tick failed:', err));
  });
}
