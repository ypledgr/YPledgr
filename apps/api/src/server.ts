import http from 'node:http';
import { App, type Req } from './app.js';

const PORT = Number(process.env['PORT'] ?? 8787);
const keys = process.env['PLEDGR_API_KEYS'] ? new Set(process.env['PLEDGR_API_KEYS'].split(',')) : undefined;

const app = new App({
  ...(keys ? { apiKeys: keys } : {}),
  deliver: async (url, body, headers) => { await fetch(url, { method: 'POST', body, headers }); },
  io: {
    probeUrl: async (url) => {
      const t0 = Date.now();
      const r = await fetch(url, { redirect: 'follow' });
      const buf = Buffer.from(await r.arrayBuffer());
      const { createHash } = await import('node:crypto');
      return { status: r.status, bodyHash: createHash('sha256').update(buf).digest('hex'), latencyMs: Date.now() - t0 };
    },
    // Devnet: trust the agent's numbers for CI, revenue and ledger. Mainnet replaces these with provider and oracle readers.
    readCiRun: async () => null,
    readRevenue: async () => null,
    readLedger: async () => null,
  },
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body: unknown = undefined;
  if (raw) {
    try { body = JSON.parse(raw); } catch { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ code: 'invalid_request', message: 'Body is not JSON' })); return; }
  }
  const r: Req = {
    method: req.method ?? 'GET',
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    body,
    headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : (v ?? '')])),
  };
  const out = await app.handle(r);
  res.writeHead(out.status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(out.body === undefined ? '' : JSON.stringify(out.body));
});

server.listen(PORT, () => {
  process.stdout.write(`pledgr api listening on http://127.0.0.1:${PORT}  arbiter ${app.arbiter.id.slice(0, 12)}…\n`);
});
