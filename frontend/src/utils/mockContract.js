/**
 * Mock contract implementation for testing when no real contract is available
 */

// Mock outbreak data
const mockOutbreakLocations = [
  {
    location: "40.7128,-74.0060", // New York
    infectedCount: 8,
    timestamp: new Date().toLocaleString()
  },
  {
    location: "34.0522,-118.2437", // Los Angeles
    infectedCount: 12,
    timestamp: new Date().toLocaleString()
  }
];

// Mock infection data
const mockInfections = [
  {
    address: "0x1234567890123456789012345678901234567890",
    location: "40.7128,-74.0060",
    timestamp: new Date().toLocaleString()
  }
];

// Simulate blockchain delay
const simulateDelay = async (min = 500, max = 1500) => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
};

// Create a mock contract with the same interface as the real one
export const createMockContract = () => {
  console.log("Creating mock contract for testing");
  
  return {
    // Mock methods object to match Web3 contract structure
    methods: {
      // Get all outbreak locations
      getAllOutbreakLocations: () => ({
        call: async () => {
          await simulateDelay();
          return {
            locations: mockOutbreakLocations.map(loc => loc.location),
            counts: mockOutbreakLocations.map(loc => loc.infectedCount)
          };
        }
      }),
      
      // Get infected count
      getInfectedCount: () => ({
        call: async () => {
          await simulateDelay();
          return mockInfections.length;
        }
      }),
      
      // Get outbreak locations count
      getOutbreakLocationsCount: () => ({
        call: async () => {
          await simulateDelay();
          return mockOutbreakLocations.length;
        }
      }),
      
      // Check proximity
      checkProximity: (location) => ({
        call: async () => {
          await simulateDelay();
          // Simulate finding nearby location 30% of the time
          if (Math.random() < 0.3) {
            const nearbyLocation = mockOutbreakLocations[0];
            return [
              true, 
              nearbyLocation.location,
              nearbyLocation.infectedCount,
              Math.floor(Math.random() * 5000)
            ];
          }
          return [false, "", 0, 0];
        }
      }),
      
      // Report new location
      reportNewLocation: (location) => ({
        send: async () => {
          await simulateDelay();
          return { status: true };
        }
      }),
      
      // Report infection
      reportInfection: (address, location, testResult) => ({
        send: async () => {
          await simulateDelay();
          if (testResult) {
            // Add to mock infections
            mockInfections.push({
              address,
              location,
              timestamp: new Date().toLocaleString()
            });
          }
          return { status: true };
        }
      }),
      
      // Check exposure risk
      checkExposureRisk: (location, timeThreshold) => ({
        call: async () => {
          await simulateDelay();
          // Simulate finding exposure 20% of the time
          if (Math.random() < 0.2) {
            const exposureCount = Math.floor(Math.random() * 3) + 1;
            return {
              exposed: true,
              exposureCount
            };
          }
          return {
            exposed: false,
            exposureCount: 0
          };
        }
      }),
      
      // Owner method
      owner: () => ({
        call: async () => {
          await simulateDelay();
          return "0x0000000000000000000000000000000000000000";
        }
      })
    },
    
    // Mock events object
    events: {
      // New infection event
      NewInfection: (options) => {
        return {
          on: (event, callback) => {
            if (event === 'connected') {
              callback("mock-subscription-id");
            }
            return this;
          }
        };
      },
      
      // Potential outbreak event
      PotentialOutbreak: (options) => {
        return {
          on: (event, callback) => {
            if (event === 'connected') {
              callback("mock-subscription-id");
            }
            return this;
          }
        };
      }
    },
    
    // Mock getPastEvents
    getPastEvents: async (eventName, options) => {
      await simulateDelay();
      
      if (eventName === 'NewInfection') {
        return mockInfections.map(inf => ({
          returnValues: {
            individualAddress: inf.address,
            location: inf.location,
            timestamp: Math.floor(new Date(inf.timestamp).getTime() / 1000)
          }
        }));
      } else if (eventName === 'PotentialOutbreak') {
        return mockOutbreakLocations.map(loc => ({
          returnValues: {
            location: loc.location,
            infectedCount: loc.infectedCount,
            timestamp: Math.floor(new Date(loc.timestamp).getTime() / 1000)
          }
        }));
      }
      
      return [];
    },
    
    // Store the mock address
    _address: "0xMockContractAddress",
    
    // Flag to identify this as a mock contract
    isMockContract: true
  };
};
