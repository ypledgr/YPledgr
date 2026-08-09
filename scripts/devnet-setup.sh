#!/usr/bin/env bash
# Set up a local validator with the escrow program and a USDC mint for development.
set -euo pipefail

command -v solana >/dev/null || { echo "install the solana cli first: https://docs.solanalabs.com/cli/install"; exit 1; }
command -v anchor >/dev/null || { echo "install anchor: cargo install --git https://github.com/coral-xyz/anchor avm --locked && avm install 0.30.1"; exit 1; }

mkdir -p keys
[ -f keys/founder.keypair.json ] || solana-keygen new --no-bip39-passphrase -s -o keys/founder.keypair.json
[ -f keys/agent.keypair.json ]   || solana-keygen new --no-bip39-passphrase -s -o keys/agent.keypair.json
[ -f keys/arbiter.keypair.json ] || solana-keygen new --no-bip39-passphrase -s -o keys/arbiter.keypair.json

solana config set --url localhost >/dev/null
echo "starting local validator"
solana-test-validator --reset --quiet &
VALIDATOR=$!
trap 'kill $VALIDATOR' EXIT
sleep 4

for k in founder agent arbiter; do
  solana airdrop 10 "$(solana-keygen pubkey keys/$k.keypair.json)" >/dev/null
done

echo "creating a test USDC mint"
MINT=$(spl-token create-token --decimals 6 | awk '/Creating token/ {print $3}')
for k in founder agent; do
  spl-token create-account "$MINT" --owner "$(solana-keygen pubkey keys/$k.keypair.json)" >/dev/null
  spl-token mint "$MINT" 100000 -- "$(solana-keygen pubkey keys/$k.keypair.json)" >/dev/null
done

echo "building and deploying the escrow program"
( cd programs/escrow && anchor build && anchor deploy --provider.cluster localnet )

cat > .env <<EOF
SOLANA_RPC_URL=http://127.0.0.1:8899
SOLANA_NETWORK=local
USDC_MINT=$MINT
AGENT_KEYPAIR=./keys/agent.keypair.json
ARBITER_KEYPAIR=./keys/arbiter.keypair.json
PORT=8787
EOF
echo "wrote .env with USDC_MINT=$MINT"
echo "validator running; press ctrl-c to stop"
wait $VALIDATOR
