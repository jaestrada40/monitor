import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isScheduleDue } from './reportScheduler.js';

describe('isScheduleDue', () => {
  const now = new Date('2026-01-15T00:00:00Z');

  it('is due immediately if never sent before', () => {
    expect(isScheduleDue('weekly', null, now)).toBe(true);
  });

  it('is not due if less than 7 days elapsed for a weekly schedule', () => {
    const lastSentAt = new Date('2026-01-10T00:00:00Z');
    expect(isScheduleDue('weekly', lastSentAt, now)).toBe(false);
  });

  it('is due once 7+ days elapsed for a weekly schedule', () => {
    const lastSentAt = new Date('2026-01-08T00:00:00Z');
    expect(isScheduleDue('weekly', lastSentAt, now)).toBe(true);
  });

  it('is not due if less than 30 days elapsed for a monthly schedule', () => {
    const lastSentAt = new Date('2026-01-01T00:00:00Z');
    expect(isScheduleDue('monthly', lastSentAt, now)).toBe(false);
  });

  it('returns false for an unrecognized frequency', () => {
    expect(isScheduleDue('daily', null, now)).toBe(false);
  });
});

describe('runDueScheduledReports', () => {
  const queryMock = vi.fn();
  const pool = { query: queryMock } as any;

  beforeEach(() => {
    queryMock.mockReset();
  });

  it('sends a report and stamps last_sent_at only for due, enabled schedules', async () => {
    vi.resetModules();
    vi.doMock('./report.service.js', () => ({
      computeReportSummary: vi.fn().mockResolvedValue({
        slaPercentage: 100,
        mttrMinutes: 5,
        resolvedCount: 1,
        totalCount: 1,
        perSiteUptime: [],
      }),
    }));
    const sendReportEmailMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock('./email.service.js', () => ({ sendReportEmail: sendReportEmailMock }));

    const { runDueScheduledReports } = await import('./reportScheduler.js');

    queryMock.mockResolvedValueOnce({
      rows: [
        { id: 'sched-1', user_id: 'user-1', frequency: 'weekly', recipient_email: 'due@example.com', last_sent_at: null },
        {
          id: 'sched-2',
          user_id: 'user-2',
          frequency: 'weekly',
          recipient_email: 'not-due@example.com',
          last_sent_at: new Date().toISOString(),
        },
      ],
    });
    queryMock.mockResolvedValue({ rows: [] });

    await runDueScheduledReports(pool, new Date());

    expect(sendReportEmailMock).toHaveBeenCalledTimes(1);
    expect(sendReportEmailMock).toHaveBeenCalledWith('due@example.com', 'weekly', expect.any(Object));

    const updateCall = queryMock.mock.calls.find((c) => String(c[0]).includes('UPDATE scheduled_reports'));
    expect(updateCall?.[1]).toEqual(['sched-1']);

    vi.doUnmock('./report.service.js');
    vi.doUnmock('./email.service.js');
  });
});
