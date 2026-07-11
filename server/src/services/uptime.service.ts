import type { Pool } from 'pg';

export async function computeUptimeStats(pool: Pool, websiteId: string) {
  const windowStats = async (hours: number) => {
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE value_ms >= 0) AS up_count,
         COUNT(*) AS total_count
       FROM response_time_checks
       WHERE website_id = $1 AND "timestamp" > now() - ($2 || ' hours')::interval`,
      [websiteId, hours]
    );
    const { up_count, total_count } = result.rows[0];
    const total = Number(total_count);
    if (total === 0) return 100;
    return (Number(up_count) / total) * 100;
  };

  const [uptime24h, uptime30d] = await Promise.all([windowStats(24), windowStats(24 * 30)]);

  const latestResult = await pool.query(
    `SELECT value_ms FROM response_time_checks WHERE website_id = $1 ORDER BY "timestamp" DESC, id DESC LIMIT 1`,
    [websiteId]
  );
  const latestResponseTime = latestResult.rows[0]?.value_ms ?? 0;

  const historyResult = await pool.query(
    `SELECT "timestamp", value_ms FROM response_time_checks WHERE website_id = $1
     ORDER BY "timestamp" DESC, id DESC LIMIT 24`,
    [websiteId]
  );
  const history = historyResult.rows
    .reverse()
    .map((row) => ({
      timestamp: new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: row.value_ms,
    }));

  return { uptime24h, uptime30d, latestResponseTime, history };
}
