import Web3 from 'web3';

/**
 * Create a safe subscription to contract events with fallback mechanisms
 * @param {Object} contract - The web3 contract instance
 * @param {string} eventName - The name of the event to subscribe to
 * @param {Object} options - Subscription options (filter, fromBlock, etc.)
 * @param {Function} onData - Callback for data events
 * @param {Function} onError - Callback for error handling
 * @returns {Object} Subscription object with unsubscribe method
 */
const createSafeEventSubscription = (contract, eventName, options = {}, onData, onError) => {
  // Check if contract and events are available
  if (!contract || !contract.events) {
    console.log(`Contract or events not available`);
    return { 
      unsubscribe: () => {}, 
      isActive: false 
    };
  }
  
  // Check if we're using a mock contract
  if (contract.isMockContract === true) {
    return {
      unsubscribe: () => console.log(`Mock unsubscribe for ${eventName}`),
      isActive: true
    };
  }
  
  // Check if the specific event is available
  const eventFunc = contract.events[eventName];
  if (!eventFunc) {
    console.log(`Contract or event ${eventName} not available`);
    return { 
      unsubscribe: () => {}, 
      isActive: false 
    };
  }
  
  let isActive = false;
  let subscription = null;
  
  try {
    // Set up default options
    const defaultOptions = {
      filter: {},
      fromBlock: 'latest'
    };
    
    // Merge with user options
    const subscriptionOptions = { ...defaultOptions, ...options };
    
    // Attempt to increase listener limit if it's causing issues
    if (contract._provider && contract._provider.setMaxListeners) {
      contract._provider.setMaxListeners(30);
    }
    
    // Create the subscription, but handle cases where Web3 subscription fails
    try {
      subscription = eventFunc(subscriptionOptions)
        .on('connected', (subscriptionId) => {
          console.log(`${eventName} event subscription connected with ID:`, subscriptionId);
          isActive = true;
        })
        .on('data', (event) => {
          console.log(`${eventName} event received:`, event);
          if (typeof onData === 'function') {
            onData(event);
          }
        })
        .on('error', (error) => {
          console.error(`Error in ${eventName} event:`, error);
          isActive = false;
          if (typeof onError === 'function') {
            onError(error);
          }
        });
    } catch (subError) {
      console.error(`Error creating subscription for ${eventName}:`, subError);
      return {
        unsubscribe: () => {},
        isActive: false
      };
    }
    
    // Return a clean interface for the subscription
    return {
      unsubscribe: () => {
        try {
          if (subscription) {
            // Different Web3 versions have different ways to unsubscribe
            if (typeof subscription.unsubscribe === 'function') {
              subscription.unsubscribe();
            } else if (typeof subscription.removeAllListeners === 'function') {
              subscription.removeAllListeners();
            } else {
              // Try direct property access
              const subId = subscription.id || subscription.subscriptionId;
              if (subId && contract._requestManager && 
                  typeof contract._requestManager.removeSubscription === 'function') {
                contract._requestManager.removeSubscription(subId);
              }
            }
            console.log(`Unsubscribed from ${eventName} events`);
          }
        } catch (error) {
          console.error(`Error unsubscribing from ${eventName}:`, error);
        }
        isActive = false;
      },
      isActive: () => isActive
    };
  } catch (error) {
    console.error(`Error creating subscription for ${eventName}:`, error);
    
    // Return a dummy object in case of failure
    return {
      unsubscribe: () => console.log(`Dummy unsubscribe for ${eventName}`),
      isActive: false
    };
  }
};

export default createSafeEventSubscription;
