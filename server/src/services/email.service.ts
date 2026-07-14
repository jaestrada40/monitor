import nodemailer from 'nodemailer';
import type { ReportSummary } from './report.service.js';
import { incidentCreatedEmail, incidentResolvedEmail, testEmail, reportEmail, welcomeActivationEmail, passwordResetEmail, sslExpiryEmail } from './emailTemplates.js';

interface IncidentEmailParams {
  to: string | string[];
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

export async function sendSslExpiryEmail(
  to: string | string[],
  websiteName: string,
  status: 'expiring' | 'expired',
  daysLeft: number
): Promise<void> {
  if (!process.env.SMTP_HOST) {
    console.warn('SMTP_HOST not configured — skipping SSL expiry email.');
    return;
  }

  const transport = getTransport();
  const { subject, html, text } = sslExpiryEmail(websiteName, status, daysLeft);

  await transport.sendMail({
    from: process.env.SMTP_FROM || 'alerts@monitorpro.io',
    to,
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

// Returns whether the email was actually sent, so callers can fall back to surfacing the
// raw activation link directly (e.g. SMTP not configured in this environment) — never a
// password, since the account has no usable password until this link is redeemed.
export async function sendWelcomeActivationEmail(to: string, username: string, rawToken: string): Promise<boolean> {
  if (!process.env.SMTP_HOST) {
    console.warn('SMTP_HOST not configured — skipping welcome email.');
    return false;
  }

  const transport = getTransport();
  const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
  const activationUrl = `${frontendOrigin}/?resetToken=${encodeURIComponent(rawToken)}`;
  const { subject, html, text } = welcomeActivationEmail(username, to, activationUrl);

  await transport.sendMail({
    from: process.env.SMTP_FROM || 'alerts@monitorpro.io',
    to,
    subject,
    text,
    html,
  });
  return true;
}

export async function sendPasswordResetEmail(to: string, username: string, rawToken: string): Promise<boolean> {
  if (!process.env.SMTP_HOST) {
    console.warn('SMTP_HOST not configured — skipping password reset email.');
    return false;
  }

  const transport = getTransport();
  const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
  const resetUrl = `${frontendOrigin}/?resetToken=${encodeURIComponent(rawToken)}`;
  const { subject, html, text } = passwordResetEmail(username, resetUrl);

  await transport.sendMail({
    from: process.env.SMTP_FROM || 'alerts@monitorpro.io',
    to,
    subject,
    text,
    html,
  });
  return true;
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
