#!/bin/bash

# Stop all AexoWork services
# Usage: ./scripts/stop-all.sh

echo "Stopping AexoWork services..."

if [ -f logs/pids.txt ]; then
  while read pid; do
    if kill -0 $pid 2>/dev/null; then
      echo "Stopping process $pid"
      kill $pid
    else
      echo "Process $pid already stopped"
    fi
  done < logs/pids.txt
  
  rm logs/pids.txt
  echo "All services stopped!"
else
  echo "No PID file found. Services may not be running."
fi

