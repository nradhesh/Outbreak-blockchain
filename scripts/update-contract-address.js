/**
 * Script to update contract addresses in the frontend config after deployment
 * Run this script manually or add it to your migration process
 */

const fs = require('fs');
const path = require('path');

// Get contract address from the artifacts
async function updateContractAddress() {
  try {
    // Path to the compiled contract artifact
    const artifactPath = path.join(
      __dirname, 
      '../frontend/src/contracts/OutbreakTracking.json'
    );
    
    // Path to the frontend contract config
    const configPath = path.join(
      __dirname,
      '../frontend/src/utils/contractConfig.js'
    );
    
    // Read the artifact file to get the latest address
    const artifactRaw = fs.readFileSync(artifactPath, 'utf8');
    const artifact = JSON.parse(artifactRaw);
    
    // Find the latest deployment
    if (!artifact.networks || Object.keys(artifact.networks).length === 0) {
      console.error('No networks found in contract artifact');
      return;
    }
    
    // Get the latest network deployment
    const networkIds = Object.keys(artifact.networks);
    const latestNetworkId = networkIds[networkIds.length - 1];
    const latestDeployment = artifact.networks[latestNetworkId];
    
    if (!latestDeployment || !latestDeployment.address) {
      console.error('No contract address found in the latest deployment');
      return;
    }
    
    const contractAddress = latestDeployment.address;
    console.log(`Found latest contract address: ${contractAddress} on network ${latestNetworkId}`);
    
    // Read the current config file
    let configContent = '';
    try {
      configContent = fs.readFileSync(configPath, 'utf8');
    } catch (readError) {
      // File doesn't exist, create a template
      configContent = `// Contract configuration settings

// Contract address from the latest deployment
export const OUTBREAK_CONTRACT_ADDRESS = "";

// Function to get contract address based on environment or configuration
export const getContractAddress = () => {
  // Allow for override from environment if available
  if (window.CONTRACT_ADDRESS) {
    return window.CONTRACT_ADDRESS;
  }
  
  return OUTBREAK_CONTRACT_ADDRESS;
};
`;
    }
    
    // Update the address in the config
    const updatedConfig = configContent.replace(
      /export const OUTBREAK_CONTRACT_ADDRESS = ".*";/,
      `export const OUTBREAK_CONTRACT_ADDRESS = "${contractAddress}";`
    );
    
    // Write the updated config
    fs.writeFileSync(configPath, updatedConfig);
    console.log(`Updated contract address in ${configPath}`);
    
    // Also update the networkHelper.js if it exists
    const networkHelperPath = path.join(
      __dirname,
      '../frontend/src/utils/networkHelper.js'
    );
    
    try {
      if (fs.existsSync(networkHelperPath)) {
        let helperContent = fs.readFileSync(networkHelperPath, 'utf8');
        
        // Update the address for the specific network
        const networkAddressRegex = new RegExp(`${latestNetworkId}: ".*"`, 'g');
        const hasNetwork = networkAddressRegex.test(helperContent);
        
        if (hasNetwork) {
          helperContent = helperContent.replace(
            networkAddressRegex,
            `${latestNetworkId}: "${contractAddress}"`
          );
        } else {
          // Try to find the contract addresses object and add the new network
          const addressesRegex = /const CONTRACT_ADDRESSES = {([^}]*)}/s;
          const match = helperContent.match(addressesRegex);
          
          if (match) {
            const addressesBlock = match[1];
            const updatedBlock = addressesBlock.trim() + `\n  ${latestNetworkId}: "${contractAddress}", // Added by script`;
            helperContent = helperContent.replace(addressesRegex, `const CONTRACT_ADDRESSES = {${updatedBlock}}`);
          }
        }
        
        fs.writeFileSync(networkHelperPath, helperContent);
        console.log(`Updated network helper for network ${latestNetworkId}`);
      }
    } catch (helperError) {
      console.error('Error updating network helper:', helperError);
    }
    
    console.log('Contract address update completed successfully');
  } catch (error) {
    console.error('Error updating contract address:', error);
  }
}

// Run the function
updateContractAddress().catch(console.error);
