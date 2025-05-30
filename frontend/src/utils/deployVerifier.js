import Web3 from 'web3';
import { getWeb3 } from './web3Provider';
import OutbreakTrackingContract from '../contracts/OutbreakTracking.json';
import { OUTBREAK_CONTRACT_ADDRESS } from './contractConfig';

/**
 * Utility to verify contract deployments across different networks
 */

export const verifyContractDeployment = async (targetNetworkIds = null) => {
  const results = {
    networks: [],
    success: false,
    message: '',
    timestamp: new Date().toISOString()
  };

  try {
    // Use current provider if available
    const provider = window.ethereum || window.web3?.currentProvider || null;
    
    if (!provider) {
      results.message = 'No web3 provider detected';
      return results;
    }

    const web3 = new Web3(provider);
    const currentNetworkId = await web3.eth.net.getId();
    
    // Determine which networks to check
    let networksToCheck = targetNetworkIds 
      ? (Array.isArray(targetNetworkIds) ? targetNetworkIds : [targetNetworkIds])
      : Object.keys(NETWORK_CONTRACTS).map(id => parseInt(id));
    
    // Always include the current network
    if (!networksToCheck.includes(currentNetworkId)) {
      networksToCheck.push(currentNetworkId);
    }
    
    // Get contract ABI
    const { abi } = OutbreakTrackingContract;
    
    // Check each network
    for (const networkId of networksToCheck) {
      const contractAddress = NETWORK_CONTRACTS[networkId]?.outbreakTracking;
      const networkResult = {
        networkId,
        networkName: getNetworkNameById(networkId),
        contractAddress,
        isCurrent: networkId === currentNetworkId,
        configured: Boolean(contractAddress),
        deployed: false,
        bytecodeLength: 0,
        error: null
      };
      
      if (contractAddress) {
        try {
          // For the current network, use the current provider
          // For other networks, we'd need to use a network-specific provider - skipped for simplicity
          if (networkId === currentNetworkId) {
            try {
              const code = await web3.eth.getCode(contractAddress);
              networkResult.deployed = code !== '0x' && code !== '0x0';
              networkResult.bytecodeLength = code.length;
              
              if (networkResult.deployed) {
                // Try a simple contract call to verify it's working
                const contract = new web3.eth.Contract(abi, contractAddress);
                try {
                  const count = await contract.methods.getInfectedCount().call();
                  networkResult.infectedCount = parseInt(count);
                  networkResult.contractFunctional = true;
                } catch (callError) {
                  networkResult.contractFunctional = false;
                  networkResult.error = `Contract call failed: ${callError.message}`;
                }
              }
            } catch (codeError) {
              networkResult.error = `Failed to get code: ${codeError.message}`;
            }
          } else {
            networkResult.message = 'Network not currently connected';
          }
        } catch (error) {
          networkResult.error = error.message;
        }
      }
      
      results.networks.push(networkResult);
    }
    
    // Set overall success if at least the current network is deployed
    const currentNetworkResult = results.networks.find(n => n.isCurrent);
    results.success = currentNetworkResult?.deployed || false;
    results.currentNetwork = currentNetworkResult;
    
  } catch (error) {
    results.message = `Verification failed: ${error.message}`;
  }
  
  return results;
};

/**
 * Verify that the contract is deployed correctly
 * @returns {Promise<Object>} Verification results
 */
export const verifyDeployment = async () => {
  try {
    // Initialize Web3
    const web3 = await getWeb3();
    
    // Get the network ID
    const networkId = await web3.eth.net.getId();
    
    // Check if we have a deployment for this network in our artifacts
    const deployedNetwork = OutbreakTrackingContract.networks[networkId];
    
    // Get expected contract address
    let contractAddress;
    if (deployedNetwork && deployedNetwork.address) {
      contractAddress = deployedNetwork.address;
    } else {
      contractAddress = OUTBREAK_CONTRACT_ADDRESS;
    }
    
    // Check for code at the address
    const code = await web3.eth.getCode(contractAddress);
    const hasCode = code !== '0x' && code !== '0x0';
    
    if (!hasCode) {
      return {
        success: false,
        error: `No contract found at address ${contractAddress}`,
        networkId,
        address: contractAddress
      };
    }
    
    // Try to initialize the contract
    const contract = new web3.eth.Contract(
      OutbreakTrackingContract.abi,
      contractAddress
    );
    
    // Check if it implements a basic function
    try {
      const owner = await contract.methods.owner().call();
      const radius = await contract.methods.outbreakRadius().call();
      
      return {
        success: true,
        networkId,
        address: contractAddress,
        owner,
        radius: parseInt(radius),
        deployedViaArtifact: Boolean(deployedNetwork)
      };
    } catch (callError) {
      return {
        success: false,
        error: `Contract exists but functions don't match ABI: ${callError.message}`,
        networkId,
        address: contractAddress
      };
    }
  } catch (error) {
    console.error("Deployment verification error:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Checks all networks in the contract artifact to find viable deployments
 * @returns {Promise<Array>} List of deployments across networks
 */
export const findContractDeployments = async () => {
  try {
    const web3 = await getWeb3();
    const deployments = [];
    
    // Get current network
    const currentNetworkId = await web3.eth.net.getId();
    
    // Iterate through all networks in the contract artifact
    for (const networkId in OutbreakTrackingContract.networks) {
      const deployment = OutbreakTrackingContract.networks[networkId];
      
      if (deployment && deployment.address) {
        try {
          // Check if the contract exists at this address
          const code = await web3.eth.getCode(deployment.address);
          const hasCode = code !== '0x' && code !== '0x0';
          
          deployments.push({
            networkId: parseInt(networkId),
            address: deployment.address,
            exists: hasCode,
            isCurrent: parseInt(networkId) === currentNetworkId
          });
        } catch (error) {
          deployments.push({
            networkId: parseInt(networkId),
            address: deployment.address,
            exists: false,
            error: error.message
          });
        }
      }
    }
    
    // Also check the hardcoded address
    if (!deployments.find(d => d.address === OUTBREAK_CONTRACT_ADDRESS)) {
      try {
        const code = await web3.eth.getCode(OUTBREAK_CONTRACT_ADDRESS);
        const hasCode = code !== '0x' && code !== '0x0';
        
        deployments.push({
          networkId: 'config',
          address: OUTBREAK_CONTRACT_ADDRESS,
          exists: hasCode,
          isCurrent: false
        });
      } catch (error) {
        deployments.push({
          networkId: 'config',
          address: OUTBREAK_CONTRACT_ADDRESS,
          exists: false,
          error: error.message
        });
      }
    }
    
    return deployments;
  } catch (error) {
    console.error("Error finding deployments:", error);
    return [{
      error: error.message
    }];
  }
};

export default { verifyContractDeployment, verifyDeployment, findContractDeployments };
