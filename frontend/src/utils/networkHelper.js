import { NETWORK_ADDRESSES, OUTBREAK_CONTRACT_ADDRESS } from './contractConfig';

/**
 * Get appropriate contract address for the current network
 * @param {string} defaultAddress - Default contract address to use if no mapping exists
 * @returns {Promise<string>} The appropriate contract address for the current network
 */
export const getAppropriateContractAddress = async (defaultAddress = OUTBREAK_CONTRACT_ADDRESS) => {
  try {
    // Get the current network ID if Web3 is available
    let networkId = null;
    
    if (window.ethereum) {
      networkId = await window.ethereum.request({ method: 'net_version' });
    } else if (window.web3 && window.web3.version && window.web3.version.network) {
      networkId = window.web3.version.network;
    }
    
    console.log(`Current network ID: ${networkId}`);
    
    // If we have a network ID and an address for that network, use it
    if (networkId && NETWORK_ADDRESSES[networkId]) {
      console.log(`Using network-specific address for network ${networkId}: ${NETWORK_ADDRESSES[networkId]}`);
      return NETWORK_ADDRESSES[networkId];
    }
    
    // Check for localStorage override
    try {
      const savedAddress = localStorage.getItem('outbreakTrackingAddress');
      if (savedAddress) {
        console.log(`Using saved contract address from localStorage: ${savedAddress}`);
        return savedAddress;
      }
    } catch (e) {
      console.warn("Error accessing localStorage:", e);
    }
  } catch (error) {
    console.warn("Error determining network ID:", error);
  }
  
  console.log(`Using default address: ${defaultAddress}`);
  return defaultAddress;
};

/**
 * Map network IDs to human-readable names
 * @param {number} networkId - Network ID to get the name for
 * @returns {string} Human-readable network name
 */
export const getNetworkName = (networkId) => {
  const networks = {
    1: 'Ethereum Mainnet',
    3: 'Ropsten Testnet (deprecated)',
    4: 'Rinkeby Testnet (deprecated)',
    5: 'Goerli Testnet',
    11155111: 'Sepolia Testnet',
    42: 'Kovan Testnet (deprecated)',
    56: 'BSC Mainnet',
    97: 'BSC Testnet',
    137: 'Polygon Mainnet',
    80001: 'Polygon Mumbai',
    1337: 'Local Blockchain',
    5777: 'Ganache'
  };
  
  return networks[networkId] || `Unknown Network (${networkId})`;
};

/**
 * Check if the network is a local development network
 * @param {number} networkId - Network ID to check
 * @returns {boolean} True if it's a local network
 */
export const isLocalNetwork = (networkId) => {
  return networkId === 1337 || networkId === 5777 || networkId > 10000;
};
