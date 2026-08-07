import { createHash, generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto';
import type { Attestation, ProofType } from './types.js';

/** Stable JSON: sorted keys, no whitespace. The hash is over this form. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((value as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return value;
}

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export interface Signer {
  publicKey: string;
  sign(message: Buffer): string;
}

/** An ed25519 signer backed by node:crypto. Keys are PEM in memory; never written to disk by this module. */
export class Ed25519Signer implements Signer {
  private constructor(private readonly priv: KeyObject, public readonly publicKey: string, public readonly pub: KeyObject) {}

  static generate(): Ed25519Signer {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    return new Ed25519Signer(privateKey, publicKey.export({ type: 'spki', format: 'der' }).toString('base64'), publicKey);
  }

  sign(message: Buffer): string {
    return sign(null, message, this.priv).toString('base64');
  }

  verify(message: Buffer, signature: string): boolean {
    return verify(null, message, this.pub, Buffer.from(signature, 'base64'));
  }
}

export interface AttestInput<T> {
  type: ProofType;
  buildId: string;
  milestoneId: string;
  payload: T;
  issuedAt?: number;
}

/** Build a signed attestation. The hash covers everything except the signature. */
export function attest<T extends Record<string, unknown>>(input: AttestInput<T>, signer: Signer): Attestation<T> {
  const issuedAt = input.issuedAt ?? Math.floor(Date.now() / 1000);
  const body = { type: input.type, buildId: input.buildId, milestoneId: input.milestoneId, signer: signer.publicKey, issuedAt, payload: input.payload };
  const hash = sha256Hex(canonicalJson(body));
  const signature = signer.sign(Buffer.from(hash, 'hex'));
  return { ...body, hash, signature };
}

/** Recompute the hash and check it matches. Signature verification needs the signer's key and lives in the arbiter. */
export function attestationHashMatches(a: Attestation): boolean {
  const { hash, signature: _sig, ...body } = a;
  return sha256Hex(canonicalJson(body)) === hash;
}

/** Short display form of a hash or signature, like "9f3a…c21e". */
export function short(hex: string, n = 4): string {
  return hex.length <= n * 2 ? hex : `${hex.slice(0, n)}…${hex.slice(-n)}`;
}
