export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const COLORS = {
  critical: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', dot: '#ef4444' },
  warning: { bg: '#fffbeb', border: '#fde68a', text: '#b45309', dot: '#f59e0b' },
  success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857', dot: '#10b981' },
  neutral: { bg: '#f8fafc', border: '#e2e8f0', text: '#475569', dot: '#94a3b8' },
};

function shell(preheader: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background-color:#0f172a;padding:20px 28px;">
                <span style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:-0.02em;">MonitorPro</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
                <span style="color:#94a3b8;font-size:11px;">Este correo fue generado automáticamente por MonitorPro. No respondas a este mensaje.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function badge(label: string, tone: keyof typeof COLORS): string {
  const c = COLORS[tone];
  return `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background-color:${c.bg};border:1px solid ${c.border};color:${c.text};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.02em;">${escapeHtml(label)}</span>`;
}

export function incidentCreatedEmail(websiteName: string, severity: string, description: string): { subject: string; html: string; text: string } {
  const tone = severity === 'critical' ? 'critical' : 'warning';
  const c = COLORS[tone];
  const subject = `[MonitorPro] Incidente en ${websiteName}`;
  const html = shell(
    `Nuevo incidente ${severity} en ${websiteName}`,
    `
    <div style="margin-bottom:16px;">${badge(severity === 'critical' ? 'Crítico' : 'Advertencia', tone)}</div>
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Incidente detectado</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;">Se detectó un problema en <strong style="color:#0f172a;">${escapeHtml(websiteName)}</strong>.</p>
    <div style="padding:14px 16px;background-color:${c.bg};border:1px solid ${c.border};border-radius:8px;margin-bottom:8px;">
      <p style="margin:0;font-size:13px;color:${c.text};line-height:1.5;">${escapeHtml(description)}</p>
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">${new Date().toLocaleString()}</p>
    `
  );
  const text = `Se detectó un incidente ${severity} en ${websiteName}.\n\n${description}`;
  return { subject, html, text };
}

export function incidentResolvedEmail(websiteName: string): { subject: string; html: string; text: string } {
  const c = COLORS.success;
  const subject = `[MonitorPro] Resuelto: ${websiteName}`;
  const html = shell(
    `${websiteName} volvió a funcionar con normalidad`,
    `
    <div style="margin-bottom:16px;">${badge('Resuelto', 'success')}</div>
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Sitio recuperado</h1>
    <p style="margin:0;font-size:14px;color:#475569;">
      <strong style="color:#0f172a;">${escapeHtml(websiteName)}</strong> volvió a funcionar con normalidad.
    </p>
    <div style="padding:14px 16px;background-color:${c.bg};border:1px solid ${c.border};border-radius:8px;margin-top:16px;">
      <p style="margin:0;font-size:13px;color:${c.text};">✓ Monitoreo confirmó una respuesta correcta.</p>
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">${new Date().toLocaleString()}</p>
    `
  );
  const text = `El sitio ${websiteName} volvió a funcionar con normalidad.`;
  return { subject, html, text };
}

export function sslExpiryEmail(
  websiteName: string,
  status: 'expiring' | 'expired',
  daysLeft: number
): { subject: string; html: string; text: string } {
  const tone = status === 'expired' ? 'critical' : 'warning';
  const c = COLORS[tone];
  const subject = status === 'expired'
    ? `[MonitorPro] Certificado SSL expirado en ${websiteName}`
    : `[MonitorPro] Certificado SSL por vencer en ${websiteName}`;

  const message = status === 'expired'
    ? `El certificado SSL de ${websiteName} ya expiró hace ${Math.abs(daysLeft)} día${Math.abs(daysLeft) === 1 ? '' : 's'}. Los visitantes verán una advertencia de seguridad en su navegador.`
    : `El certificado SSL de ${websiteName} vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}. Renuévalo antes de que expire para evitar interrupciones.`;

  const html = shell(
    message,
    `
    <div style="margin-bottom:16px;">${badge(status === 'expired' ? 'SSL Expirado' : 'SSL por Vencer', tone)}</div>
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">${escapeHtml(websiteName)}</h1>
    <div style="padding:14px 16px;background-color:${c.bg};border:1px solid ${c.border};border-radius:8px;">
      <p style="margin:0;font-size:13px;color:${c.text};line-height:1.5;">${escapeHtml(message)}</p>
    </div>
    `
  );
  const text = message;
  return { subject, html, text };
}

export function passwordResetEmail(username: string, resetUrl: string): { subject: string; html: string; text: string } {
  const subject = '[MonitorPro] Restablecer tu contraseña';
  const html = shell(
    'Solicitud para restablecer tu contraseña',
    `
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Restablecer contraseña</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.5;">
      Hola ${escapeHtml(username)}, recibimos una solicitud para restablecer tu contraseña de MonitorPro.
      Este enlace es válido por 1 hora. Si no fuiste tú, puedes ignorar este correo.
    </p>
    <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:700;">Restablecer contraseña</a>
    <p style="margin:20px 0 0;font-size:11px;color:#94a3b8;word-break:break-all;">${escapeHtml(resetUrl)}</p>
    `
  );
  const text = `Recibimos una solicitud para restablecer tu contraseña de MonitorPro. Este enlace es válido por 1 hora:\n\n${resetUrl}\n\nSi no fuiste tú, puedes ignorar este correo.`;
  return { subject, html, text };
}

export function welcomeEmail(
  username: string,
  email: string,
  temporaryPassword: string,
  loginUrl: string
): { subject: string; html: string; text: string } {
  const subject = '[MonitorPro] Te invitaron a un workspace';
  const html = shell(
    `Tu cuenta de MonitorPro está lista`,
    `
    <div style="margin-bottom:16px;">${badge('Invitación', 'success')}</div>
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">¡Bienvenido, ${escapeHtml(username)}!</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.5;">
      Se creó una cuenta para ti en MonitorPro. Usa estas credenciales para iniciar sesión y te recomendamos
      cambiar la contraseña luego de tu primer acceso.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="padding:14px 16px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px 8px 0 0;border-bottom:none;">
          <span style="display:block;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Correo</span>
          <span style="display:block;font-size:14px;font-weight:600;color:#0f172a;margin-top:2px;">${escapeHtml(email)}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 16px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:0 0 8px 8px;">
          <span style="display:block;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Contraseña temporal</span>
          <span style="display:block;font-size:14px;font-weight:700;color:#0f172a;margin-top:2px;font-family:monospace;">${escapeHtml(temporaryPassword)}</span>
        </td>
      </tr>
    </table>
    <a href="${loginUrl}" style="display:inline-block;padding:10px 20px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:700;">Iniciar sesión</a>
    `
  );
  const text = `Se creó una cuenta para ti en MonitorPro.\n\nCorreo: ${email}\nContraseña temporal: ${temporaryPassword}\n\nInicia sesión en: ${loginUrl}`;
  return { subject, html, text };
}

export function welcomeActivationEmail(
  username: string,
  email: string,
  activationUrl: string
): { subject: string; html: string; text: string } {
  const subject = '[MonitorPro] Te invitaron a un workspace';
  const html = shell(
    `Tu cuenta de MonitorPro está lista`,
    `
    <div style="margin-bottom:16px;">${badge('Invitación', 'success')}</div>
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">¡Bienvenido, ${escapeHtml(username)}!</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.5;">
      Se creó una cuenta para ti en MonitorPro (${escapeHtml(email)}). Este enlace es válido por 1 hora
      y te permite elegir tu propia contraseña para activar la cuenta.
    </p>
    <a href="${activationUrl}" style="display:inline-block;padding:10px 20px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:700;">Activar mi cuenta</a>
    <p style="margin:20px 0 0;font-size:11px;color:#94a3b8;word-break:break-all;">${escapeHtml(activationUrl)}</p>
    `
  );
  const text = `Se creó una cuenta para ti en MonitorPro (${email}).\n\nActiva tu cuenta y elige tu contraseña aquí (válido por 1 hora):\n\n${activationUrl}`;
  return { subject, html, text };
}

export function testEmail(): { subject: string; html: string; text: string } {
  const subject = '[MonitorPro] Correo de prueba';
  const html = shell(
    'Tu canal de alertas por email está configurado correctamente',
    `
    <div style="margin-bottom:16px;">${badge('Prueba', 'success')}</div>
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">¡Todo listo!</h1>
    <p style="margin:0;font-size:14px;color:#475569;line-height:1.5;">
      Este es un correo de prueba de MonitorPro. Si lo recibiste, tu canal de alertas por email está configurado correctamente
      y recibirás avisos reales cuando se detecte o resuelva un incidente.
    </p>
    `
  );
  const text = 'Este es un correo de prueba de MonitorPro. Si lo recibiste, tu canal de alertas por email está configurado correctamente.';
  return { subject, html, text };
}

export function reportEmail(
  frequency: 'weekly' | 'monthly',
  summary: {
    slaPercentage: number;
    mttrMinutes: number | null;
    resolvedCount: number;
    totalCount: number;
    perSiteUptime: { id: string; name: string; uptime: number }[];
  }
): { subject: string; html: string; text: string } {
  const periodLabel = frequency === 'weekly' ? 'los últimos 7 días' : 'los últimos 30 días';
  const subject = `[MonitorPro] Reporte ${frequency === 'weekly' ? 'semanal' : 'mensual'}`;

  const statCell = (label: string, value: string) => `
    <td style="padding:12px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;" width="33%">
      <span style="display:block;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.03em;">${label}</span>
      <span style="display:block;font-size:18px;font-weight:700;color:#0f172a;margin-top:4px;">${value}</span>
    </td>`;

  const siteRows = summary.perSiteUptime
    .map((s) => {
      const complies = s.uptime >= 99.9;
      const c = complies ? COLORS.success : COLORS.critical;
      return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:600;">${escapeHtml(s.name)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;">
          <span style="font-size:13px;font-weight:700;color:${c.text};">${s.uptime}%</span>
        </td>
      </tr>`;
    })
    .join('');

  const html = shell(
    `Reporte ${frequency === 'weekly' ? 'semanal' : 'mensual'} — SLA ${summary.slaPercentage}%`,
    `
    <h1 style="margin:0 0 4px;font-size:20px;color:#0f172a;">Reporte ${frequency === 'weekly' ? 'semanal' : 'mensual'}</h1>
    <p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">${periodLabel}</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="8" style="margin-bottom:20px;">
      <tr>
        ${statCell('SLA cumplido', `${summary.slaPercentage}%`)}
        ${statCell('MTTR', summary.mttrMinutes !== null ? `${summary.mttrMinutes}m` : '—')}
        ${statCell('Resueltos', `${summary.resolvedCount}/${summary.totalCount}`)}
      </tr>
    </table>

    <h2 style="margin:0 0 8px;font-size:13px;color:#0f172a;text-transform:uppercase;letter-spacing:0.03em;">Disponibilidad por sitio</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${siteRows || '<tr><td style="padding:10px 0;font-size:13px;color:#94a3b8;">Sin sitios monitoreados.</td></tr>'}
    </table>
    `
  );

  const siteLines = summary.perSiteUptime.map((s) => `  - ${s.name}: ${s.uptime}% uptime`).join('\n');
  const text = [
    `Reporte de MonitorPro — ${periodLabel}`,
    '',
    `SLA cumplido: ${summary.slaPercentage}% de los sitios`,
    `Incidentes: ${summary.resolvedCount}/${summary.totalCount} resueltos`,
    summary.mttrMinutes !== null ? `Tiempo medio de resolución (MTTR): ${summary.mttrMinutes} minutos` : 'Tiempo medio de resolución (MTTR): sin datos suficientes',
    '',
    'Disponibilidad por sitio:',
    siteLines || '  (sin sitios monitoreados)',
  ].join('\n');

  return { subject, html, text };
}
