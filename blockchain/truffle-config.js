const path = require('path');
const HDWalletProvider = require('@truffle/hdwallet-provider');
require('dotenv').config();

module.exports = {
  contracts_build_directory: path.join(__dirname, '../frontend/src/contracts'),
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545, // Default Ganache port
      network_id: "*", // Match any network id
      websockets: true,  // Enable WebSockets
      networkCheckTimeout: 10000,  // Increase timeout to avoid network check timeouts
    },
    // For connecting to Ganache GUI
    ganache: {
      host: "127.0.0.1",
      port: 7545,  // Default Ganache GUI port
      network_id: "5777",  // Match the network ID in ganache
      websockets: true,  // Enable WebSockets
    },
    // For connecting to Ganache CLI
    ganache_cli: {
      host: "127.0.0.1",
      port: 8545,  // Default Ganache CLI port
      network_id: "*",
      websockets: true,  // Enable WebSockets
    },
    // Add this to test for connection issues
    ganache_test: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",
      gas: 6721975,
      gasPrice: 20000000000,
      timeoutBlocks: 200,
      skipDryRun: true,
      websockets: true,  // Enable WebSockets
    },
  },
  
  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.0",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
      }
    }
  },
  
  // Configure mocha for testing
  mocha: {
    timeout: 100000
  }
};