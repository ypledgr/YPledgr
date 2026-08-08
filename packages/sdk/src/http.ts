import { PledgrError } from './errors.js';

export type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ status: number; json(): Promise<unknown>; text(): Promise<string> }>;

export interface HttpOptions {
  baseUrl: string;
  apiKey?: string;
  fetch?: FetchLike;
  /** Retries on 429 and 5xx. Default 2. */
  retries?: number;
  userAgent?: string;
}

export class Http {
  private readonly fetchImpl: FetchLike;
  private readonly retries: number;

  constructor(private readonly opts: HttpOptions) {
    this.fetchImpl = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
    if (!this.fetchImpl) throw new PledgrError('network', 'No fetch implementation available');
    this.retries = opts.retries ?? 2;
  }

  async request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const url = `${this.opts.baseUrl.replace(/\/+$/, '')}${path}`;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': this.opts.userAgent ?? '@pledgr/sdk',
    };
    if (this.opts.apiKey) headers['authorization'] = `Bearer ${this.opts.apiKey}`;

    let attempt = 0;
    for (;;) {
      let res: Awaited<ReturnType<FetchLike>>;
      try {
        res = await this.fetchImpl(url, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      } catch (e) {
        if (attempt++ < this.retries) { await sleep(150 * attempt); continue; }
        throw new PledgrError('network', `Could not reach ${url}: ${(e as Error).message}`);
      }
      if (res.status === 204) return undefined as T;
      const text = await res.text();
      const parsed = text ? safeJson(text) : undefined;
      if (res.status >= 200 && res.status < 300) return parsed as T;
      if ((res.status === 429 || res.status >= 500) && attempt++ < this.retries) { await sleep(150 * attempt); continue; }
      throw PledgrError.fromResponse(res.status, parsed);
    }
  }
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return { message: text }; }
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
