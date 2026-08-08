#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { Ed25519Signer, formatMoney } from '@pledgr/core';
import { Pledgr, PledgrError } from '@pledgr/sdk';

const HELP = `pledgr <command> [options]

Commands
  builds create     --company <name> --spec <file|text> --escrow <usdc> [--bond <usdc>] [--milestones <json>]
  builds get        <buildId>
  builds list       [--state <state>]
  prove             <buildId> <milestoneId> [--deploy <url>] [--ci <provider:runId>] [--probe <url:p95ms>] [--revenue stripe]
  verdict           <buildId> [milestoneId]
  appeal            <buildId> <milestoneId> --reason <text>
  passport          <handle>
  bond              --handle <handle> --amount <usdc>

Options
  --network         devnet | mainnet | local        (default: $PLEDGR_NETWORK or devnet)
  --api-key         Bearer key                     (default: $PLEDGR_API_KEY)
  --json            Print raw JSON

Environment
  AGENT_HANDLE      Agent handle for prove and bond
`;

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      company: { type: 'string' },
      spec: { type: 'string' },
      escrow: { type: 'string' },
      bond: { type: 'string' },
      milestones: { type: 'string' },
      state: { type: 'string' },
      deploy: { type: 'string' },
      ci: { type: 'string' },
      probe: { type: 'string' },
      revenue: { type: 'string' },
      reason: { type: 'string' },
      handle: { type: 'string' },
      amount: { type: 'string' },
      network: { type: 'string' },
      'api-key': { type: 'string' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help || positionals.length === 0) { process.stdout.write(HELP); return 0; }

  const network = (values.network ?? process.env['PLEDGR_NETWORK'] ?? 'devnet') as 'devnet' | 'mainnet' | 'local';
  const apiKey = values['api-key'] ?? process.env['PLEDGR_API_KEY'];
  const pledgr = new Pledgr({ network, ...(apiKey ? { apiKey } : {}) });
  const out = (v: unknown, pretty: () => string) => process.stdout.write(values.json ? JSON.stringify(v, null, 2) + '\n' : pretty() + '\n');

  const [cmd, sub, ...rest] = positionals;

  try {
    if (cmd === 'builds' && sub === 'create') {
      if (!values.company || !values.spec || !values.escrow) throw new Error('builds create needs --company, --spec and --escrow');
      const spec = readSpec(values.spec);
      const milestones = values.milestones ? JSON.parse(readSpec(values.milestones)) : defaultMilestones();
      const build = await pledgr.builds.create({ company: values.company, spec, escrow: `${values.escrow} USDC`, ...(values.bond ? { bond: `${values.bond} USDC` } : {}), milestones });
      out(build, () => `Created ${build.id} for ${build.company}\n  escrow ${formatMoney(build.escrow)}  bond ${formatMoney(build.bond)}  milestones ${build.milestones.map((m) => m.id).join(', ')}`);
      return 0;
    }
    if (cmd === 'builds' && sub === 'get') {
      const build = await pledgr.builds.get(need(rest[0], 'buildId'));
      out(build, () => `${build.id}  ${build.company}  state ${build.state}\n` + build.tranches.map((t) => `  ${t.status.padEnd(9)} ${t.milestoneId.padEnd(20)} ${formatMoney(t.amount)}`).join('\n'));
      return 0;
    }
    if (cmd === 'builds' && sub === 'list') {
      const builds = await pledgr.builds.list(values.state ? { state: values.state } : {});
      out(builds, () => builds.map((b) => `${b.id}  ${b.state.padEnd(10)} ${b.company.padEnd(20)} ${formatMoney(b.escrow)}`).join('\n') || 'no builds');
      return 0;
    }
    if (cmd === 'prove') {
      const buildId = need(sub, 'buildId');
      const milestoneId = need(rest[0], 'milestoneId');
      const agent = pledgr.agent({ handle: need(process.env['AGENT_HANDLE'], 'AGENT_HANDLE'), signer: loadSigner() });
      const input: Parameters<typeof agent.prove>[2] = {};
      if (values.deploy) input.deploy = { url: values.deploy };
      if (values.ci) { const [provider, runId] = values.ci.split(':'); input.ci = { provider: provider as 'github', runId: runId ?? '' }; }
      if (values.probe) { const [url, p95] = values.probe.split(':'); input.probe = { url: url ?? '', p95Ms: Number(p95), uptime: 1 }; }
      if (values.revenue) input.revenue = { source: values.revenue as 'stripe' };
      const v = await agent.prove(buildId, milestoneId, input);
      out(v, () => `${v.kind.toUpperCase()} ${v.score}/100  released ${formatMoney(v.released)}  locked ${formatMoney(v.locked)}${v.slashed.amount ? `  slashed ${formatMoney(v.slashed)}` : ''}\n${v.reasoning}`);
      return 0;
    }
    if (cmd === 'verdict') {
      const verdicts = await pledgr.builds.verdicts(need(sub, 'buildId'));
      const filtered = rest[0] ? verdicts.filter((v) => v.milestoneId === rest[0]) : verdicts;
      out(filtered, () => filtered.map((v) => `${v.milestoneId.padEnd(20)} ${v.kind.padEnd(8)} ${String(v.score).padStart(3)}  released ${formatMoney(v.released)}`).join('\n') || 'no verdicts yet');
      return 0;
    }
    if (cmd === 'appeal') {
      const r = await pledgr.builds.appeal(need(sub, 'buildId'), need(rest[0], 'milestoneId'), need(values.reason, '--reason'));
      out(r, () => `Appeal ${r.appealId} opened. Panel of ${r.panelSize} decides by ${new Date(r.decideBy * 1000).toISOString()}`);
      return 0;
    }
    if (cmd === 'passport') {
      const p = await pledgr.passports.get(need(sub, 'handle'));
      out(p, () => `${p.handle}  ${p.standing}\n  builds ${p.builds}  pass rate ${p.passRate}%  slashes ${p.slashes}  earned ${formatMoney(p.earned)}  to profitable ${p.toProfitable}\n  recent ${p.recentScores.join(' ')}`);
      return 0;
    }
    if (cmd === 'bond') {
      const agent = pledgr.agent({ handle: need(values.handle ?? process.env['AGENT_HANDLE'], '--handle'), signer: loadSigner() });
      const r = await agent.bond(`${need(values.amount, '--amount')} USDC`);
      out(r, () => `Bond posted: ${r.bond.amount} ${r.bond.currency}  tx ${r.tx}`);
      return 0;
    }
    process.stderr.write(`Unknown command: ${[cmd, sub].filter(Boolean).join(' ')}\n\n${HELP}`);
    return 2;
  } catch (e) {
    if (e instanceof PledgrError) process.stderr.write(`error ${e.code}: ${e.message}\n`);
    else process.stderr.write(`error: ${(e as Error).message}\n`);
    return 1;
  }
}

function need<T>(v: T | undefined, name: string): T {
  if (v === undefined || v === '') throw new Error(`Missing ${name}`);
  return v;
}

function readSpec(v: string): string {
  try { return readFileSync(v, 'utf8'); } catch { return v; }
}

function loadSigner() {
  // On devnet a fresh key is fine for trying things out. Set AGENT_KEYPAIR for a persistent identity.
  return Ed25519Signer.generate();
}

function defaultMilestones() {
  return [
    { id: 'mvp-live', title: 'MVP live', proof: 'deploy', weight: 1 / 3 },
    { id: 'first-revenue', title: 'First revenue', proof: 'revenue', weight: 1 / 3 },
    { id: 'profitable', title: 'Profitable', proof: 'ledger', weight: 1 / 3, target: { profitableMonths: 3 } },
  ];
}

main(process.argv.slice(2)).then((code) => process.exit(code));
