import Web3 from 'web3';

let cachedWeb3 = null;

/**
 * Get a Web3 instance, creating a new one if necessary
 * @returns {Promise<Web3>} A Web3 instance
 */
export const getWeb3 = async () => {
  // Return cached web3 if it exists
  if (cachedWeb3) {
    return cachedWeb3;
  }
  
  // Create a new web3 instance
  try {
    // Modern dapp browsers
    if (window.ethereum) {
      const web3 = new Web3(window.ethereum);
      try {
        // Request account access if needed
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      } catch (requestError) {
        console.warn("User denied account access", requestError);
        // Continue anyway - we can still connect to the network
      }
      cachedWeb3 = web3;
      return web3;
    }
    // Legacy dapp browsers
    else if (window.web3) {
      const web3 = new Web3(window.web3.currentProvider);
      cachedWeb3 = web3;
      return web3;
    }
    // Fallback - use local development provider
    else {
      const provider = new Web3.providers.HttpProvider('http://127.0.0.1:7545');
      const web3 = new Web3(provider);
      
      // Verify we can connect before returning
      try {
        await web3.eth.net.isListening();
        cachedWeb3 = web3;
        return web3;
      } catch (connectionError) {
        console.error("Failed to connect to local provider:", connectionError);
        
        // Try a WebSocket provider as fallback
        try {
          const wsProvider = new Web3.providers.WebsocketProvider('ws://127.0.0.1:7545');
          const web3Ws = new Web3(wsProvider);
          await web3Ws.eth.net.isListening();
          cachedWeb3 = web3Ws;
          return web3Ws;
        } catch (wsError) {
          console.error("Failed to connect via WebSocket:", wsError);
          throw new Error("Could not connect to any Ethereum provider");
        }
      }
    }
  } catch (error) {
    console.error("Error initializing Web3:", error);
    throw error;
  }
};

/**
 * Clear the cached Web3 instance (useful for re-initializing)
 */
export const clearWeb3Cache = () => {
  cachedWeb3 = null;
};

/**
 * Get a contract instance for the specified contract and address
 * @param {object} contractJson - The contract JSON artifact
 * @param {string} address - The contract address
 * @returns {Promise<object>} The contract instance
 */
export const getContractInstance = async (contractJson, address) => {
  const web3 = await getWeb3();
  return new web3.eth.Contract(contractJson.abi, address);
};
