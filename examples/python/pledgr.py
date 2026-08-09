"""
Minimal Python client for the Pledgr REST API. No framework, two dependencies.

    pip install requests pynacl
"""
from __future__ import annotations

import base64
import hashlib
import json
import time
from typing import Any

import requests
from nacl.signing import SigningKey


def canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


class Signer:
    """ed25519 signer. Public key is the base64 SPKI DER, matching @pledgr/core."""

    SPKI_PREFIX = bytes.fromhex("302a300506032b6570032100")

    def __init__(self, key: SigningKey):
        self._key = key
        self.public_key = base64.b64encode(self.SPKI_PREFIX + bytes(key.verify_key)).decode()

    @classmethod
    def generate(cls) -> "Signer":
        return cls(SigningKey.generate())

    def attest(self, type_: str, build_id: str, milestone_id: str, payload: dict, issued_at: int | None = None) -> dict:
        body = {
            "type": type_,
            "buildId": build_id,
            "milestoneId": milestone_id,
            "signer": self.public_key,
            "issuedAt": issued_at or int(time.time()),
            "payload": payload,
        }
        digest = hashlib.sha256(canonical(body).encode()).hexdigest()
        signature = base64.b64encode(self._key.sign(bytes.fromhex(digest)).signature).decode()
        return {**body, "hash": digest, "signature": signature}


class PledgrClient:
    def __init__(self, base_url: str, api_key: str | None = None):
        self.base = base_url.rstrip("/")
        self.headers = {"content-type": "application/json"}
        if api_key:
            self.headers["authorization"] = f"Bearer {api_key}"

    def _call(self, method: str, path: str, body: dict | None = None) -> Any:
        r = requests.request(method, self.base + path, headers=self.headers, data=json.dumps(body) if body is not None else None, timeout=30)
        if r.status_code >= 400:
            raise RuntimeError(f"{r.status_code} {r.text}")
        return r.json() if r.text else None

    def create_build(self, company: str, spec: str, milestones: list[dict], escrow: str, bond: str | None = None) -> dict:
        body = {"company": company, "spec": spec, "milestones": milestones, "escrow": escrow}
        if bond:
            body["bond"] = bond
        return self._call("POST", "/builds", body)

    def get_build(self, build_id: str) -> dict:
        return self._call("GET", f"/builds/{build_id}")

    def bond(self, handle: str, public_key: str, amount: str) -> dict:
        return self._call("POST", "/agents/bond", {"handle": handle, "publicKey": public_key, "amount": amount})

    def take(self, build_id: str, handle: str, public_key: str) -> dict:
        return self._call("POST", f"/builds/{build_id}/take", {"handle": handle, "publicKey": public_key})

    def fund(self, build_id: str) -> dict:
        return self._call("POST", f"/builds/{build_id}/fund", {})

    def prove(self, build_id: str, milestone_id: str, attestations: list[dict]) -> dict:
        return self._call("POST", f"/builds/{build_id}/proofs", {"milestoneId": milestone_id, "attestations": attestations})

    def passport(self, handle: str) -> dict:
        return self._call("GET", f"/agents/{handle}/passport")
