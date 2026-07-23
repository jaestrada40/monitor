import type { Pool } from 'pg';

export interface ReportSummary {
  slaPercentage: number;
  mttrMinutes: number | null;
  resolvedCount: number;
  totalCount: number;
  perSiteUptime: { id: string; name: string; uptime: number }[];
}

export function computeMttrMinutes(resolved: { createdAt: Date; resolvedAt: Date }[]): number | null {
  if (resolved.length === 0) return null;
  const totalMs = resolved.reduce((sum, r) => sum + (r.resolvedAt.getTime() - r.createdAt.getTime()), 0);
  return Math.round(totalMs / resolved.length / 60000);
}

export function computeSlaPercentage(perSiteUptime: { uptime: number }[]): number {
  if (perSiteUptime.length === 0) return 0;
  const compliant = perSiteUptime.filter((s) => s.uptime >= 99.9).length;
  return Math.round((compliant / perSiteUptime.length) * 100);
}

export async function computeReportSummary(pool: Pool, userId: string, days: number): Promise<ReportSummary> {
  // A protected site cannot be verified through Cloudflare, so including its historical
  // false failures would distort SLA reports. It returns to reports automatically once a
  // real content check succeeds and its status changes back to up/degraded/down.
  const sites = await pool.query("SELECT id, name FROM websites WHERE user_id = $1 AND status != 'protected'", [userId]);

  const perSiteUptime = await Promise.all(
    sites.rows.map(async (site) => {
      const r = await pool.query(
        `SELECT COUNT(*) FILTER (WHERE value_ms >= 0) AS up_count, COUNT(*) AS total_count
         FROM response_time_checks
         WHERE website_id = $1 AND "timestamp" > now() - ($2 || ' days')::interval`,
        [site.id, days]
      );
      const { up_count, total_count } = r.rows[0];
      const total = Number(total_count);
      const uptime = total === 0 ? 100 : (Number(up_count) / total) * 100;
      return { id: site.id, name: site.name, uptime: Number(uptime.toFixed(2)) };
    })
  );

  const incidentsResult = await pool.query(
    `SELECT i.status, i.created_at, i.resolved_at
     FROM incidents i JOIN websites w ON w.id = i.website_id
     WHERE w.user_id = $1 AND i.created_at > now() - ($2 || ' days')::interval`,
    [userId, days]
  );
  const totalCount = incidentsResult.rows.length;
  const resolvedRows = incidentsResult.rows.filter((r) => r.status === 'resolved' && r.resolved_at);
  const resolvedCount = resolvedRows.length;
  const mttrMinutes = computeMttrMinutes(
    resolvedRows.map((r) => ({ createdAt: new Date(r.created_at), resolvedAt: new Date(r.resolved_at) }))
  );

  return {
    slaPercentage: computeSlaPercentage(perSiteUptime),
    mttrMinutes,
    resolvedCount,
    totalCount,
    perSiteUptime,
  };
}
