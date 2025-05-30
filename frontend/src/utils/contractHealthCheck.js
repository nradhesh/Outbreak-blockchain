import { getWeb3 } from './web3Provider';
import OutbreakTrackingContract from '../contracts/OutbreakTracking.json';
import { OUTBREAK_CONTRACT_ADDRESS, NETWORK_ADDRESSES } from './contractConfig';

/**
 * Run a comprehensive health check on the contract deployment
 * @returns {Promise<Object>} Health check results
 */
export const checkContractHealth = async () => {
  let web3;
  
  try {
    // Initialize Web3 with the appropriate provider
    web3 = await getWeb3();
    
    // Get basic information
    const accounts = await web3.eth.getAccounts();
    const networkId = await web3.eth.net.getId();
    
    // Fix: Use a more compatible way to get network type
    let networkType = "unknown";
    try {
      // Try the standard method first
      if (typeof web3.eth.net.getNetworkType === 'function') {
        networkType = await web3.eth.net.getNetworkType();
      } else {
        // Fallback to manually determining network type from ID
        networkType = getNetworkNameById(networkId);
      }
    } catch (typeError) {
      console.warn("Could not determine network type:", typeError);
      networkType = getNetworkNameById(networkId);
    }
    
    const isListening = await web3.eth.net.isListening();
    const latestBlock = await web3.eth.getBlockNumber();
    
    // Collect contract deployment information
    const deploymentResults = await checkDeployments(web3, networkId);
    
    // Get gas price and estimate
    const gasPrice = await web3.eth.getGasPrice();
    
    return {
      status: 'success',
      web3Available: true,
      networkInfo: {
        networkId,
        networkType,
        isListening,
        latestBlock,
        gasPrice: web3.utils.fromWei(gasPrice, 'gwei') + ' gwei'
      },
      accounts: accounts.length > 0 ? accounts : 'No accounts available',
      deployments: deploymentResults
    };
  } catch (error) {
    console.error('Health check error:', error);
    return {
      status: 'error',
      web3Available: !!web3,
      error: error.message
    };
  }
};

/**
 * Check all possible contract deployments
 * @param {Object} web3 - Web3 instance
 * @param {number} networkId - Current network ID
 * @returns {Promise<Object>} Deployment results
 */
const checkDeployments = async (web3, networkId) => {
  const results = {
    currentNetworkId: networkId,
    addressesToCheck: [],
    validDeployments: [],
    configuredAddress: OUTBREAK_CONTRACT_ADDRESS,
    artifactDeployments: [],
    recommendedAddress: null
  };
  
  // Add addresses from the artifact
  for (const netId in OutbreakTrackingContract.networks) {
    const address = OutbreakTrackingContract.networks[netId].address;
    results.artifactDeployments.push({
      networkId: netId,
      address,
      isCurrentNetwork: netId == networkId
    });
    
    if (!results.addressesToCheck.includes(address)) {
      results.addressesToCheck.push(address);
    }
  }
  
  // Add addresses from the configuration
  if (!results.addressesToCheck.includes(OUTBREAK_CONTRACT_ADDRESS)) {
    results.addressesToCheck.push(OUTBREAK_CONTRACT_ADDRESS);
  }
  
  // Add network-specific addresses
  if (NETWORK_ADDRESSES[networkId] && !results.addressesToCheck.includes(NETWORK_ADDRESSES[networkId])) {
    results.addressesToCheck.push(NETWORK_ADDRESSES[networkId]);
  }
  
  // Check each address
  for (const address of results.addressesToCheck) {
    try {
      // Check if there's code at this address
      const code = await web3.eth.getCode(address);
      const hasCode = code !== '0x' && code !== '0x0';
      
      if (hasCode) {
        // Try to verify it's our contract
        const isValid = await verifyContract(web3, address);
        
        const deploymentInfo = {
          address,
          hasCode,
          isValid,
          codeSize: web3.utils.hexToBytes(code).length
        };
        
        if (isValid) {
          results.validDeployments.push(deploymentInfo);
          
          // Set as recommended if it's on the current network
          const isFromCurrentNetwork = OutbreakTrackingContract.networks[networkId] && 
            OutbreakTrackingContract.networks[networkId].address === address;
          
          const isNetworkConfigured = NETWORK_ADDRESSES[networkId] === address;
          
          if (isFromCurrentNetwork || isNetworkConfigured) {
            results.recommendedAddress = address;
          }
        }
      }
    } catch (error) {
      console.error(`Error checking address ${address}:`, error);
    }
  }
  
  // If no recommended address but we have valid deployments, use the first one
  if (!results.recommendedAddress && results.validDeployments.length > 0) {
    results.recommendedAddress = results.validDeployments[0].address;
  }
  
  return results;
};

/**
 * Verify a contract by checking if it has expected methods
 * @param {Object} web3 - Web3 instance
 * @param {string} address - Contract address to verify
 * @returns {Promise<boolean>} True if valid
 */
const verifyContract = async (web3, address) => {
  try {
    // Create a contract instance
    const contract = new web3.eth.Contract(
      OutbreakTrackingContract.abi,
      address
    );
    
    // Try to call a few methods to verify it's the right contract
    try {
      // Owner should always be available
      await contract.methods.owner().call();
      return true;
    } catch (ownerError) {
      try {
        // Try another method
        await contract.methods.getInfectedCount().call();
        return true;
      } catch (countError) {
        try {
          // One more attempt
          await contract.methods.outbreakRadius().call();
          return true;
        } catch (radiusError) {
          console.log(`Contract at ${address} does not match our ABI`);
          return false;
        }
      }
    }
  } catch (error) {
    console.error(`Error verifying contract at ${address}:`, error);
    return false;
  }
};

/**
 * Force update the contract in localStorage to use a specific address
 * @param {string} address - Contract address to use
 */
export const forceUpdateContractAddress = (address) => {
  if (!address) return;
  
  try {
    localStorage.setItem('outbreakTrackingAddress', address);
    console.log(`Contract address forced to ${address}`);
    // Also update window variable for immediate use
    window.CONTRACT_ADDRESS = address;
    return true;
  } catch (error) {
    console.error('Error updating contract address:', error);
    return false;
  }
};

/**
 * Get the forced contract address if set
 * @returns {string|null} The forced address or null
 */
export const getForcedContractAddress = () => {
  try {
    return localStorage.getItem('outbreakTrackingAddress');
  } catch (error) {
    return null;
  }
};

/**
 * Clear the forced contract address
 */
export const clearForcedContractAddress = () => {
  try {
    localStorage.removeItem('outbreakTrackingAddress');
    delete window.CONTRACT_ADDRESS;
    return true;
  } catch (error) {
    console.error('Error clearing contract address:', error);
    return false;
  }
};

/**
 * Helper function to translate network IDs to names
 * @param {string|number} id - Network ID
 * @returns {string} Network name
 */
function getNetworkNameById(id) {
  const networks = {
    '1': 'mainnet',
    '3': 'ropsten',
    '4': 'rinkeby',
    '5': 'goerli',
    '11155111': 'sepolia',
    '42': 'kovan',
    '56': 'bsc',
    '137': 'polygon',
    '80001': 'mumbai',
    '43114': 'avalanche',
    '1337': 'local',
    '5777': 'ganache'
  };
  
  return networks[id] || `unknown-${id}`;
}
