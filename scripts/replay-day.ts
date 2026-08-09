/**
 * Replay a day of demo settlements in the terminal, the same feed the site shows.
 *
 *   npm run demo
 */
import { computeTranches, money, settleMilestone } from '@pledgr/core';

const rows: Array<[string, string, number, number, number]> = [
  ['Ship the MVP for Lumen Health', 'forge-1', 12000, 2400, 96],
  ['Land the first 50 customers for Driftwood', 'reply-1', 6000, 1200, 91],
  ['Set up books and filings for Pine Labs', 'ledgerbot', 2000, 400, 98],
  ['Launch the waitlist site for Orbit', 'quill-4', 1500, 300, 88],
  ['Scrape 1,200 leads for Hatch', 'scout-9', 1200, 250, 94],
  ['Run Tier-1 support for Mellow', 'reply-1', 1300, 260, 83],
  ['Localise the app for Kite', 'lingua-2', 900, 180, 62],
  ['Build onboarding for Sprout', 'forge-1', 4800, 960, 97],
  ['Monitor competitor pricing for Ferry', 'watcher', 600, 120, 31],
  ['Investor update deck for Nimbus', 'digest-3', 750, 150, 92],
  ['Render 120 product shots for Atlas', 'lumen', 600, 120, 95],
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let released = 0, slashed = 0, passes = 0;

process.stdout.write('\n  BUILD                                      AGENT       ESCROW   SCORE  VERDICT\n');
for (const [title, agent, escrow, bond, score] of rows) {
  const t = computeTranches(money(escrow), [{ id: 'm1', proof: 'deploy', weight: 0.5 }, { id: 'm2', proof: 'ledger', weight: 0.5 }]);
  const s = settleMilestone({ tranche: t[0]!.amount, bond: money(bond), score, lockedBefore: money(escrow) });
  released += s.released.amount; slashed += s.slashed.amount; if (s.kind !== 'fail') passes++;
  const label = s.kind === 'pass' ? 'pass, tranche released' : s.kind === 'partial' ? `partial, ${s.released.amount} USDC released` : `fail, ${s.slashed.amount} USDC bond slashed`;
  process.stdout.write(`  ${title.padEnd(42)} ${agent.padEnd(11)} ${String(escrow).padStart(6)}   ${String(score).padStart(3)}   ${label}\n`);
  await sleep(350);
}
process.stdout.write(`\n  released ${released.toLocaleString()} USDC   slashed ${slashed.toLocaleString()} USDC   pass rate ${Math.round((passes / rows.length) * 100)}%\n\n`);
