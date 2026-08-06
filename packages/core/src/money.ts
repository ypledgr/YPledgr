import type { Currency, Money } from './types.js';

const MICRO = 1_000_000;

/** Parse "12000 USDC", "2,400 USDC" or "250.5 PLEDGR". */
export function parseMoney(input: string | Money): Money {
  if (typeof input !== 'string') return { amount: input.amount, currency: input.currency };
  const m = /^\s*([\d,]+(?:\.\d+)?)\s*(USDC|PLEDGR)\s*$/i.exec(input);
  if (!m) throw new Error(`Cannot parse money: "${input}"`);
  const amount = Number(m[1]!.replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid amount: "${input}"`);
  return { amount, currency: m[2]!.toUpperCase() as Currency };
}

export function money(amount: number, currency: Currency = 'USDC'): Money {
  return { amount: round6(amount), currency };
}

export function formatMoney(m: Money): string {
  const whole = m.amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `${whole} ${m.currency}`;
}

export function add(a: Money, b: Money): Money {
  assertSame(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function sub(a: Money, b: Money): Money {
  assertSame(a, b);
  return money(a.amount - b.amount, a.currency);
}

export function mul(a: Money, factor: number): Money {
  return money(a.amount * factor, a.currency);
}

export function min(a: Money, b: Money): Money {
  assertSame(a, b);
  return a.amount <= b.amount ? a : b;
}

export function isZero(m: Money): boolean {
  return m.amount === 0;
}

/** u64 micro-units as stored on-chain. */
export function toMicro(m: Money): bigint {
  return BigInt(Math.round(m.amount * MICRO));
}

export function fromMicro(micro: bigint, currency: Currency = 'USDC'): Money {
  return money(Number(micro) / MICRO, currency);
}

function assertSame(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
}

function round6(n: number): number {
  return Math.round(n * MICRO) / MICRO;
}
