/**
 * Contract redeployment utility
 * 
 * This script helps redeploy the contract and update the address in the frontend
 * Run with: node scripts/redeploy-contract.js
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE_PATH = path.join(
  __dirname, 
  '..', 
  'frontend', 
  'src', 
  'utils', 
  'contractConfig.js'
);

// Function to run truffle migration
const runMigration = (network = 'ganache') => {
  console.log(`Running migration on network: ${network}`);
  
  return new Promise((resolve, reject) => {
    // Change to project root directory
    process.chdir(path.join(__dirname, '..'));
    
    // Run the truffle migration command
    exec(`npx truffle migrate --reset --network ${network}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Migration error: ${error.message}`);
        reject(error);
        return;
      }
      
      if (stderr) {
        console.error(`Migration stderr: ${stderr}`);
      }
      
      console.log(`Migration output: ${stdout}`);
      
      // Extract contract address from migration output
      const addressMatch = stdout.match(/contract address:\s+([0-9a-fA-Fx]+)/i);
      const contractAddress = addressMatch ? addressMatch[1] : null;
      
      if (!contractAddress) {
        reject(new Error("Could not find contract address in migration output"));
        return;
      }
      
      resolve(contractAddress);
    });
  });
};

// Function to update contract address in configuration
const updateContractConfig = (contractAddress) => {
  console.log(`Updating contract config with address: ${contractAddress}`);
  
  try {
    // Read current config file
    let content = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
    
    // Update the OUTBREAK_CONTRACT_ADDRESS constant
    content = content.replace(
      /export const OUTBREAK_CONTRACT_ADDRESS = "0x[a-fA-F0-9]+";/,
      `export const OUTBREAK_CONTRACT_ADDRESS = "${contractAddress}";`
    );
    
    // Update the network-specific address for Ganache (5777)
    content = content.replace(
      /5777: {\s+outbreakTracking: "0x[a-fA-F0-9]+"/, 
      `5777: {\n    outbreakTracking: "${contractAddress}"`
    );
    
    // Update the network-specific address for Local (1337)
    content = content.replace(
      /1337: {\s+outbreakTracking: "0x[a-fA-F0-9]+"/, 
      `1337: {\n    outbreakTracking: "${contractAddress}"`
    );
    
    // Write the updated content
    fs.writeFileSync(CONFIG_FILE_PATH, content);
    console.log('Contract configuration updated successfully');
    
    return true;
  } catch (error) {
    console.error(`Failed to update contract config: ${error.message}`);
    return false;
  }
};

// Main execution
const main = async () => {
  try {
    // Run migration
    const contractAddress = await runMigration();
    console.log(`Contract deployed at: ${contractAddress}`);
    
    // Update configuration
    const updated = updateContractConfig(contractAddress);
    
    if (updated) {
      console.log('✅ Contract redeployment and configuration update completed successfully');
    } else {
      console.error('❌ Contract redeployment succeeded but configuration update failed');
    }
  } catch (error) {
    console.error(`❌ Contract redeployment failed: ${error.message}`);
    process.exit(1);
  }
};

// Run the script
main();
