#!/usr/bin/env bash
# One sweep pass, or a loop of them.
#
# Driven by `.github/workflows/scheduled-notifications.yml`, which decides
# which pass to run and how long to keep running it:
#
#   MODE                    dispatch | maintenance | materialise | full
#   SWEEP_MINUTES           0 for a single pass; a duration to loop for
#   SWEEP_INTERVAL_SECONDS  how long to sleep between passes of a loop
#
# The three schedules cost very different amounts and the endpoint is the one
# that knows it, so this script has no opinion about any of that — it presents
# the bearer token, reports what came back, and fails the run only on a
# rejected token or five consecutive bad passes. One bad pass is a cold start
# or a blip, and the sweep's own watermark means the next one covers whatever
# it missed.
set -uo pipefail

if [ -z "${CRON_SECRET}" ]; then
  echo "CRON_SECRET repository secret is not set — the endpoint would answer 401." >&2
  exit 1
fi

deadline=$(( $(date +%s) + SWEEP_MINUTES * 60 ))
failures=0
passes=0

while : ; do
  status=$(curl --silent --show-error --location \
    --max-time 120 \
    --output response.json \
    --write-out '%{http_code}' \
    --header "Authorization: Bearer ${CRON_SECRET}" \
    "${APP_URL}/api/cron/notifications?mode=${MODE}") || status="000"

  passes=$(( passes + 1 ))
  echo "[$(date -u +%H:%M:%SZ)] ${MODE} HTTP ${status} $(head -c 400 response.json)"

  if [ "${status}" = "401" ] || [ "${status}" = "403" ]; then
    echo "The endpoint rejected the bearer token — CRON_SECRET mismatch." >&2
    exit 1
  fi

  if [ "${status}" != "200" ]; then
    failures=$(( failures + 1 ))
    if [ "${failures}" -ge 5 ]; then
      echo "Five consecutive failed sweeps — failing the run." >&2
      exit 1
    fi
    # A single pass has no next attempt to recover in, so it fails loudly.
    if [ "${SWEEP_MINUTES}" = "0" ]; then
      echo "The ${MODE} pass did not succeed." >&2
      exit 1
    fi
  else
    failures=0
  fi

  [ "$(date +%s)" -ge "${deadline}" ] && break
  sleep "${SWEEP_INTERVAL_SECONDS}"
done

echo "Completed ${passes} ${MODE} sweep(s)."
