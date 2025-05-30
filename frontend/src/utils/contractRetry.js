/**
 * Utility functions for retrying contract operations
 */

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - The async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.factor - Backoff factor (default: 2)
 * @returns {Promise<any>} - Result of the function
 */
export const retry = async (fn, options = {}) => {
  const { 
    maxRetries = 3, 
    initialDelay = 1000, 
    factor = 2 
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Try to execute the function
      return await fn();
    } catch (error) {
      console.warn(`Attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message);
      lastError = error;
      
      // Don't wait on the last attempt
      if (attempt < maxRetries) {
        // Calculate backoff delay
        const delay = initialDelay * Math.pow(factor, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If we get here, all attempts failed
  throw lastError;
};

/**
 * Retry a contract method with exponential backoff
 * @param {Object} contract - Web3 contract instance
 * @param {string} methodName - Name of the method to call
 * @param {Array} args - Arguments to pass to the method
 * @param {Object} options - Additional options including retry options
 * @returns {Promise<any>} - Result of the contract method
 */
export const retryContractCall = async (contract, methodName, args = [], options = {}) => {
  const { 
    from = null,
    value = 0,
    gas = null,
    isCall = true,
    ...retryOptions 
  } = options;
  
  return retry(async () => {
    try {
      // Make sure the method exists
      if (!contract.methods[methodName]) {
        throw new Error(`Method ${methodName} does not exist on contract`);
      }
      
      // Prepare method with arguments
      const method = contract.methods[methodName](...args);
      
      // Prepare options for call/send
      const txOptions = {};
      if (from) txOptions.from = from;
      if (value) txOptions.value = value;
      if (gas) txOptions.gas = gas;
      
      // Call or send based on the isCall option
      if (isCall) {
        return await method.call(txOptions);
      } else {
        return await method.send(txOptions);
      }
    } catch (error) {
      console.error(`Contract ${isCall ? 'call' : 'transaction'} failed:`, error);
      throw error;
    }
  }, retryOptions);
};

/**
 * Check if contract is valid by trying to call a simple view function
 * @param {Object} contract - Web3 contract instance
 * @returns {Promise<boolean>} - True if contract is valid
 */
export const isContractValid = async (contract) => {
  try {
    // Try different view functions to see if any work
    const methods = [
      'owner',
      'getInfectedCount',
      'outbreakRadius',
      'getOutbreakLocationsCount'
    ];
    
    for (const method of methods) {
      if (contract.methods[method]) {
        await contract.methods[method]().call();
        console.log(`Contract validated using ${method} method`);
        return true;
      }
    }
    
    console.warn("Could not validate contract - no known methods worked");
    return false;
  } catch (error) {
    console.error("Contract validation failed:", error);
    return false;
  }
};
