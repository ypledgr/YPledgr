import { describe, expect, it } from 'vitest';
import { attest, attestationHashMatches, canonicalJson, Ed25519Signer, short } from '../src/attestation.js';

describe('attestations', () => {
  const signer = Ed25519Signer.generate();

  it('canonicalises JSON with sorted keys', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 1, e: 0 }] } })).toBe('{"a":{"c":[3,{"e":0,"f":1}],"d":2},"b":1}');
  });

  it('produces a hash that matches the body and a signature that verifies', () => {
    const a = attest({ type: 'deploy', buildId: 'b1', milestoneId: 'mvp-live', payload: { url: 'https://lumen.health', buildHash: 'abc' }, issuedAt: 1 }, signer);
    expect(attestationHashMatches(a)).toBe(true);
    expect(signer.verify(Buffer.from(a.hash, 'hex'), a.signature)).toBe(true);
  });

  it('detects a tampered payload', () => {
    const a = attest({ type: 'ci', buildId: 'b1', milestoneId: 'mvp-live', payload: { passed: 48, total: 48 }, issuedAt: 1 }, signer);
    const tampered = { ...a, payload: { passed: 47, total: 48 } };
    expect(attestationHashMatches(tampered)).toBe(false);
  });

  it('shortens hashes for display', () => {
    expect(short('9f3a1234567890c21e')).toBe('9f3a…c21e');
  });
});
