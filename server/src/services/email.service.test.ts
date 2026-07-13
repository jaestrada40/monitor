import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'test' });

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
  },
}));

import { sendIncidentEmail, sendReportEmail, sendTestEmail, sendWelcomeEmail } from './email.service.js';

describe('email.service', () => {
  beforeEach(() => {
    sendMailMock.mockClear();
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_FROM = 'alerts@monitorpro.io';
  });

  it('sends an incident-created email with the website name and severity in the body', async () => {
    await sendIncidentEmail({
      to: 'user@example.com',
      websiteName: 'Portal de Clientes',
      kind: 'created',
      severity: 'critical',
      description: 'El sitio no respondió tras dos intentos.',
    });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0][0];
    expect(call.to).toBe('user@example.com');
    expect(call.subject).toContain('Portal de Clientes');
    expect(call.text).toContain('El sitio no respondió tras dos intentos.');
  });

  it('does nothing and does not throw when SMTP_HOST is unset', async () => {
    delete process.env.SMTP_HOST;
    await expect(
      sendIncidentEmail({ to: 'user@example.com', websiteName: 'X', kind: 'resolved' })
    ).resolves.toBeUndefined();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('sends a scheduled report email with the summary figures and per-site uptime in the body', async () => {
    await sendReportEmail('user@example.com', 'weekly', {
      slaPercentage: 80,
      mttrMinutes: 15,
      resolvedCount: 3,
      totalCount: 4,
      perSiteUptime: [{ id: '1', name: 'Portal de Clientes', uptime: 99.95 }],
    });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0][0];
    expect(call.to).toBe('user@example.com');
    expect(call.subject).toContain('semanal');
    expect(call.text).toContain('SLA cumplido: 80%');
    expect(call.text).toContain('Portal de Clientes: 99.95% uptime');
  });

  it('sends a test email to the given address', async () => {
    await sendTestEmail('user@example.com');
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0][0];
    expect(call.to).toBe('user@example.com');
    expect(call.subject).toContain('prueba');
  });

  it('sends a welcome email with the temporary password and returns true', async () => {
    const sent = await sendWelcomeEmail('user@example.com', 'Nuevo Usuario', 'tempPass123!');
    expect(sent).toBe(true);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0][0];
    expect(call.to).toBe('user@example.com');
    expect(call.text).toContain('tempPass123!');
  });

  it('does not send and returns false when SMTP_HOST is unset', async () => {
    delete process.env.SMTP_HOST;
    const sent = await sendWelcomeEmail('user@example.com', 'Nuevo Usuario', 'tempPass123!');
    expect(sent).toBe(false);
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
