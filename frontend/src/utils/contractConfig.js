/**
 * Contract configuration utilities
 * This file centralizes blockchain contract addresses and network information
 */

// After redeployment, update this address with the new contract address from the truffle migration output
export const OUTBREAK_CONTRACT_ADDRESS = "0xff2A63d4bCed2E2441C203FeE4840FAEC66bE71E";

// Network specific contract addresses
export const NETWORK_CONTRACTS = {
  // Ethereum mainnet
  1: {
    outbreakTracking: "0x07766a4f028C91e307446d0Ba424f5efa1110819" // Replace with mainnet address if deployed
  },
  // Sepolia testnet
  11155111: {
    outbreakTracking: "0x07766a4f028C91e307446d0Ba424f5efa1110819" 
  },
  // Local Ganache
  5777: {
    outbreakTracking: "0xa064c7c657F4Da33C6F99766488cE133c2d8B18E" // Your local Ganache deployment
  },
  // Additional networks
  1337: { // Also used by some Ganache configurations
    outbreakTracking: "0xa064c7c657F4Da33C6F99766488cE133c2d8B18E"
  }
};

// Helper to get the correct contract address for the current network
export const getContractAddress = (networkId) => {
  if (networkId && NETWORK_CONTRACTS[networkId]) {
    return NETWORK_CONTRACTS[networkId].outbreakTracking;
  }
  // Return fallback address
  return OUTBREAK_CONTRACT_ADDRESS;
};

// New function to help verify contract deployment
export const getContractStatusByNetwork = (networkId) => {
  return {
    address: NETWORK_CONTRACTS[networkId]?.outbreakTracking || 'Not deployed',
    networkName: getNetworkNameById(networkId),
    isConfigured: Boolean(NETWORK_CONTRACTS[networkId])
  };
};

// Helper function to get network name from ID
export const getNetworkNameById = (id) => {
  const networks = {
    1: 'Ethereum Mainnet',
    3: 'Ropsten Testnet',
    4: 'Rinkeby Testnet',
    5: 'Goerli Testnet',
    11155111: 'Sepolia Testnet',
    42: 'Kovan Testnet',
    56: 'BSC Mainnet',
    97: 'BSC Testnet',
    137: 'Polygon Mainnet',
    80001: 'Mumbai Testnet',
    5777: 'Ganache',
    1337: 'Local Network',
    31337: 'Hardhat Network'
  };
  
  return networks[id] || `Unknown Network (ID: ${id})`;
};

// Function to get contract address based on environment or configuration
// export const getContractAddress = () => {
//   // Allow for override from environment if available
//   if (window.CONTRACT_ADDRESS) {
//     return window.CONTRACT_ADDRESS;
//   }
  
//   // Also check for localStorage override
//   try {
//     const savedAddress = localStorage.getItem('outbreakTrackingAddress');
//     if (savedAddress) {
//       console.log(`Using saved contract address from localStorage: ${savedAddress}`);
//       return savedAddress;
//     }
//   } catch (e) {
//     console.warn("Error accessing localStorage:", e);
//   }
  
//   return OUTBREAK_CONTRACT_ADDRESS;
// };

// Add a network-specific address map to handle different networks
export const NETWORK_ADDRESSES = {
  // Ganache
  5777: "0xff2A63d4bCed2E2441C203FeE4840FAEC66bE71E",
  // Local development
  1337: "0xff2A63d4bCed2E2441C203FeE4840FAEC66bE71E",
};

// Function to get address for specific network
export const getNetworkAddress = (networkId) => {
  return NETWORK_ADDRESSES[networkId] || OUTBREAK_CONTRACT_ADDRESS;
};

export default {
  OUTBREAK_CONTRACT_ADDRESS,
  NETWORK_CONTRACTS,
  getContractAddress,
  getContractStatusByNetwork,
  getNetworkNameById
};
