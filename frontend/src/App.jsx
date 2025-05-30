import React, { useState, useEffect } from "react";
import "./App.css";
import Map from "./components/Map";
import OutbreakForm from "./components/OutbreakForm";
import Notifications from "./components/Notifications";
import AdminPanel from "./components/AdminPanel";
import { 
  initializeEthers, 
  connectWallet,
  pollForEvents,
  getAllOutbreakLocations,
  checkWeb3Status
} from "./utils/blockchain";
import createSafeEventSubscription from './utils/eventHelper';

function App() {
  const [account, setAccount] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [userLocation, setUserLocation] = useState({ lat: 0, lng: 0 });
  const [locationString, setLocationString] = useState("");
  const [outbreakLocations, setOutbreakLocations] = useState([]);
  const [infections, setInfections] = useState([]);
  const [notification, setNotification] = useState("");
  const [exposureData, setExposureData] = useState({ exposed: false, exposureCount: 0 });
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [web3Status, setWeb3Status] = useState({
    available: false,
    connected: false,
    account: null,
    networkId: null,
    errorMessage: null
  });
  const [connectionRetries, setConnectionRetries] = useState(0);
  const [lastCheckedBlock, setLastCheckedBlock] = useState(0);
  const [usingEventPolling, setUsingEventPolling] = useState(false);
  const [proximityAlert, setProximityAlert] = useState(null);

  const isMountedRef = React.useRef(true);
  const cleanupListenersRef = React.useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        if (isMountedRef.current) {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setLocationString(`${latitude},${longitude}`);
        }
      });
    }

    // Check if wallet is already connected
    const checkIfWalletIsConnected = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({
            method: "eth_accounts",
          });

          if (accounts.length > 0 && isMountedRef.current) {
            setAccount(accounts[0]);
            setIsConnected(true);
            await initializeBlockchain();
          }
        } catch (error) {
          console.error("Error connecting to MetaMask", error);
          if (isMountedRef.current) {
            setNotification({
              type: 'error',
              message: `MetaMask connection error: ${error.message}`
            });
          }
        }
      }
    };

    checkIfWalletIsConnected();
    
    return () => {
      isMountedRef.current = false;
      
      if (cleanupListenersRef.current) {
        cleanupListenersRef.current();
      }
    };
  }, []);

  useEffect(() => {
    let pollingInterval = null;
    
    if (isConnected && usingEventPolling) {
      pollingInterval = setInterval(async () => {
        if (!isMountedRef.current) return;
        
        try {
          const newLastBlock = await pollForEvents(
            lastCheckedBlock,
            handleNewInfection,
            (outbreak) => {
              if (isMountedRef.current) {
                setNotification({
                  type: 'warning',
                  message: `Potential outbreak alert! ${outbreak.infectedCount} cases at ${outbreak.location}`
                });
                fetchOutbreakLocations();
              }
            }
          );
          
          if (isMountedRef.current) {
            setLastCheckedBlock(newLastBlock);
          }
        } catch (error) {
          console.error("Error polling for events:", error);
        }
      }, 15000);
    }
    
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [isConnected, usingEventPolling]);

  const initializeBlockchain = async () => {
    try {
      const { contract } = await initializeEthers();
      
      try {
        if (cleanupListenersRef.current) {
          cleanupListenersRef.current();
        }
        
        const newInfectionSub = createSafeEventSubscription(
          contract,
          'NewInfection',
          {},
          (event) => {
            const { individualAddress, location, timestamp } = event.returnValues;
            const infection = {
              address: individualAddress,
              location,
              timestamp: new Date(timestamp * 1000).toLocaleString()
            };
            
            handleNewInfection(infection);
          },
          (error) => {
            console.error("New infection event error:", error);
          }
        );
        
        const outbreakSub = createSafeEventSubscription(
          contract,
          'PotentialOutbreak',
          {},
          (event) => {
            const { location, infectedCount, timestamp } = event.returnValues;
            const outbreak = {
              location,
              infectedCount: parseInt(infectedCount),
              timestamp: new Date(timestamp * 1000).toLocaleString()
            };
            
            if (isMountedRef.current) {
              setNotification({
                type: 'warning',
                message: `Potential outbreak alert! ${outbreak.infectedCount} cases at ${outbreak.location}`
              });
              fetchOutbreakLocations();
            }
          },
          (error) => {
            console.error("Potential outbreak event error:", error);
          }
        );
        
        // Add ProximityAlert event listener
        const proximityAlertSub = createSafeEventSubscription(
          contract,
          'ProximityAlert',
          {},
          (event) => {
            const { user, userLocation, outbreakLocation, distance } = event.returnValues;
            
            // Only show alerts for the current user
            if (user.toLowerCase() === account.toLowerCase()) {
              const distanceKm = (parseInt(distance) / 1000).toFixed(2);
              
              if (isMountedRef.current) {
                setNotification({
                  type: 'alert',
                  message: `PROXIMITY ALERT: You are ${distanceKm}km from an outbreak area at ${outbreakLocation}`,
                  details: {
                    userLocation,
                    outbreakLocation,
                    distance: parseInt(distance)
                  }
                });
                setProximityAlert({
                  userLocation,
                  outbreakLocation,
                  distance: parseInt(distance)
                });
              }
            }
          },
          (error) => {
            console.error("Proximity alert event error:", error);
          }
        );
        
        cleanupListenersRef.current = () => {
          newInfectionSub.unsubscribe();
          outbreakSub.unsubscribe();
          proximityAlertSub.unsubscribe();
        };
        
        setUsingEventPolling(!newInfectionSub.isActive || !outbreakSub.isActive || !proximityAlertSub.isActive);
      } catch (eventError) {
        console.error("Event setup failed, falling back to polling:", eventError);
        
        if (isMountedRef.current) {
          setUsingEventPolling(true);
        }
      }

      fetchOutbreakLocations().catch(error => {
        console.error("Initial data fetch failed:", error);
      });
    } catch (error) {
      console.error("Error initializing blockchain:", error);
      
      if (isMountedRef.current) {
        setNotification({
          type: 'error',
          message: `Blockchain initialization error: ${error.message}`
        });
      }
    }
  };

  const fetchOutbreakLocations = async () => {
    if (!isMountedRef.current) return;
    
    try {
      setIsLoading(true);
      
      const status = await checkWeb3Status();
      
      if (isMountedRef.current) {
        setWeb3Status(status);
        
        if (status.connected) {
          try {
            const data = await getAllOutbreakLocations();
            
            if (data && Array.isArray(data.locations)) {
              if (data.locations.length > 0) {
                const uniqueLocations = {};
                
                data.locations.forEach(loc => {
                  const key = loc.id || loc.location;
                  if (!uniqueLocations[key] || loc.infectedCount > uniqueLocations[key].infectedCount) {
                    uniqueLocations[key] = loc;
                  }
                });
                
                const deduplicatedLocations = Object.values(uniqueLocations);
                
                setOutbreakLocations(deduplicatedLocations);
                setNotification({
                  type: 'success',
                  message: `Loaded ${deduplicatedLocations.length} outbreak locations`
                });
              } else {
                setOutbreakLocations([]);
                setNotification({
                  type: 'info',
                  message: 'No outbreak locations found'
                });
              }
            } else {
              console.warn("Received invalid outbreak locations data:", data);
              setOutbreakLocations([]);
              setNotification({
                type: 'warning',
                message: 'Unable to load outbreak data'
              });
            }
          } catch (dataError) {
            console.error("Error loading outbreak data:", dataError);
            
            setNotification({
              type: 'error',
              message: `Error loading data: ${dataError.message}`
            });
          }
        } else {
          setNotification({
            type: 'error',
            message: status.errorMessage || 'Failed to connect to blockchain. Please check your connection settings.'
          });
          
          if (connectionRetries < 3) {
            setConnectionRetries(prev => prev + 1);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching outbreak locations:", error);
      
      if (isMountedRef.current) {
        setNotification({
          type: 'error',
          message: `Connection error: ${error.message}`
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleConnectWallet = async () => {
    try {
      const addr = await connectWallet();
      setAccount(addr);
      setIsConnected(true);
      await initializeBlockchain();
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setNotification("Error connecting wallet: " + error.message);
    }
  };

  const handleFormSubmit = (newNotification) => {
    setNotification(newNotification);
    
    if (newNotification.type === 'success') {
      refreshOutbreakLocations();
    }
  };
  
  const refreshOutbreakLocations = async () => {
    try {
      setIsLoading(true);
      const data = await getAllOutbreakLocations();
      setOutbreakLocations(data.locations);
    } catch (error) {
      console.error("Error refreshing data:", error);
      setNotification({
        type: 'error',
        message: `Failed to refresh data: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const clearNotification = () => {
    setNotification("");
  };
  
  const handleRetryConnection = () => {
    fetchOutbreakLocations();
  };

  const handleNewInfection = (infection) => {
    if (isMountedRef.current) {
      setInfections(prev => {
        const isDuplicate = prev.some(
          inf => inf.address === infection.address && 
                 inf.location === infection.location
        );
        
        if (!isDuplicate) {
          setNotification({
            type: 'info',
            message: `New infection reported at ${infection.location}`
          });
          return [...prev, infection];
        }
        return prev;
      });
    }
  };

  useEffect(() => {
    // Clear proximity alert after 30 seconds
    if (proximityAlert) {
      const timer = setTimeout(() => {
        setProximityAlert(null);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [proximityAlert]);

  // Modify the handleNotification logic
  const handleNotification = (newNotification) => {
    setNotification(newNotification);
    
    // If this is a proximity alert, update the proximity alert state
    if (newNotification.type === 'alert' && newNotification.details) {
      setProximityAlert(newNotification.details);
    }
    
    if (newNotification.type === 'success') {
      refreshOutbreakLocations();
    }
  };
  
  return (
    <div className="App">
      <header className="App-header">
        <h1>Blockchain-Based Epidemic Outbreak Tracking</h1>
        <div className="header-controls">
          {!isConnected ? (
            <button className="btn" onClick={handleConnectWallet}>
              Connect Wallet
            </button>
          ) : (
            <>
              <p>Connected: {account.substring(0, 6)}...{account.substring(account.length - 4)}</p>
              {web3Status.networkId && (
                <span className="network-info">Network ID: {web3Status.networkId}</span>
              )}
              {usingEventPolling && (
                <span className="polling-info">(Event Polling Active)</span>
              )}
              <button 
                className="btn admin-toggle" 
                onClick={() => setIsAdmin(!isAdmin)}
                style={{ marginLeft: '10px' }}
              >
                {isAdmin ? "User View" : "Admin View"}
              </button>
            </>
          )}
        </div>
      </header>

      <main className="container">
        {notification && (
          <Notifications 
            type={notification.type} 
            message={notification.message} 
            details={notification.details}
            onClose={clearNotification}
            onRetry={notification.type === 'error' ? handleRetryConnection : null}
          />
        )}

        {isAdmin && isConnected ? (
          <AdminPanel 
            outbreakLocations={outbreakLocations} 
            infections={infections}
            fetchOutbreakLocations={fetchOutbreakLocations}
          />
        ) : (
          <>
            <div className="grid">
              <OutbreakForm
                userLocation={userLocation}
                setUserLocation={setUserLocation}
                setInfections={setInfections}
                setOutbreakLocations={setOutbreakLocations}
                setIsConnected={setIsConnected}
                setAccount={setAccount}
                setExposureData={setExposureData}
                setLocationString={setLocationString}
                setIsAdmin={setIsAdmin}
                account={account}
                locationString={locationString}
                setNotification={handleNotification}
                isLoading={isLoading}
                onFormSubmit={handleNotification}
              />
              <Map
                userLocation={userLocation}
                outbreakLocations={outbreakLocations}
                proximityAlert={proximityAlert}
                isLoading={isLoading}
              />
            </div>

            {exposureData.exposed && (
              <div className="exposure-alert">
                <h3>Exposure Risk Alert</h3>
                <p>You may have been exposed to {exposureData.exposureCount} infected individuals.</p>
                <p>Please consider getting tested and limiting your movements.</p>
              </div>
            )}

            <div className="data-section">
              <h2>Recent Infections</h2>
              <div className="data-list">
                {infections.length > 0 ? (
                  infections.map((inf, idx) => (
                    <div key={idx} className="data-item">
                      <p>
                        <strong>Address:</strong> {inf.address.substring(0, 6)}...
                        {inf.address.substring(inf.address.length - 4)}
                      </p>
                      <p>
                        <strong>Location:</strong> {inf.location}
                      </p>
                      <p>
                        <strong>Time:</strong> {inf.timestamp}
                      </p>
                    </div>
                  ))
                ) : (
                  <p>No infections reported yet</p>
                )}
              </div>

              <h2>Outbreak Locations</h2>
              <div className="data-list">
                {outbreakLocations.length > 0 ? (
                  outbreakLocations.map((loc, idx) => (
                    <div key={idx} className="data-item">
                      <p>
                        <strong>Location:</strong> {loc.location}
                      </p>
                      <p>
                        <strong>Cases:</strong> {loc.infectedCount}
                      </p>
                      <p>
                        <strong>Last update:</strong> {loc.timestamp}
                      </p>
                    </div>
                  ))
                ) : (
                  <p>No outbreak locations reported yet</p>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;