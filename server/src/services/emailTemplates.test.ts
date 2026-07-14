import { describe, it, expect } from 'vitest';
import { escapeHtml, incidentCreatedEmail, reportEmail, welcomeActivationEmail } from './emailTemplates.js';

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
  });
});

describe('incidentCreatedEmail', () => {
  it('escapes an untrusted website name and description into the HTML body', () => {
    const { html, text } = incidentCreatedEmail('<b>Evil</b> Site', 'critical', '<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<b>Evil</b>');
    expect(html).toContain('&lt;b&gt;Evil&lt;/b&gt;');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    // The plain-text fallback is not HTML-escaped, since it's rendered as-is by text-only clients.
    expect(text).toContain('<b>Evil</b> Site');
  });

  it('includes the severity and description in both html and text', () => {
    const { html, text } = incidentCreatedEmail('Portal', 'critical', 'El sitio no respondió.');
    expect(html).toContain('Crítico');
    expect(html).toContain('El sitio no respondió.');
    expect(text).toContain('critical');
    expect(text).toContain('El sitio no respondió.');
  });
});

describe('reportEmail', () => {
  it('renders per-site uptime rows and summary stats', () => {
    const { html, text } = reportEmail('weekly', {
      slaPercentage: 75,
      mttrMinutes: 12,
      resolvedCount: 2,
      totalCount: 3,
      perSiteUptime: [{ id: '1', name: 'Portal <script>', uptime: 99.95 }],
    });
    expect(html).toContain('75%');
    expect(html).toContain('12m');
    expect(html).toContain('2/3');
    expect(html).toContain('Portal &lt;script&gt;');
    expect(text).toContain('SLA cumplido: 75%');
  });
});

describe('welcomeActivationEmail', () => {
  it('includes the activation link and escapes the username', () => {
    const { html, text } = welcomeActivationEmail('<b>Juan</b>', 'juan@example.com', 'https://app.example.com/?resetToken=abc');
    expect(html).toContain('&lt;b&gt;Juan&lt;/b&gt;');
    expect(html).toContain('juan@example.com');
    expect(html).toContain('https://app.example.com/?resetToken=abc');
    expect(text).toContain('https://app.example.com/?resetToken=abc');
  });
});
