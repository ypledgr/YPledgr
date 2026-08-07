import { describe, expect, it } from 'vitest';
import { add, formatMoney, fromMicro, parseMoney, toMicro } from '../src/money.js';

describe('money', () => {
  it('parses strings with commas and decimals', () => {
    expect(parseMoney('12,000 USDC')).toEqual({ amount: 12_000, currency: 'USDC' });
    expect(parseMoney('250.5 pledgr')).toEqual({ amount: 250.5, currency: 'PLEDGR' });
  });

  it('rejects garbage', () => {
    expect(() => parseMoney('twelve dollars')).toThrow();
    expect(() => parseMoney('-5 USDC')).toThrow();
  });

  it('refuses to add different currencies', () => {
    expect(() => add(parseMoney('1 USDC'), parseMoney('1 PLEDGR'))).toThrow(/mismatch/);
  });

  it('round-trips micro-units', () => {
    const m = parseMoney('1234.567891 USDC');
    expect(toMicro(m)).toBe(1_234_567_891n);
    expect(fromMicro(1_234_567_891n)).toEqual({ amount: 1234.567891, currency: 'USDC' });
  });

  it('formats for humans', () => {
    expect(formatMoney(parseMoney('12000 USDC'))).toBe('12,000 USDC');
  });
});
