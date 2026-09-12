#!/usr/bin/env sh
# tools/kvs_dump.sh v0.1.0 – alle KVS-Einträge des Shelly per HTTP-RPC ausgeben
# Aufruf: tools/kvs_dump.sh <ip-oder-hostname>
# Liest seitenweise (KVS.GetMany paginiert) und gibt die rohe JSON-Antwort je Seite aus.
set -eu
HOST="${1:?Aufruf: $0 <ip-oder-hostname>}"
OFF=0
while :; do
  PAGE=$(curl -sS "http://$HOST/rpc/KVS.GetMany?match=%2A&offset=$OFF")
  echo "$PAGE"
  TOTAL=$(printf '%s' "$PAGE" | sed -n 's/.*"total":\([0-9]*\).*/\1/p')
  COUNT=$(printf '%s' "$PAGE" | grep -o '"etag"' | wc -l | tr -d ' ')
  [ -z "$TOTAL" ] && break
  OFF=$((OFF + COUNT))
  [ "$COUNT" -eq 0 ] && break
  [ "$OFF" -ge "$TOTAL" ] && break
done
# Sys-Status mit kvs_rev (Schreibzähler) dazu:
curl -sS "http://$HOST/rpc/Sys.GetStatus"; echo
