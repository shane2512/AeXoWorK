#!/bin/bash

# Start all AexoWork services
# Usage: ./scripts/start-all.sh

echo "Starting AexoWork services..."

# Check if .env exists
if [ ! -f .env ]; then
  echo "Error: .env file not found. Please create it from .env.example"
  exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Create logs directory
mkdir -p logs

echo "1. Starting x402 Adapter..."
node agent-sdk/adapters/x402.js > logs/x402.log 2>&1 &
X402_PID=$!
echo "   PID: $X402_PID"

echo "2. Starting AP2 Registry..."
node agent-sdk/adapters/ap2.js > logs/ap2.log 2>&1 &
AP2_PID=$!
echo "   PID: $AP2_PID"

echo "3. Starting ClientAgent..."
node agent-sdk/agents/clientAgent.js > logs/client-agent.log 2>&1 &
CLIENT_PID=$!
echo "   PID: $CLIENT_PID"

echo "4. Starting WorkerAgent..."
node agent-sdk/agents/workerAgent.js > logs/worker-agent.log 2>&1 &
WORKER_PID=$!
echo "   PID: $WORKER_PID"

echo "5. Starting VerificationAgent..."
node agent-sdk/agents/verificationAgent.js > logs/verification-agent.log 2>&1 &
VERIFY_PID=$!
echo "   PID: $VERIFY_PID"

# Save PIDs to file for easy shutdown
echo "$X402_PID" > logs/pids.txt
echo "$AP2_PID" >> logs/pids.txt
echo "$CLIENT_PID" >> logs/pids.txt
echo "$WORKER_PID" >> logs/pids.txt
echo "$VERIFY_PID" >> logs/pids.txt

echo ""
echo "All services started!"
echo "Logs are in ./logs/"
echo ""
echo "To stop all services, run: ./scripts/stop-all.sh"
echo "To view logs: tail -f logs/*.log"

