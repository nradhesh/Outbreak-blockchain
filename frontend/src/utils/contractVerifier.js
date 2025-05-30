import { getWeb3 } from './web3Provider';
import OutbreakTrackingContract from '../contracts/OutbreakTracking.json';

/**
 * Verifies if a contract exists at the specified address and matches our ABI
 * @param {string} contractAddress - The address to check
 * @param {Object} web3 - Web3 instance (optional)
 * @returns {Promise<Object>} Verification result
 */
export const verifyContractDeployment = async (contractAddress, web3Instance = null) => {
  try {
    // Initialize Web3 if not provided
    const web3 = web3Instance || await getWeb3();
    
    // Check if the address is valid
    if (!web3.utils.isAddress(contractAddress)) {
      return { 
        exists: false, 
        isCompatible: false, 
        error: 'Invalid contract address' 
      };
    }
    
    // Check if there's contract code at the address
    const code = await web3.eth.getCode(contractAddress);
    if (code === '0x' || code === '0x0') {
      return { 
        exists: false, 
        isCompatible: false, 
        error: 'No contract code found at this address' 
      };
    }
    
    // Try to create a contract instance and call a method
    try {
      const contract = new web3.eth.Contract(OutbreakTrackingContract.abi, contractAddress);
      
      // Check if we can call a basic view function
      const count = await contract.methods.getInfectedCount().call();
      
      return {
        exists: true,
        isCompatible: true,
        infectedCount: parseInt(count),
        methods: Object.keys(contract.methods).filter(m => !m.includes('0x'))
      };
    } catch (callError) {
      console.error("Contract call error:", callError);
      return {
        exists: true,
        isCompatible: false,
        error: 'Contract exists but is not compatible with our ABI'
      };
    }
  } catch (error) {
    console.error("Contract verification error:", error);
    return {
      exists: false,
      isCompatible: false,
      error: error.message
    };
  }
};

/**
 * Get basic information about a contract deployment
 * @param {string} contractAddress - The address to check
 * @returns {Promise<Object>} Contract information
 */
export const getContractInfo = async (contractAddress) => {
  try {
    // Initialize Web3
    const web3 = await getWeb3();
    
    // Get network information
    const networkId = await web3.eth.net.getId();
    const networkType = await web3.eth.net.getNetworkType();
    
    // Check if contract exists
    const code = await web3.eth.getCode(contractAddress);
    const contractExists = code !== '0x' && code !== '0x0';
    
    return {
      address: contractAddress,
      exists: contractExists,
      networkId,
      networkType,
      codeSize: contractExists ? web3.utils.hexToBytes(code).length : 0,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("Error getting contract info:", error);
    return {
      address: contractAddress,
      exists: false,
      error: error.message
    };
  }
};
