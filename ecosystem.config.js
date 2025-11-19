// PM2 Ecosystem Config for Production Deployment
module.exports = {
  apps: [
    {
      name: 'client-agent',
      script: 'agent-sdk/agents/clientAgent.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: 'logs/client-agent-error.log',
      out_file: 'logs/client-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'worker-agent',
      script: 'agent-sdk/agents/workerAgent.js',
      instances: 2, // Can run multiple workers
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: 'logs/worker-agent-error.log',
      out_file: 'logs/worker-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'verify-agent',
      script: 'agent-sdk/agents/verificationAgent.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3003
      },
      error_file: 'logs/verify-agent-error.log',
      out_file: 'logs/verify-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'x402-adapter',
      script: 'agent-sdk/adapters/x402.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      error_file: 'logs/x402-error.log',
      out_file: 'logs/x402-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'ap2-registry',
      script: 'agent-sdk/adapters/ap2.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 4100
      },
      error_file: 'logs/ap2-error.log',
      out_file: 'logs/ap2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};

