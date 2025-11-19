require('@nomiclabs/hardhat-ethers');
require('dotenv').config();

module.exports = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    hederaTest: {
      url: process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api",
      accounts: process.env.HEDERA_PRIVATE_KEY ? [process.env.HEDERA_PRIVATE_KEY] : [],
      chainId: Number(process.env.CHAIN_ID || 296),
      timeout: 60000
    },
    hederaMain: {
      url: process.env.HEDERA_RPC_URL || "https://mainnet.hashio.io/api",
      accounts: process.env.HEDERA_PRIVATE_KEY ? [process.env.HEDERA_PRIVATE_KEY] : [],
      chainId: Number(process.env.CHAIN_ID || 295),
      timeout: 60000
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};

