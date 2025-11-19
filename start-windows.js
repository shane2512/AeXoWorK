/**
 * Windows Startup Script for AexoWork
 * Starts all services: NATS, Agents, Frontend
 */

const { spawn } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const processes = [];
const NATS_VERSION = 'v2.10.7';
const NATS_DIR = path.join(__dirname, 'bin');
const NATS_EXE = path.join(NATS_DIR, 'nats-server.exe');

// Colors for console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Download NATS server if not present
async function ensureNATS() {
  if (fs.existsSync(NATS_EXE)) {
    log('✅ NATS server found', 'green');
    return;
  }

  log('📥 Downloading NATS server...', 'yellow');
  
  if (!fs.existsSync(NATS_DIR)) {
    fs.mkdirSync(NATS_DIR, { recursive: true });
  }

  const url = `https://github.com/nats-io/nats-server/releases/download/${NATS_VERSION}/nats-server-${NATS_VERSION}-windows-amd64.zip`;
  const zipPath = path.join(NATS_DIR, 'nats-server.zip');

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(zipPath);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        https.get(response.headers.location, (res) => {
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            log('✅ Downloaded NATS server', 'green');
            log('⚠️  Please extract nats-server.exe from the zip file to bin/ folder', 'yellow');
            log(`   Zip location: ${zipPath}`, 'cyan');
            resolve();
          });
        });
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          log('✅ Downloaded NATS server', 'green');
          log('⚠️  Please extract nats-server.exe from the zip file to bin/ folder', 'yellow');
          log(`   Zip location: ${zipPath}`, 'cyan');
          resolve();
        });
      }
    }).on('error', (err) => {
      fs.unlink(zipPath, () => {});
      reject(err);
    });
  });
}

// Start a service
function startService(name, command, args = [], color = 'cyan') {
  log(`🚀 Starting ${name}...`, color);
  
  const proc = spawn(command, args, {
    shell: true,
    stdio: 'inherit',
    cwd: __dirname
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

// Graceful shutdown
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
process.on('exit', cleanup);

// Main startup sequence
async function main() {
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║   AexoWork - Starting All Services    ║', 'cyan');
  log('╚════════════════════════════════════════╝\n', 'cyan');

  try {
    // Check if NATS is available (skip download for now, use external NATS)
    log('ℹ️  Skipping NATS server (use external NATS or Docker)', 'yellow');
    log('   Or download manually from: https://nats.io/download/', 'cyan');
    log('', 'reset');

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Start all agents
    log('🤖 Starting Agents...', 'green');
    startService('Client Agent', 'node', ['agent-sdk/agents/clientAgent.js'], 'blue');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    startService('Worker Agent', 'node', ['agent-sdk/agents/workerAgent.js'], 'blue');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    startService('Verification Agent', 'node', ['agent-sdk/agents/verificationAgent.js'], 'blue');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start adapters (optional)
    // startService('X402 Adapter', 'node', ['agent-sdk/adapters/x402.js'], 'yellow');
    // startService('AP2 Adapter', 'node', ['agent-sdk/adapters/ap2.js'], 'yellow');

    // Start frontend
    log('\n🌐 Starting Frontend...', 'green');
    const frontendProc = spawn('npm', ['run', 'dev'], {
      shell: true,
      stdio: 'inherit',
      cwd: path.join(__dirname, 'frontend')
    });
    
    frontendProc.on('error', (err) => {
      log(`❌ Frontend error: ${err.message}`, 'red');
    });
    
    frontendProc.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        log(`⚠️  Frontend exited with code ${code}`, 'yellow');
      }
    });
    
    processes.push({ name: 'Frontend', proc: frontendProc });

    log('\n\n╔════════════════════════════════════════╗', 'green');
    log('║     ✅ All Services Started!          ║', 'green');
    log('╚════════════════════════════════════════╝', 'green');
    log('\n📊 Service URLs:', 'cyan');
    log('   Frontend:     http://localhost:3000', 'cyan');
    log('   Client Agent: http://localhost:3001', 'cyan');
    log('   Worker Agent: http://localhost:3002', 'cyan');
    log('   Verify Agent: http://localhost:3003', 'cyan');
    log('   NATS Server:  nats://localhost:4222', 'cyan');
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

