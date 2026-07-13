import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'test' });

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
  },
}));

import { sendIncidentEmail } from './email.service.js';

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
});
