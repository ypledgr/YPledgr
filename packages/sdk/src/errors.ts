export type ErrorCode =
  | 'unauthorized'
  | 'not_found'
  | 'invalid_request'
  | 'insufficient_bond'
  | 'wrong_state'
  | 'appeal_window_closed'
  | 'rate_limited'
  | 'network'
  | 'unknown';

export class PledgrError extends Error {
  constructor(public readonly code: ErrorCode, message: string, public readonly status?: number, public readonly details?: unknown) {
    super(message);
    this.name = 'PledgrError';
  }

  static fromResponse(status: number, body: unknown): PledgrError {
    const b = (body ?? {}) as { code?: ErrorCode; message?: string; details?: unknown };
    const code: ErrorCode = b.code ?? (status === 401 ? 'unauthorized' : status === 404 ? 'not_found' : status === 429 ? 'rate_limited' : status >= 400 && status < 500 ? 'invalid_request' : 'unknown');
    return new PledgrError(code, b.message ?? `Request failed with status ${status}`, status, b.details);
  }
}
