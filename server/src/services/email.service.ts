import nodemailer from 'nodemailer';

interface IncidentEmailParams {
  to: string;
  websiteName: string;
  kind: 'created' | 'resolved';
  severity?: string;
  description?: string;
}

export async function sendIncidentEmail(params: IncidentEmailParams): Promise<void> {
  if (!process.env.SMTP_HOST) {
    console.warn('SMTP_HOST not configured — skipping incident email.');
    return;
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });

  const subject =
    params.kind === 'created'
      ? `[MonitorPro] Incidente en ${params.websiteName}`
      : `[MonitorPro] Resuelto: ${params.websiteName}`;

  const text =
    params.kind === 'created'
      ? `Se detectó un incidente ${params.severity ?? ''} en ${params.websiteName}.\n\n${params.description ?? ''}`
      : `El sitio ${params.websiteName} volvió a funcionar con normalidad.`;

  await transport.sendMail({
    from: process.env.SMTP_FROM || 'alerts@monitorpro.io',
    to: params.to,
    subject,
    text,
  });
}
