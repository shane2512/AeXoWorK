/**
 * Complete Startup Script for AexoWork
 * Starts: NATS + All Agents + Frontend
 */

const { spawn } = require('child_process');
const path = require('path');

const processes = [];

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function startService(name, command, args = [], cwd = __dirname, color = 'cyan') {
  log(`🚀 Starting ${name}...`, color);
  
  const proc = spawn(command, args, {
    shell: true,
    stdio: 'inherit',
    cwd: cwd
  });

  proc.on('error', (err) => {
    log(`❌ ${name} error: ${err.message}`, 'red');
  });

  proc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      log(`⚠️  ${name} exited with code ${code}`, 'yellow');
    }
  });

  processes.push({ name, proc });
  return proc;
}

function cleanup() {
  log('\n\n🛑 Shutting down all services...', 'yellow');
  
  processes.forEach(({ name, proc }) => {
    log(`  Stopping ${name}...`, 'cyan');
    try {
      proc.kill();
    } catch (err) {
      // Process might already be dead
    }
  });

  setTimeout(() => {
    log('✅ All services stopped', 'green');
    process.exit(0);
  }, 2000);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

async function main() {
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║   AexoWork - Starting All Services    ║', 'cyan');
  log('╚════════════════════════════════════════╝\n', 'cyan');

  try {
    // 1. Start NATS Server
    log('📡 Starting NATS Server...', 'green');
    startService('NATS Server', 'node', ['nats-server.js'], __dirname, 'blue');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 2. Start Agents
    log('\n🤖 Starting Agents...', 'green');
    startService('Client Agent', 'node', ['agent-sdk/agents/clientAgent.js'], __dirname, 'blue');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    startService('Worker Agent', 'node', ['agent-sdk/agents/workerAgent.js'], __dirname, 'blue');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    startService('Verification Agent', 'node', ['agent-sdk/agents/verificationAgent.js'], __dirname, 'blue');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Phase 2: A2A Protocol Agents
    log('\n🚀 Starting Phase 2 A2A Agents...', 'green');
    startService('Repute Agent', 'node', ['agent-sdk/agents/reputeAgent.js'], __dirname, 'magenta');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    startService('Dispute Agent', 'node', ['agent-sdk/agents/disputeAgent.js'], __dirname, 'magenta');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    startService('Data Agent', 'node', ['agent-sdk/agents/dataAgent.js'], __dirname, 'magenta');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    startService('Escrow Agent', 'node', ['agent-sdk/agents/escrowAgent.js'], __dirname, 'magenta');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Start Frontend
    log('\n🌐 Starting Frontend...', 'green');
    startService('Frontend', 'npm', ['run', 'dev'], path.join(__dirname, 'frontend'), 'magenta');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Success message
    log('\n\n╔════════════════════════════════════════╗', 'green');
    log('║     ✅ All Services Started!          ║', 'green');
    log('╚════════════════════════════════════════╝', 'green');
    log('\n📊 Service URLs:', 'cyan');
    log('   Frontend:       http://localhost:3000', 'cyan');
    log('   Client Agent:   http://localhost:3001', 'cyan');
    log('   Worker Agent:   http://localhost:3002', 'cyan');
    log('   Verify Agent:   http://localhost:3003', 'cyan');
    log('   Repute Agent:   http://localhost:3004  (A2A)', 'magenta');
    log('   Dispute Agent:  http://localhost:3005  (A2A)', 'magenta');
    log('   Data Agent:     http://localhost:3006  (A2A)', 'magenta');
    log('   Escrow Agent:   http://localhost:3007  (A2A)', 'magenta');
    log('   NATS Server:    nats://localhost:4222', 'cyan');
    log('\n📋 Deployed Contracts:', 'yellow');
    log('   AgentRegistry:      0xCdB11f8D0Cba2b4e0fa8114Ec660bda8081E7197', 'cyan');
    log('   EscrowManager:      0x13a2C3aEF22555012f9251F621636Cc60c0cfbBB', 'cyan');
    log('   ReputationManager:  0xD296a448Af0Ba1413EECe5d52C1112e420CF3c39', 'cyan');
    log('   Marketplace:        0xa99366835284E3a2D47df3f0d91152c8dE91984F', 'cyan');
    log('   Proofs:             0xF6564fd8FAdd61F4305e7eC6a4851eA0bF30b560', 'cyan');
    log('   Arbitration:        0x0014954fB093ABb6eC2dC51ffEC51990615B258d', 'cyan');
    log('\n💡 Press Ctrl+C to stop all services\n', 'yellow');

  } catch (error) {
    log(`\n❌ Startup failed: ${error.message}`, 'red');
    cleanup();
  }
}

main().catch((err) => {
  log(`❌ Fatal error: ${err.message}`, 'red');
  process.exit(1);
});

