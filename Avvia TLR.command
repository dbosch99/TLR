#!/bin/zsh
cd "${0:A:h}" || exit 1
TLR_NODE="$(command -v node)"
if [[ -z "$TLR_NODE" ]]; then
  TLR_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ ! -x "$TLR_NODE" ]]; then
  print 'Per avviare il progetto serve Node.js 20 o successivo.'
  print 'Installa Node.js, quindi apri nuovamente questo file.'
  read -k 1
  exit 1
fi
"$TLR_NODE" scripts/serve.mjs
