import nodemailer from 'nodemailer';
import type { ReportSummary } from './report.service.js';
import { incidentCreatedEmail, incidentResolvedEmail, testEmail, reportEmail } from './emailTemplates.js';

interface IncidentEmailParams {
  to: string;
  websiteName: string;
  kind: 'created' | 'resolved';
  severity?: string;
  description?: string;
}

function getTransport() {
  const port = Number(process.env.SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // Port 465 is implicit TLS (must set secure:true) — 587/others use STARTTLS,
    // which nodemailer negotiates automatically when secure is false.
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

export async function sendIncidentEmail(params: IncidentEmailParams): Promise<void> {
  if (!process.env.SMTP_HOST) {
    console.warn('SMTP_HOST not configured — skipping incident email.');
    return;
  }

  const transport = getTransport();
  const { subject, html, text } =
    params.kind === 'created'
      ? incidentCreatedEmail(params.websiteName, params.severity ?? 'warning', params.description ?? '')
      : incidentResolvedEmail(params.websiteName);

  await transport.sendMail({
    from: process.env.SMTP_FROM || 'alerts@monitorpro.io',
    to: params.to,
    subject,
    text,
    html,
  });
}

export async function sendTestEmail(to: string): Promise<void> {
  const transport = getTransport();
  const { subject, html, text } = testEmail();
  await transport.sendMail({
    from: process.env.SMTP_FROM || 'alerts@monitorpro.io',
    to,
    subject,
    text,
    html,
  });
}

export async function sendReportEmail(to: string, frequency: 'weekly' | 'monthly', summary: ReportSummary): Promise<void> {
  if (!process.env.SMTP_HOST) {
    console.warn('SMTP_HOST not configured — skipping scheduled report email.');
    return;
  }

  const transport = getTransport();
  const { subject, html, text } = reportEmail(frequency, summary);

  await transport.sendMail({
    from: process.env.SMTP_FROM || 'alerts@monitorpro.io',
    to,
    subject,
    text,
    html,
  });
}
