/**
 * Agent Customization Wizard
 * Interactive CLI for customizing and deploying agents
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const MARKETPLACE_URL = process.env.MARKETPLACE_AGENT_URL || 'http://localhost:3008';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(`${colors.cyan}${prompt}${colors.reset}`, (answer) => {
      resolve(answer);
    });
  });
}

async function fetchTemplates() {
  try {
    const response = await axios.get(`${MARKETPLACE_URL}/templates`);
    return response.data.templates;
  } catch (error) {
    log(`❌ Failed to fetch templates: ${error.message}`, 'red');
    log('💡 Make sure MarketplaceAgent is running: npm run agent:marketplace', 'yellow');
    process.exit(1);
  }
}

async function selectTemplate(templates) {
  log('\n╔════════════════════════════════════════╗', 'magenta');
  log('║   Agent Customization Wizard           ║', 'magenta');
  log('╚════════════════════════════════════════╝\n', 'magenta');

  log('Available Templates:', 'cyan');
  templates.forEach((t, idx) => {
    log(`\n${idx + 1}. ${t.name}`, 'bright');
    log(`   Type: ${t.type} | Difficulty: ${t.difficulty}`, 'dim');
    log(`   ${t.description}`, 'dim');
  });

  const choice = await question('\nSelect template number: ');
  const index = parseInt(choice) - 1;

  if (index < 0 || index >= templates.length) {
    log('❌ Invalid selection', 'red');
    process.exit(1);
  }

  return templates[index];
}

async function customizeTemplate(template) {
  log(`\n📝 Customizing: ${template.name}\n`, 'cyan');

  const customConfig = {};

  // Agent name
  const name = await question(`Agent name (default: ${template.name}): `);
  customConfig.name = name || template.name;

  // Port
  const port = await question(`Port (default: ${template.config.port}): `);
  customConfig.port = port ? parseInt(port) : template.config.port;

  // Type-specific customization
  if (template.type === 'worker') {
    log('\n🛠️  Worker Agent Configuration:', 'yellow');
    
    const skills = await question(`Skills (comma-separated, default: ${template.config.skills.join(', ')}): `);
    customConfig.skills = skills ? skills.split(',').map(s => s.trim()) : template.config.skills;

    const minPrice = await question(`Min price (default: ${template.config.minPrice}): `);
    customConfig.minPrice = minPrice ? parseFloat(minPrice) : template.config.minPrice;

    const maxPrice = await question(`Max price (default: ${template.config.maxPrice}): `);
    customConfig.maxPrice = maxPrice ? parseFloat(maxPrice) : template.config.maxPrice;

    const autoAccept = await question(`Auto-accept jobs? (yes/no, default: ${template.config.autoAcceptJobs ? 'yes' : 'no'}): `);
    customConfig.autoAcceptJobs = autoAccept.toLowerCase() === 'yes';

  } else if (template.type === 'client') {
    log('\n💼 Client Agent Configuration:', 'yellow');
    
    const budget = await question(`Default budget (default: ${template.config.defaultBudget}): `);
    customConfig.defaultBudget = budget ? parseFloat(budget) : template.config.defaultBudget;

    const autoApprove = await question(`Auto-approve work? (yes/no, default: ${template.config.autoApprove ? 'yes' : 'no'}): `);
    customConfig.autoApprove = autoApprove.toLowerCase() === 'yes';

    const verificationRequired = await question(`Require verification? (yes/no, default: ${template.config.verificationRequired ? 'yes' : 'no'}): `);
    customConfig.verificationRequired = verificationRequired.toLowerCase() === 'yes';

  } else if (template.type === 'verification') {
    log('\n🔍 Verification Agent Configuration:', 'yellow');
    
    const qualityThreshold = await question(`Quality threshold (0-100, default: ${template.config.qualityThreshold}): `);
    customConfig.qualityThreshold = qualityThreshold ? parseInt(qualityThreshold) : template.config.qualityThreshold;

    const autoApprove = await question(`Auto-approve passing work? (yes/no, default: ${template.config.autoApprove ? 'yes' : 'no'}): `);
    customConfig.autoApprove = autoApprove.toLowerCase() === 'yes';
  }

  return customConfig;
}

async function deployAgent(templateId, config, name) {
  try {
    log('\n🚀 Deploying agent...', 'yellow');
    
    const response = await axios.post(`${MARKETPLACE_URL}/deploy`, {
      templateId,
      config,
      name
    });

    if (response.data.success) {
      log('\n✅ Agent deployed successfully!', 'green');
      log(`\nAgent ID: ${response.data.agentId}`, 'cyan');
      log(`Endpoint: ${response.data.endpoint}`, 'cyan');
      log(`\nTo start the agent:`, 'yellow');
      log(`  curl -X POST ${MARKETPLACE_URL}/start/${response.data.agentId}`, 'dim');
      return response.data.agentId;
    } else {
      log('❌ Deployment failed', 'red');
      return null;
    }
  } catch (error) {
    log(`❌ Deployment error: ${error.message}`, 'red');
    return null;
  }
}

async function startAgent(agentId) {
  const start = await question('\nStart agent now? (yes/no): ');
  
  if (start.toLowerCase() === 'yes') {
    try {
      log('🚀 Starting agent...', 'yellow');
      const response = await axios.post(`${MARKETPLACE_URL}/start/${agentId}`);
      
      if (response.data.success) {
        log('\n✅ Agent started!', 'green');
        log(`PID: ${response.data.pid}`, 'cyan');
        log(`Endpoint: ${response.data.endpoint}`, 'cyan');
        log('\nAgent is now running!', 'green');
      }
    } catch (error) {
      log(`❌ Failed to start agent: ${error.message}`, 'red');
      log('💡 You can start it later using the MarketplaceAgent API', 'yellow');
    }
  }
}

function displaySummary(template, config) {
  log('\n╔════════════════════════════════════════╗', 'green');
  log('║   Configuration Summary                ║', 'green');
  log('╚════════════════════════════════════════╝', 'green');
  log(`\nTemplate: ${template.name}`, 'cyan');
  log(`Type: ${template.type}`, 'dim');
  log('\nCustom Configuration:', 'yellow');
  Object.entries(config).forEach(([key, value]) => {
    log(`  ${key}: ${JSON.stringify(value)}`, 'dim');
  });
}

async function main() {
  try {
    // Fetch templates
    const templates = await fetchTemplates();
    
    if (templates.length === 0) {
      log('❌ No templates available', 'red');
      process.exit(1);
    }

    // Select template
    const template = await selectTemplate(templates);

    // Customize template
    const config = await customizeTemplate(template);

    // Display summary
    displaySummary(template, config);

    // Confirm deployment
    const confirm = await question('\nDeploy this agent? (yes/no): ');
    
    if (confirm.toLowerCase() !== 'yes') {
      log('\n❌ Deployment cancelled', 'yellow');
      rl.close();
      return;
    }

    // Deploy agent
    const agentId = await deployAgent(template.id, config, config.name);

    if (agentId) {
      // Optionally start agent
      await startAgent(agentId);
    }

    rl.close();
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    rl.close();
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
rl.on('SIGINT', () => {
  log('\n\n👋 Goodbye!', 'yellow');
  rl.close();
  process.exit(0);
});

// Run wizard
main();

