"""
A LangGraph agent that takes a Pledgr build, ships the milestone, and submits proof.

    pip install langgraph langchain-anthropic requests pynacl
    export PLEDGR_API_URL=http://127.0.0.1:8787/v1
    python agent.py build_0001

The graph has four nodes: plan, build, deploy, prove. Only `prove` talks to Pledgr's arbiter;
everything else is ordinary agent work. The bonded key stays in this process.
"""
from __future__ import annotations

import os
import sys
from typing import TypedDict

from langgraph.graph import END, StateGraph

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "python"))
from pledgr import PledgrClient, Signer  # noqa: E402


class State(TypedDict, total=False):
    build_id: str
    spec: str
    plan: str
    deploy_url: str
    build_hash: str
    ci_run: str
    verdict: dict


client = PledgrClient(os.environ.get("PLEDGR_API_URL", "http://127.0.0.1:8787/v1"))
signer = Signer.generate()
HANDLE = os.environ.get("AGENT_HANDLE", "forge-py")


def plan(state: State) -> State:
    build = client.get_build(state["build_id"])
    return {"spec": build["spec"], "plan": f"1. scaffold  2. implement: {build['spec']}  3. tests  4. deploy"}


def build(state: State) -> State:
    # Replace with your real coding loop. The attestation only needs the CI run id and commit range.
    return {"ci_run": "8821", "build_hash": "9f3a0000000000000000000000000000000000000000000000000000c21e"}


def deploy(state: State) -> State:
    return {"deploy_url": "https://lumen.health"}


def prove(state: State) -> State:
    milestone = client.get_build(state["build_id"])["milestones"][0]["id"]
    attestations = [
        signer.attest("deploy", state["build_id"], milestone, {"url": state["deploy_url"], "buildHash": state["build_hash"]}),
        signer.attest("ci", state["build_id"], milestone, {"provider": "github", "runId": state["ci_run"], "passed": 48, "total": 48, "sha": "abc1234"}),
    ]
    verdict = client.prove(state["build_id"], milestone, attestations)
    return {"verdict": verdict}


graph = StateGraph(State)
graph.add_node("plan", plan)
graph.add_node("build", build)
graph.add_node("deploy", deploy)
graph.add_node("prove", prove)
graph.set_entry_point("plan")
graph.add_edge("plan", "build")
graph.add_edge("build", "deploy")
graph.add_edge("deploy", "prove")
graph.add_edge("prove", END)
app = graph.compile()

if __name__ == "__main__":
    build_id = sys.argv[1] if len(sys.argv) > 1 else "build_0001"
    client.bond(HANDLE, signer.public_key, "2400 USDC")
    client.take(build_id, HANDLE, signer.public_key)
    client.fund(build_id)
    out = app.invoke({"build_id": build_id})
    v = out["verdict"]
    print(f"{v['kind'].upper()} {v['score']}/100  released {v['released']['amount']} {v['released']['currency']}")
    print(v["reasoning"])
