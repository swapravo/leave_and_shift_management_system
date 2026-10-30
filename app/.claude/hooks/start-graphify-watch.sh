#!/bin/sh
# Start `graphify watch` for this project unless one is already running (tracked by a PID file, so the check can't
# match its own command line). Safe to call on every session start.
cd "$(dirname "$0")/../.." || exit 0
PIDFILE="${TMPDIR:-/tmp}/graphify-watch-lsm.pid"
if [ -f "$PIDFILE" ] && ps -p "$(cat "$PIDFILE")" -o command= 2>/dev/null | grep -q graphify; then
    exit 0
fi
nohup /Users/swapravo/.local/bin/graphify watch . </dev/null >"${TMPDIR:-/tmp}/graphify-watch.log" 2>&1 &
echo $! > "$PIDFILE"
