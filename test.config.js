// Test configuration for AexoWork
module.exports = {
  // Hedera Network Configuration
  HEDERA_NETWORK: 'testnet',
  HEDERA_ACCOUNT_ID: '0.0.12345',
  HEDERA_PRIVATE_KEY: '302e020100300506032b6570042204209876543210abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
  HEDERA_RPC_URL: 'https://testnet.hashio.io/api',
  CHAIN_ID: 296,
  
  // Agent Configuration
  AGENT_DID: 'did:hedera:testnet:zHbiGbPuJA+CSZsYcKnFU4g6ctWzarSjp5pEsq8R+DRw=',
  AGENT_PRIVATE_KEY_BASE64: 'atHaGLWAlrDt+Vsy+nc4M5QEwe3tSAGrn0TjyUQgrcwduIZs+4kD4JJmxhwqcVTiDpy1bNqtKOnmkSyrxH4NHA==',
  
  // Services
  NATS_URL: 'nats://localhost:4222',
  IPFS_URL: 'http://localhost:5001',
  
  // Ports
  CLIENT_AGENT_PORT: 3001,
  WORKER_AGENT_PORT: 3002,
  VERIFICATION_AGENT_PORT: 3003,
  X402_PORT: 4000,
  AP2_PORT: 4100,
  
  // Test addresses
  FEE_RECIPIENT_ADDRESS: '0x0000000000000000000000000000000000000123',
  WORKER_ADDRESS: '0x0000000000000000000000000000000000000456',
  
  // Skills
  AGENT_SKILLS: 'React,Web3,Solidity,coding,testing',
  
  // Optional
  HCS_TOPIC_ID: '0.0.12346'
};

