/**
 * Seed the demo network: 14 builds for named startups, 11 bonded agents, a day of verdicts.
 *
 *   npm run seed
 *   PLEDGR_API_URL=http://127.0.0.1:8787/v1 npm run seed
 */
import { Ed25519Signer } from '@pledgr/core';
import { Pledgr } from '@pledgr/sdk';

const pledgr = new Pledgr({ baseUrl: process.env['PLEDGR_API_URL'] ?? 'http://127.0.0.1:8787/v1' });

const AGENTS = ['forge-1', 'reply-1', 'ledgerbot', 'quill-4', 'scout-9', 'lingua-2', 'watcher', 'digest-3', 'lumen', 'ears', 'tagger-7'];

const BUILDS: Array<[string, string, string, number, number]> = [
  ['Lumen Health', 'Ship the MVP: auth, billing, dashboard', 'forge-1', 12000, 2400],
  ['Driftwood', 'Land the first 50 customers', 'reply-1', 6000, 1200],
  ['Pine Labs', 'Set up books and filings', 'ledgerbot', 2000, 400],
  ['Orbit', 'Launch the waitlist site', 'quill-4', 1500, 300],
  ['Hatch', 'Scrape 1,200 qualified leads', 'scout-9', 1200, 250],
  ['Mellow', 'Run Tier-1 support for 30 days', 'reply-1', 1300, 260],
  ['Kite', 'Localise the app for DE and FR', 'lingua-2', 900, 180],
  ['Sprout', 'Build onboarding', 'forge-1', 4800, 960],
  ['Ferry', 'Monitor competitor pricing for 7 days', 'watcher', 600, 120],
  ['Nimbus', 'Investor update deck', 'digest-3', 750, 150],
  ['Atlas', 'Render 120 product shots', 'lumen', 600, 120],
  ['Vellum', 'Transcribe 60 hours of user calls', 'ears', 480, 95],
  ['Beacon', 'Label 5,000 tickets by intent', 'tagger-7', 450, 90],
  ['Sable', 'Migrate Postgres to v16', 'forge-1', 1800, 400],
];

const agents = new Map(AGENTS.map((h) => [h, pledgr.agent({ handle: h, signer: Ed25519Signer.generate() })]));

for (const [, a] of agents) await a.bond('3000 USDC');

let n = 0;
for (const [company, spec, handle, escrow, bond] of BUILDS) {
  const build = await pledgr.builds.create({
    company, spec, escrow: `${escrow} USDC`, bond: `${bond} USDC`,
    milestones: [
      { id: 'delivered', title: spec, proof: 'deploy', weight: 0.5, target: { url: `https://${company.toLowerCase().replace(/\s+/g, '')}.example` } },
      { id: 'profitable', title: 'Profitable', proof: 'ledger', weight: 0.5, target: { profitableMonths: 3 } },
    ],
  });
  const agent = agents.get(handle)!;
  await agent.take(build.id);
  await pledgr.builds.fund(build.id);
  const verdict = await agent.prove(build.id, 'delivered', {
    deploy: { url: `https://${company.toLowerCase().replace(/\s+/g, '')}.example`, buildHash: 'demo' },
    ci: { provider: 'github', runId: String(8800 + n), passed: 48, total: 48, sha: 'abc1234' },
  });
  n++;
  process.stdout.write(`${build.id}  ${company.padEnd(14)} ${handle.padEnd(10)} ${verdict.kind.padEnd(8)} ${String(verdict.score).padStart(3)}  released ${verdict.released.amount} USDC\n`);
}
process.stdout.write(`seeded ${n} builds\n`);
