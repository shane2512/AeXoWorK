/**
 * Stop all running agent processes
 */

const { exec } = require('child_process');
const os = require('os');

const ports = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008];

function killProcessOnPort(port) {
  return new Promise((resolve, reject) => {
    const platform = os.platform();
    
    if (platform === 'win32') {
      // Windows: Find process using port and kill it
      exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
        if (error || !stdout) {
          resolve({ port, status: 'not_in_use' });
          return;
        }
        
        const lines = stdout.trim().split('\n');
        const pids = new Set();
        
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 0) {
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(pid)) {
              pids.add(pid);
            }
          }
        });
        
        if (pids.size === 0) {
          resolve({ port, status: 'not_in_use' });
          return;
        }
        
        // Kill all processes using this port
        const killPromises = Array.from(pids).map(pid => {
          return new Promise((resolveKill) => {
            exec(`taskkill /F /PID ${pid}`, (killError) => {
              if (killError) {
                resolveKill({ pid, success: false, error: killError.message });
              } else {
                resolveKill({ pid, success: true });
              }
            });
          });
        });
        
        Promise.all(killPromises).then(results => {
          resolve({ port, status: 'killed', pids: Array.from(pids), results });
        });
      });
    } else {
      // Unix/Linux/Mac: Use lsof or fuser
      exec(`lsof -ti:${port}`, (error, stdout) => {
        if (error || !stdout) {
          resolve({ port, status: 'not_in_use' });
          return;
        }
        
        const pids = stdout.trim().split('\n').filter(pid => pid);
        
        if (pids.length === 0) {
          resolve({ port, status: 'not_in_use' });
          return;
        }
        
        const killPromises = pids.map(pid => {
          return new Promise((resolveKill) => {
            exec(`kill -9 ${pid}`, (killError) => {
              if (killError) {
                resolveKill({ pid, success: false, error: killError.message });
              } else {
                resolveKill({ pid, success: true });
              }
            });
          });
        });
        
        Promise.all(killPromises).then(results => {
          resolve({ port, status: 'killed', pids, results });
        });
      });
    }
  });
}

async function main() {
  console.log('\n🛑 Stopping all agent processes...\n');
  
  const results = await Promise.all(
    ports.map(port => killProcessOnPort(port))
  );
  
  let killed = 0;
  let notInUse = 0;
  
  results.forEach(result => {
    if (result.status === 'killed') {
      console.log(`✅ Port ${result.port} - Killed ${result.pids.length} process(es)`);
      killed++;
    } else {
      console.log(`ℹ️  Port ${result.port} - Not in use`);
      notInUse++;
    }
  });
  
  console.log(`\n📊 Summary: ${killed} ports freed, ${notInUse} ports were already free\n`);
  
  if (killed > 0) {
    console.log('⏳ Waiting 2 seconds for ports to be released...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

main().catch(console.error);


