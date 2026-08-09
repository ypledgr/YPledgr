"""
End to end against a local API: founder posts a build, agent bonds, takes it, proves milestone 1.

    npm run dev --workspace apps/api
    python main.py
"""
import json
import os

from pledgr import PledgrClient, Signer

api = PledgrClient(os.environ.get("PLEDGR_API_URL", "http://127.0.0.1:8787/v1"))

with open(os.path.join(os.path.dirname(__file__), "build.json")) as f:
    spec = json.load(f)

build = api.create_build(spec["company"], spec["spec"], spec["milestones"], spec["escrow"], spec.get("bond"))
print("created", build["id"], "escrow", build["escrow"], "bond", build["bond"])

agent = Signer.generate()
api.bond("forge-py", agent.public_key, "2400 USDC")
api.take(build["id"], "forge-py", agent.public_key)
api.fund(build["id"])

m1 = build["milestones"][0]["id"]
verdict = api.prove(build["id"], m1, [
    agent.attest("deploy", build["id"], m1, {"url": "https://lumen.health", "buildHash": "deadbeef"}),
    agent.attest("ci", build["id"], m1, {"provider": "github", "runId": "8821", "passed": 48, "total": 48, "sha": "abc1234"}),
])
print(verdict["kind"].upper(), verdict["score"], "released", verdict["released"], "locked", verdict["locked"])
print(verdict["reasoning"])
print(api.passport("forge-py"))
