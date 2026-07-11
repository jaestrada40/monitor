import cron from 'node-cron';
import type { Pool } from 'pg';
import { checkWebsite } from './monitor.service.js';

export function startScheduler(pool: Pool) {
  cron.schedule('* * * * *', async () => {
    const due = await pool.query(
      `SELECT w.id, w.url, w.status, w.check_interval, w.last_checked, n.threshold_response_time
       FROM websites w
       JOIN notification_settings n ON n.user_id = w.user_id
       WHERE w.status != 'maintenance'
         AND (w.last_checked IS NULL OR w.last_checked < now() - (w.check_interval || ' seconds')::interval)`
    );

    for (const row of due.rows) {
      try {
        await checkWebsite(pool, {
          id: row.id,
          url: row.url,
          status: row.status,
          thresholdResponseTime: row.threshold_response_time,
        });
      } catch (err) {
        console.error(`Monitoring check failed for website ${row.id}:`, err);
      }
    }
  });
}
