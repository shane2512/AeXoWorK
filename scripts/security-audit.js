#!/usr/bin/env node

/**
 * Security Audit Script for AexoWork Smart Contracts
 * Performs automated security checks
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔒 AexoWork Security Audit');
console.log('═══════════════════════════════════════════════\n');

const results = {
  passed: [],
  warnings: [],
  errors: [],
  info: []
};

// Check 1: Solhint (Solidity Linter)
console.log('1️⃣  Running Solhint (Solidity Linter)...\n');
try {
  execSync('npx solhint contracts/**/*.sol', { stdio: 'inherit' });
  results.passed.push('Solhint: No critical issues');
} catch (error) {
  results.warnings.push('Solhint: Found some issues (check output above)');
}

// Check 2: Hardhat Compilation
console.log('\n2️⃣  Checking Contract Compilation...\n');
try {
  execSync('npx hardhat compile', { stdio: 'inherit' });
  results.passed.push('Compilation: All contracts compile successfully');
} catch (error) {
  results.errors.push('Compilation: Failed to compile contracts');
}

// Check 3: Manual Security Checks
console.log('\n3️⃣  Performing Manual Security Checks...\n');

const contractsDir = path.join(__dirname, '..', 'contracts');
const contracts = fs.readdirSync(contractsDir).filter(f => f.endsWith('.sol'));

const securityPatterns = {
  'Reentrancy Protection': {
    pattern: /ReentrancyGuard|nonReentrant/,
    severity: 'high',
    found: false
  },
  'Access Control': {
    pattern: /onlyOwner|Ownable|AccessControl/,
    severity: 'high',
    found: false
  },
  'Safe Math (v0.8+)': {
    pattern: /pragma solidity \^0\.8/,
    severity: 'medium',
    found: false
  },
  'Input Validation': {
    pattern: /require\(/,
    severity: 'high',
    found: false
  },
  'Event Emission': {
    pattern: /emit \w+/,
    severity: 'low',
    found: false
  },
  'Low-level Calls': {
    pattern: /\.call\{|\.delegatecall\{|\.staticcall\{/,
    severity: 'warning',
    found: false
  },
  'Send/Transfer': {
    pattern: /\.send\(|\.transfer\(/,
    severity: 'warning',
    found: false
  }
};

contracts.forEach(contractFile => {
  const contractPath = path.join(contractsDir, contractFile);
  const content = fs.readFileSync(contractPath, 'utf8');
  
  console.log(`   📄 Analyzing ${contractFile}...`);
  
  Object.keys(securityPatterns).forEach(checkName => {
    const check = securityPatterns[checkName];
    if (check.pattern.test(content)) {
      check.found = true;
      console.log(`      ✅ ${checkName}`);
    }
  });
});

// Evaluate security patterns
console.log('\n4️⃣  Security Pattern Analysis...\n');

Object.entries(securityPatterns).forEach(([name, check]) => {
  if (check.severity === 'high') {
    if (check.found) {
      results.passed.push(`${name}: Implemented`);
      console.log(`   ✅ ${name}: Present`);
    } else {
      results.errors.push(`${name}: Missing`);
      console.log(`   ❌ ${name}: NOT FOUND`);
    }
  } else if (check.severity === 'medium') {
    if (check.found) {
      results.passed.push(`${name}: Implemented`);
      console.log(`   ✅ ${name}: Present`);
    } else {
      results.warnings.push(`${name}: Consider implementing`);
      console.log(`   ⚠️  ${name}: Consider implementing`);
    }
  } else if (check.severity === 'warning') {
    if (check.found) {
      results.warnings.push(`${name}: Found (review usage)`);
      console.log(`   ⚠️  ${name}: Found (review usage)`);
    }
  }
});

// Check 5: Known Vulnerabilities
console.log('\n5️⃣  Checking for Known Vulnerabilities...\n');

const vulnerabilityChecks = [
  {
    name: 'tx.origin usage',
    pattern: /tx\.origin/,
    severity: 'critical',
    description: 'tx.origin should not be used for authorization'
  },
  {
    name: 'Unprotected selfdestruct',
    pattern: /selfdestruct\(/,
    severity: 'critical',
    description: 'selfdestruct should be protected'
  },
  {
    name: 'Block timestamp dependency',
    pattern: /block\.timestamp|now(?!\w)/,
    severity: 'medium',
    description: 'Timestamp can be manipulated by miners'
  },
  {
    name: 'Uninitialized storage pointers',
    pattern: /storage\s+\w+\s*;(?!\s*=)/,
    severity: 'high',
    description: 'Storage pointers should be initialized'
  }
];

contracts.forEach(contractFile => {
  const contractPath = path.join(contractsDir, contractFile);
  const content = fs.readFileSync(contractPath, 'utf8');
  
  vulnerabilityChecks.forEach(check => {
    if (check.pattern.test(content)) {
      const message = `${contractFile}: ${check.name} (${check.severity})`;
      if (check.severity === 'critical' || check.severity === 'high') {
        results.errors.push(message);
        console.log(`   ❌ ${message}`);
      } else {
        results.warnings.push(message);
        console.log(`   ⚠️  ${message}`);
      }
      console.log(`      ℹ️  ${check.description}`);
    }
  });
});

// Check 6: Gas Optimization
console.log('\n6️⃣  Gas Optimization Checks...\n');

const gasOptimizations = [
  {
    name: 'Public vs External',
    pattern: /function\s+\w+\([^)]*\)\s+public/,
    suggestion: 'Consider using external for functions called from outside'
  },
  {
    name: 'Storage vs Memory',
    pattern: /function\s+\w+\([^)]*\)\s+\w+\s+returns\s*\([^)]*memory/,
    suggestion: 'Verify appropriate use of storage/memory/calldata'
  },
  {
    name: 'Loop Optimization',
    pattern: /for\s*\(/,
    suggestion: 'Ensure loops have gas limits and cant exceed block gas limit'
  }
];

let gasIssuesFound = false;
contracts.forEach(contractFile => {
  const contractPath = path.join(contractsDir, contractFile);
  const content = fs.readFileSync(contractPath, 'utf8');
  
  gasOptimizations.forEach(check => {
    const matches = content.match(new RegExp(check.pattern, 'g'));
    if (matches && matches.length > 5) {
      gasIssuesFound = true;
      results.info.push(`${contractFile}: ${check.name} - ${matches.length} occurrences`);
      console.log(`   ℹ️  ${contractFile}: ${check.name}`);
      console.log(`      ${check.suggestion}`);
    }
  });
});

if (!gasIssuesFound) {
  console.log('   ✅ No obvious gas optimization issues');
}

// Summary
console.log('\n═══════════════════════════════════════════════');
console.log('📊 Audit Summary\n');

console.log(`✅ Passed Checks: ${results.passed.length}`);
results.passed.forEach(p => console.log(`   • ${p}`));

if (results.warnings.length > 0) {
  console.log(`\n⚠️  Warnings: ${results.warnings.length}`);
  results.warnings.forEach(w => console.log(`   • ${w}`));
}

if (results.errors.length > 0) {
  console.log(`\n❌ Errors: ${results.errors.length}`);
  results.errors.forEach(e => console.log(`   • ${e}`));
}

if (results.info.length > 0) {
  console.log(`\nℹ️  Info: ${results.info.length}`);
  results.info.forEach(i => console.log(`   • ${i}`));
}

console.log('\n═══════════════════════════════════════════════');

// Final verdict
const criticalIssues = results.errors.length;
const warnings = results.warnings.length;

console.log('\n🎯 Final Verdict:\n');

if (criticalIssues === 0 && warnings === 0) {
  console.log('✅ EXCELLENT: No critical issues or warnings found!');
  console.log('   Contracts appear to follow security best practices.');
  process.exit(0);
} else if (criticalIssues === 0) {
  console.log('⚠️  GOOD: No critical issues, but some warnings to review.');
  console.log(`   ${warnings} warning(s) found - review before mainnet deployment.`);
  process.exit(0);
} else {
  console.log('❌ ACTION REQUIRED: Critical issues found!');
  console.log(`   ${criticalIssues} error(s) must be fixed before deployment.`);
  console.log('   Recommend professional security audit.');
  process.exit(1);
}

