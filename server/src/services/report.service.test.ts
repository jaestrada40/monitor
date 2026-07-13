import { describe, it, expect } from 'vitest';
import { computeMttrMinutes, computeSlaPercentage } from './report.service.js';

describe('computeMttrMinutes', () => {
  it('returns null when there are no resolved incidents', () => {
    expect(computeMttrMinutes([])).toBeNull();
  });

  it('averages resolution time in minutes across incidents', () => {
    const result = computeMttrMinutes([
      { createdAt: new Date('2026-01-01T00:00:00Z'), resolvedAt: new Date('2026-01-01T00:10:00Z') },
      { createdAt: new Date('2026-01-01T00:00:00Z'), resolvedAt: new Date('2026-01-01T00:20:00Z') },
    ]);
    expect(result).toBe(15);
  });
});

describe('computeSlaPercentage', () => {
  it('returns 0 when there are no sites', () => {
    expect(computeSlaPercentage([])).toBe(0);
  });

  it('computes the percentage of sites meeting the 99.9% target', () => {
    const result = computeSlaPercentage([{ uptime: 99.95 }, { uptime: 98.0 }, { uptime: 100 }, { uptime: 99.9 }]);
    expect(result).toBe(75);
  });
});
