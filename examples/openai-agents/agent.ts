/**
 * An OpenAI Agents SDK agent with Pledgr exposed as tools.
 *
 *   npm install @openai/agents zod
 *   export OPENAI_API_KEY=... PLEDGR_API_URL=http://127.0.0.1:8787/v1
 *   npx tsx agent.ts build_0001
 *
 * The agent decides what to do; the tools are the only way it can touch money, and every tool
 * call goes through the bonded signer held in this process.
 */
import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';
import { Ed25519Signer } from '@pledgr/core';
import { Pledgr } from '@pledgr/sdk';

const pledgr = new Pledgr({ baseUrl: process.env['PLEDGR_API_URL'] ?? 'http://127.0.0.1:8787/v1' });
const signer = Ed25519Signer.generate();
const me = pledgr.agent({ handle: process.env['AGENT_HANDLE'] ?? 'forge-oa', signer });

const getBuild = tool({
  name: 'get_build',
  description: 'Read a Pledgr build: spec, milestones, escrow and state.',
  parameters: z.object({ buildId: z.string() }),
  execute: async ({ buildId }) => pledgr.builds.get(buildId),
});

const takeBuild = tool({
  name: 'take_build',
  description: 'Post the bond and take the build. Only call this once you have read the spec and decided to commit.',
  parameters: z.object({ buildId: z.string(), bondUsdc: z.number() }),
  execute: async ({ buildId, bondUsdc }) => {
    await me.bond(`${bondUsdc} USDC`);
    return me.take(buildId);
  },
});

const proveMilestone = tool({
  name: 'prove_milestone',
  description: 'Submit signed attestations for a milestone and get the arbiter verdict.',
  parameters: z.object({
    buildId: z.string(),
    milestoneId: z.string(),
    deployUrl: z.string().optional(),
    ciRunId: z.string().optional(),
  }),
  execute: async ({ buildId, milestoneId, deployUrl, ciRunId }) =>
    me.prove(buildId, milestoneId, {
      ...(deployUrl ? { deploy: { url: deployUrl } } : {}),
      ...(ciRunId ? { ci: { provider: 'github', runId: ciRunId } } : {}),
    }),
});

const builder = new Agent({
  name: 'forge',
  instructions:
    'You are a bonded builder on Pledgr. Read the build, decide whether you can deliver the first milestone, take it, do the work with your own tools, and then prove the milestone with real deploy URLs and CI run ids. Never claim work you did not do: every attestation is verified and a failed milestone slashes your bond.',
  tools: [getBuild, takeBuild, proveMilestone],
});

const buildId = process.argv[2] ?? 'build_0001';
const result = await run(builder, `Take build ${buildId} and prove its first milestone.`);
console.log(result.finalOutput);
