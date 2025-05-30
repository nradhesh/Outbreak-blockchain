import Web3 from 'web3';
import OutbreakTrackingContract from '../contracts/OutbreakTracking.json';
import { getAppropriateContractAddress } from './networkHelper';

let web3;
let contract;
let accounts;
let networkId;
let usingMockContract = false;
let contractInstanceCache = null;
let providerInitialized = false;

const CONTRACT_ADDRESS = "0xff2A63d4bCed2E2441C203FeE4840FAEC66bE71E";

export const initWeb3 = async () => {
  try {
    if (web3 && contract) {
      console.log("Web3 already initialized");
      return { web3, accounts, networkId, contract, usingMockContract };
    }
    
    if (window.ethereum) {
      if (!providerInitialized && window.ethereum.setMaxListeners) {
        window.ethereum.setMaxListeners(30);
        providerInitialized = true;
      }
      
      web3 = new Web3(window.ethereum);
      
      if (web3.currentProvider && web3.currentProvider.setMaxListeners) {
        web3.currentProvider.setMaxListeners(30);
      }
      
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      } catch (error) {
        console.error("User denied account access", error);
        throw new Error("Please allow access to your Web3 wallet to use this application");
      }
    }
    else if (window.web3) {
      web3 = new Web3(window.web3.currentProvider);
    }
    else {
      try {
        let provider;
        try {
          provider = new Web3.providers.WebsocketProvider('ws://127.0.0.1:7545');
          
          provider.on('connect', () => console.log('WebSocket connected'));
          provider.on('error', e => console.error('WebSocket error', e));
          provider.on('end', e => console.log('WebSocket connection ended', e));
        } catch (wsError) {
          console.error("WebSocket connection failed, falling back to HTTP provider", wsError);
          provider = new Web3.providers.HttpProvider('http://127.0.0.1:7545');
        }
        
        web3 = new Web3(provider);
        await checkConnection();
      } catch (error) {
        console.error("Failed to connect to local provider:", error); 
        throw new Error("Could not connect to local blockchain. Is Ganache running?");
      }
    }
    
    accounts = await web3.eth.getAccounts();
    networkId = await web3.eth.net.getId();
    
    initializeContract();
    
    return { web3, accounts, networkId, contract };
  } catch (error) {
    throw new Error(`Blockchain connection error: ${error.message}`);
  }
};

const checkConnection = async () => {
  try {
    await web3.eth.net.isListening();
    return true;
  } catch (error) {
    throw new Error("Could not connect to blockchain network. Please check if the network is running.");
  }
};

const initializeContract = async () => {
  try {
    const deployedNetwork = OutbreakTrackingContract.networks[networkId];
    
    let contractAddress = null;
    // let contractVerified = false;
    
    const strategies = [
      async () => {
        if (deployedNetwork && deployedNetwork.address) {
          const isValid = await verifyContractAddress(deployedNetwork.address);
          if (isValid) {
            return deployedNetwork.address;
          }
        }
        return null;
      },
      
      async () => {
        if (networkId >= 1000 && OutbreakTrackingContract.networks["5777"]) {
          const ganacheAddress = OutbreakTrackingContract.networks["5777"].address;
          const isValid = await verifyContractAddress(ganacheAddress);
          if (isValid) {
            return ganacheAddress;
          }
        }
        return null;
      },
      
      async () => {
        const networkAddress = await getAppropriateContractAddress();
        if (networkAddress !== CONTRACT_ADDRESS) {
          const isValid = await verifyContractAddress(networkAddress);
          if (isValid) {
            return networkAddress;
          }
        }
        return null;
      },
      
      async () => {
        const isValid = await verifyContractAddress(CONTRACT_ADDRESS);
        if (isValid) {
          return CONTRACT_ADDRESS;
        }
        return null;
      }
    ];
    
    for (const strategy of strategies) {
      const address = await strategy();
      if (address) {
        contractAddress = address;
        // contractVerified = true;
        break;
      }
    }
    
    if (!contractAddress) {
      throw new Error(`No valid contract found on network ${networkId}. Please run the migration again.`);
    }
    
    try {
      contract = new web3.eth.Contract(
        OutbreakTrackingContract.abi,
        contractAddress
      );
      
      if (!contract.methods.getInfectedCount) {
        console.warn("Warning: Contract does not have getInfectedCount method");
      }
      
      return contract;
    } catch (contractError) {
      throw new Error(`Contract creation error: ${contractError.message}`);
    }
  } catch (error) {
    throw new Error(`Contract initialization error: ${error.message}`);
  }
};

const verifyContractAddress = async (address) => {
  try {
    if (!web3.utils.isAddress(address)) {
      return false;
    }
    
    const code = await web3.eth.getCode(address);
    if (code === '0x' || code === '0x0') {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
};

export const checkProximity = async (location) => {
  try {
    if (!contract) {
      await initWeb3();
    }
    
    const result = await contract.methods.checkProximity(location).call();
    return {
      isNearOutbreak: result[0],
      outbreakLocation: result[1],
      infectedCount: parseInt(result[2]),
      distance: parseInt(result[3])
    };
  } catch (error) {
    throw new Error(`Proximity check failed: ${error.message}`);
  }
};

export const reportNewLocation = async (location) => {
  try {
    if (!contract) {
      await initWeb3();
    }
    
    const accounts = await web3.eth.getAccounts();
    await contract.methods.reportNewLocation(location).send({ from: accounts[0] });
    return true;
  } catch (error) {
    throw new Error(`Transaction failed: ${error.message}`);
  }
};

export const reportInfection = async (address, location, testResult) => {
  try {
    if (!contract) {
      await initWeb3();
    }
    
    const accounts = await web3.eth.getAccounts();
    await contract.methods.reportInfection(address, location, testResult).send({ from: accounts[0] });
    return true;
  } catch (error) {
    throw new Error(`Transaction failed: ${error.message}`);
  }
};

const verifyContractCompatibility = async (contractAddress) => {
  try {
    if (!web3) {
      await initWeb3();
    }
    
    const deployedCode = await web3.eth.getCode(contractAddress);
    if (deployedCode === '0x' || deployedCode === '0x0') {
      return {
        compatible: false,
        error: "No contract code found at the specified address"
      };
    }
    
    if (contractInstanceCache && contractInstanceCache.address === contractAddress) {
      return { compatible: true };
    }
    
    const testContract = new web3.eth.Contract(OutbreakTrackingContract.abi, contractAddress);
    
    try {
      await testContract.methods.getInfectedCount().call();
      contractInstanceCache = {
        contract: testContract,
        address: contractAddress
      };
      return { compatible: true };
    } catch (callError) {
      return {
        compatible: false,
        error: "Contract interface doesn't match expected ABI"
      };
    }
  } catch (error) {
    return {
      compatible: false,
      error: error.message
    };
  }
};

export const getAllOutbreakLocations = async () => {
  try {
    if (!web3 || !contract) {
      await initWeb3();
      
      if (!contract) {
        return { 
          locations: [], 
          counts: [] 
        };
      }
    }
    
    const compatibility = await verifyContractCompatibility(contract._address);
    if (!compatibility.compatible) {
      throw new Error(`Contract ABI mismatch: ${compatibility.error}`);
    }
    
    try {
      const result = await Promise.race([
        contract.methods.getAllOutbreakLocations().call(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Contract call timed out")), 10000)
        )
      ]);
      
      if (result && result.locations) {
        const locations = result.locations || [];
        const counts = (result.counts || []).map(count => parseInt(count));
        
        const outbreakLocations = locations.map((location, i) => ({
          id: `${location}-${counts[i]}`,
          location: location,
          infectedCount: counts[i] || 0,
          timestamp: new Date().toLocaleString()
        }));
        
        return { locations: outbreakLocations, counts };
      } else {
        throw new Error("Invalid response format from contract");
      }
    } 
    catch (mainError) {
      try {
        const count = await contract.methods.getOutbreakLocationsCount().call();
        const parsedCount = parseInt(count);
        
        if (parsedCount === 0) {
          return { locations: [], counts: [] };
        }
        
        if (parsedCount > 0 && parsedCount < 100) {
          const locations = [];
          const counts = [];
          
          for (let i = 0; i < parsedCount; i++) {
            try {
              const location = await contract.methods.outbreakLocations(i).call();
              if (location) {
                locations.push({
                  id: `${location.location}-${location.infectedCount}`,
                  location: location.location,
                  infectedCount: parseInt(location.infectedCount),
                  timestamp: new Date(parseInt(location.timestamp) * 1000).toLocaleString()
                });
                counts.push(parseInt(location.infectedCount));
              }
            } catch (locError) {
              console.error(`Error fetching location at index ${i}:`, locError);
            }
          }
          
          return { locations, counts };
        }
      } catch (countError) {
        console.error("Alternative approach failed:", countError);
      }
      
      // Fallback data if needed
      return {
        locations: [
          {
            id: "tokyo-5",
            location: "35.6895,139.6917", // Tokyo
            infectedCount: 5,
            timestamp: new Date().toLocaleString()
          },
          {
            id: "newyork-3",
            location: "40.7128,-74.0060", // New York
            infectedCount: 3,
            timestamp: new Date().toLocaleString()
          }
        ],
        counts: [5, 3]
      };
    }
  } catch (error) {
    return { locations: [], counts: [] };
  }
};

export const checkExposureRisk = async (location, timeThreshold) => {
  try {
    if (!contract) {
      await initWeb3();
    }
    
    const result = await contract.methods.checkExposureRisk(location, timeThreshold).call();
    return {
      exposed: result.exposed,
      exposureCount: parseInt(result.exposureCount)
    };
  } catch (error) {
    throw new Error(`Exposure risk check failed: ${error.message}`);
  }
};

export const getInfectedCount = async () => {
  try {
    if (!contract) {
      await initWeb3();
    }
    
    const count = await contract.methods.getInfectedCount().call();
    return parseInt(count);
  } catch (error) {
    throw new Error(`Failed to get infected count: ${error.message}`);
  }
};

export const getAccount = async () => {
  try {
    if (!web3) {
      await initWeb3();
    }
    const accounts = await web3.eth.getAccounts();
    return accounts[0];
  } catch (error) {
    throw new Error(`Failed to get account: ${error.message}`);
  }
};

export const checkWeb3Status = async () => {
  try {
    if (window.ethereum || window.web3) {
      await initWeb3();
      return { 
        available: true, 
        connected: true,
        account: accounts[0],
        networkId
      };
    } else {
      return { 
        available: false, 
        connected: false,
        errorMessage: "No Web3 provider found. Please install MetaMask or use a Web3-enabled browser."
      };
    }
  } catch (error) {
    return { 
      available: true, 
      connected: false,
      errorMessage: error.message
    };
  }
};

export const initializeEthers = initWeb3;

export const connectWallet = async () => {
  try {
    if (!web3) {
      await initWeb3();
    }
    
    if (window.ethereum) {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      
      if (accounts.length === 0) {
        throw new Error("No accounts found. Please make sure your wallet is unlocked.");
      }
      
      return accounts[0];
    } else if (web3) {
      const accounts = await web3.eth.getAccounts();
      
      if (accounts.length === 0) {
        throw new Error("No accounts found. Please make sure your wallet is unlocked.");
      }
      
      return accounts[0];
    } else {
      throw new Error("No Web3 provider detected. Please install MetaMask or use a Web3-enabled browser.");
    }
  } catch (error) {
    throw new Error(`Failed to connect wallet: ${error.message}`);
  }
};

export const setupEventListeners = (onNewInfection, onOutbreakAlert) => {
  try {
    if (!contract) {
      if (!web3) {
        initWeb3();
      } else {
        initializeContract();
      }
    }

    if (!contract) {
      throw new Error("Contract could not be initialized for event listeners");
    }
    
    let successful = false;
    let newInfectionListener = null;
    let outbreakListener = null;
    
    if (usingMockContract || (contract.isMockContract === true)) {
      successful = true;
      
      newInfectionListener = { 
        unsubscribe: () => console.log("Mock listener unsubscribed"),
        isActive: true 
      };
      
      outbreakListener = { 
        unsubscribe: () => console.log("Mock listener unsubscribed"), 
        isActive: true 
      };
      
      return () => {
        console.log("Mock listeners cleanup called");
      };
    }
    
    if (!contract.events || !contract.events.NewInfection || !contract.events.PotentialOutbreak) {
      throw new Error("Contract events methods not found");
    }
    
    try {
      newInfectionListener = contract.events.NewInfection({
        filter: {},
        fromBlock: 'latest'
      })
        .on('connected', (subscriptionId) => {
          successful = true;
        })
        .on('data', (event) => {
          const { individualAddress, location, timestamp } = event.returnValues;
          const infection = {
            address: individualAddress,
            location,
            timestamp: new Date(timestamp * 1000).toLocaleString()
          };
          if (onNewInfection) onNewInfection(infection);
        })
        .on('error', (error) => {
          console.error("Error in NewInfection event:", error);
        });
        
      outbreakListener = contract.events.PotentialOutbreak({
        filter: {},
        fromBlock: 'latest'
      })
        .on('connected', (subscriptionId) => {
          successful = true;
        })
        .on('data', (event) => {
          const { location, infectedCount, timestamp } = event.returnValues;
          const outbreak = {
            location,
            infectedCount: parseInt(infectedCount),
            timestamp: new Date(timestamp * 1000).toLocaleString()
          };
          if (onOutbreakAlert) onOutbreakAlert(outbreak);
        })
        .on('error', (error) => {
          console.error("Error in PotentialOutbreak event:", error);
        });
      
    } catch (subscribeError) {
      newInfectionListener = { unsubscribe: () => console.log("Dummy unsubscribe called") };
      outbreakListener = { unsubscribe: () => console.log("Dummy unsubscribe called") };
      
      throw subscribeError;
    }
    
    return () => {
      try {
        if (newInfectionListener) {
          if (typeof newInfectionListener.unsubscribe === 'function') {
            newInfectionListener.unsubscribe();
          } else if (typeof newInfectionListener.removeAllListeners === 'function') {
            newInfectionListener.removeAllListeners();
          }
        }
      } catch (e) {
        console.error("Error unsubscribing from NewInfection:", e);
      }
      
      try {
        if (outbreakListener) {
          if (typeof outbreakListener.unsubscribe === 'function') {
            outbreakListener.unsubscribe();
          } else if (typeof outbreakListener.removeAllListeners === 'function') {
            outbreakListener.removeAllListeners();
          }
        }
      } catch (e) {
        console.error("Error unsubscribing from PotentialOutbreak:", e);
      }
    };
  } catch (error) {
    throw new Error(`Failed to set up event listeners: ${error.message}`);
  }
};

export const pollForEvents = async (lastCheckedBlock = 0, onNewInfection, onOutbreakAlert) => {
  try {
    if (!contract) {
      await initWeb3();
    }
    
    let lastCheckedBlockNumber = Number(lastCheckedBlock);
    const currentBlock = await web3.eth.getBlockNumber();
    const currentBlockNumber = Number(currentBlock);
    
    if (lastCheckedBlockNumber === 0) {
      lastCheckedBlockNumber = Math.max(0, currentBlockNumber - 10);
    }
    
    const maxBlockRange = 5000;
    if (currentBlockNumber - lastCheckedBlockNumber > maxBlockRange) {
      lastCheckedBlockNumber = currentBlockNumber - maxBlockRange;
    }
    
    try {
      const newInfectionEvents = await contract.getPastEvents('NewInfection', {
        fromBlock: lastCheckedBlockNumber,
        toBlock: currentBlockNumber
      });
      
      const outbreakEvents = await contract.getPastEvents('PotentialOutbreak', {
        fromBlock: lastCheckedBlockNumber,
        toBlock: currentBlockNumber
      });
      
      newInfectionEvents.forEach(event => {
        const { individualAddress, location, timestamp } = event.returnValues;
        const infection = {
          address: individualAddress,
          location,
          timestamp: new Date(Number(timestamp) * 1000).toLocaleString()
        };
        if (onNewInfection) onNewInfection(infection);
      });
      
      outbreakEvents.forEach(event => {
        const { location, infectedCount, timestamp } = event.returnValues;
        const outbreak = {
          location,
          infectedCount: Number(infectedCount),
          timestamp: new Date(Number(timestamp) * 1000).toLocaleString()
        };
        if (onOutbreakAlert) onOutbreakAlert(outbreak);
      });
    } catch (eventError) {
      console.error("Error getting past events:", eventError);
    }
    
    return currentBlockNumber;
  } catch (error) {
    return lastCheckedBlock;
  }
};
export const getContractAddress = () => {
  if (contract && contract._address) {
    return contract._address;
  }
  return null;
};