#!/bin/bash

# Start AexoWork without Docker
# Uses native npm packages and cloud services

echo "🚀 Starting AexoWork (No Docker Required!)"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo "⚠️  No .env file found. Using test.config.js"
fi

# Create logs directory
mkdir -p logs

# Check for NATS server
echo "1️⃣  Checking NATS Server..."
if command -v nats-server &> /dev/null; then
  echo "   ✅ NATS Server found"
  echo "   Starting NATS on port 4222..."
  nats-server -p 4222 > logs/nats.log 2>&1 &
  NATS_PID=$!
  echo "   PID: $NATS_PID"
  sleep 2
else
  echo "   ⚠️  NATS Server not found"
  echo "   Install with: npm install -g nats-server"
  echo "   Or download from: https://github.com/nats-io/nats-server/releases"
  echo ""
  echo "   Using mock NATS for now..."
fi

# Check for IPFS
echo ""
echo "2️⃣  Checking IPFS..."
if [ -f "/Applications/IPFS Desktop.app/Contents/MacOS/IPFS Desktop" ] || \
   [ -f "$HOME/.ipfs/config" ] || \
   command -v ipfs &> /dev/null; then
  echo "   ✅ IPFS Desktop or daemon found"
else
  echo "   ⚠️  IPFS not found"
  echo "   Options:"
  echo "   A) Install IPFS Desktop: https://github.com/ipfs/ipfs-desktop/releases"
  echo "   B) Install Helia: npm install helia @helia/unixfs"
  echo "   C) Use cloud service (Pinata, Infura)"
  echo ""
  echo "   Using Helia (JavaScript IPFS) for now..."
fi

# Install Helia if not present
echo ""
echo "3️⃣  Setting up Helia IPFS..."
if ! npm list helia &> /dev/null; then
  echo "   Installing Helia..."
  npm install helia @helia/unixfs @helia/strings --no-save
fi

# Start adapters
echo ""
echo "4️⃣  Starting x402 Adapter..."
node agent-sdk/adapters/x402.js > logs/x402.log 2>&1 &
X402_PID=$!
echo "   PID: $X402_PID"

echo ""
echo "5️⃣  Starting AP2 Registry..."
node agent-sdk/adapters/ap2.js > logs/ap2.log 2>&1 &
AP2_PID=$!
echo "   PID: $AP2_PID"

# Start agents
echo ""
echo "6️⃣  Starting ClientAgent..."
node agent-sdk/agents/clientAgent.js > logs/client-agent.log 2>&1 &
CLIENT_PID=$!
echo "   PID: $CLIENT_PID"

echo ""
echo "7️⃣  Starting WorkerAgent..."
node agent-sdk/agents/workerAgent.js > logs/worker-agent.log 2>&1 &
WORKER_PID=$!
echo "   PID: $WORKER_PID"

echo ""
echo "8️⃣  Starting VerificationAgent..."
node agent-sdk/agents/verificationAgent.js > logs/verification-agent.log 2>&1 &
VERIFY_PID=$!
echo "   PID: $VERIFY_PID"

# Save PIDs
echo "$NATS_PID" > logs/pids.txt
echo "$X402_PID" >> logs/pids.txt
echo "$AP2_PID" >> logs/pids.txt
echo "$CLIENT_PID" >> logs/pids.txt
echo "$WORKER_PID" >> logs/pids.txt
echo "$VERIFY_PID" >> logs/pids.txt

echo ""
echo "=========================================="
echo "✅ All services started (NO DOCKER NEEDED!)"
echo "=========================================="
echo ""
echo "📝 Service Status:"
echo "   • x402 Adapter:        http://localhost:4000"
echo "   • AP2 Registry:        http://localhost:4100"
echo "   • ClientAgent:         http://localhost:3001"
echo "   • WorkerAgent:         http://localhost:3002"
echo "   • VerificationAgent:   http://localhost:3003"
echo ""
echo "📊 Logs:"
echo "   • View all logs:       tail -f logs/*.log"
echo "   • View specific:       tail -f logs/client-agent.log"
echo ""
echo "🛑 To stop all services:"
echo "   ./scripts/stop-all.sh"
echo ""
echo "🌐 Next steps:"
echo "   • Start frontend:      cd frontend && npm run dev"
echo "   • Test endpoint:       curl http://localhost:3001/jobs"
echo ""

