import React, { useState, useEffect } from 'react';
import { verifyDeployment, findContractDeployments } from '../utils/deployVerifier';
import { verifyContractDeployment } from '../utils/contractVerifier';
import { OUTBREAK_CONTRACT_ADDRESS } from '../utils/contractConfig';
import { 
  checkContractHealth, 
  forceUpdateContractAddress, 
  getForcedContractAddress,
  clearForcedContractAddress
} from '../utils/contractHealthCheck';

const ContractDebug = () => {
  const [deploymentInfo, setDeploymentInfo] = useState(null);
  const [contractInfo, setContractInfo] = useState(null);
  const [deployments, setDeployments] = useState([]);
  const [healthCheck, setHealthCheck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customAddress, setCustomAddress] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [forcedAddress, setForcedAddress] = useState(getForcedContractAddress());

  useEffect(() => {
    checkDeployment();
  }, []);

  const checkDeployment = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Run the contract health check
      const health = await checkContractHealth();
      setHealthCheck(health);
      
      // Update forced address display
      setForcedAddress(getForcedContractAddress());
      
      // Verify main deployment
      const info = await verifyDeployment();
      setDeploymentInfo(info);
      
      // Also check the contract at our configured address
      const contractCheck = await verifyContractDeployment(OUTBREAK_CONTRACT_ADDRESS);
      setContractInfo(contractCheck);
      
      // Find all deployments
      const allDeployments = await findContractDeployments();
      setDeployments(allDeployments);
    } catch (err) {
      console.error("Contract verification error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const verifyCustomAddress = async () => {
    if (!customAddress) {
      setVerifyResult({ error: 'Please enter a contract address' });
      return;
    }
    
    try {
      setVerifyResult({ loading: true });
      const result = await verifyContractDeployment(customAddress);
      setVerifyResult(result);
    } catch (err) {
      setVerifyResult({ error: err.message });
    }
  };
  
  const handleForceAddress = (address) => {
    if (forceUpdateContractAddress(address)) {
      setForcedAddress(address);
      
      // Show a success notification
      setError('Contract address override set. Refresh the page to use the new address.');
    }
  };
  
  const handleClearForced = () => {
    if (clearForcedContractAddress()) {
      setForcedAddress(null);
      
      // Show a success notification
      setError('Contract address override cleared. Refresh the page to use the default address.');
    }
  };

  if (loading) {
    return <div className="contract-debug"><p>Loading contract information...</p></div>;
  }

  return (
    <div className="contract-debug">
      <h2>Contract Deployment Debug</h2>
      
      {error && (
        <div className="error-message">
          <h3>Message</h3>
          <p>{error}</p>
        </div>
      )}
      
      {forcedAddress && (
        <div className="forced-address-alert">
          <h3>⚠️ Contract Address Override Active</h3>
          <p>Using forced address: <strong>{forcedAddress}</strong></p>
          <button onClick={handleClearForced} className="danger-btn">
            Clear Override
          </button>
        </div>
      )}
      
      <div className="contract-health">
        <h3>Contract Health Check</h3>
        {healthCheck ? (
          <div>
            <p><strong>Status:</strong> {healthCheck.status}</p>
            <p><strong>Web3 Available:</strong> {healthCheck.web3Available ? 'Yes' : 'No'}</p>
            
            {healthCheck.networkInfo && (
              <div>
                <h4>Network Information</h4>
                <p><strong>Network ID:</strong> {healthCheck.networkInfo.networkId}</p>
                <p><strong>Network Type:</strong> {healthCheck.networkInfo.networkType}</p>
                <p><strong>Latest Block:</strong> {healthCheck.networkInfo.latestBlock}</p>
                <p><strong>Gas Price:</strong> {healthCheck.networkInfo.gasPrice}</p>
              </div>
            )}
            
            {healthCheck.deployments && (
              <div>
                <h4>Deployment Information</h4>
                <p><strong>Current Network ID:</strong> {healthCheck.deployments.currentNetworkId}</p>
                <p><strong>Configured Address:</strong> {healthCheck.deployments.configuredAddress}</p>
                
                {healthCheck.deployments.recommendedAddress && (
                  <p>
                    <strong>Recommended Address:</strong> {healthCheck.deployments.recommendedAddress}
                    <button 
                      onClick={() => handleForceAddress(healthCheck.deployments.recommendedAddress)}
                      className="small-btn"
                      style={{ marginLeft: '10px' }}
                    >
                      Use This
                    </button>
                  </p>
                )}
                
                <h4>Valid Deployments ({healthCheck.deployments.validDeployments.length})</h4>
                {healthCheck.deployments.validDeployments.length > 0 ? (
                  <ul className="deployment-list">
                    {healthCheck.deployments.validDeployments.map((dep, idx) => (
                      <li key={idx}>
                        <span>{dep.address}</span>
                        <button 
                          onClick={() => handleForceAddress(dep.address)}
                          className="small-btn"
                        >
                          Use This
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No valid deployments found</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <p>No health check information available</p>
        )}
      </div>
      
      <div className="deployment-info">
        <h3>Current Deployment</h3>
        {deploymentInfo ? (
          <div>
            <p><strong>Success:</strong> {deploymentInfo.success ? 'Yes' : 'No'}</p>
            {deploymentInfo.error && <p><strong>Error:</strong> {deploymentInfo.error}</p>}
            <p><strong>Network ID:</strong> {deploymentInfo.networkId}</p>
            <p><strong>Address:</strong> {deploymentInfo.address}</p>
            {deploymentInfo.owner && <p><strong>Owner:</strong> {deploymentInfo.owner}</p>}
            {deploymentInfo.radius && <p><strong>Outbreak Radius:</strong> {deploymentInfo.radius} meters</p>}
          </div>
        ) : (
          <p>No deployment information available</p>
        )}
      </div>
      
      <div className="contract-info">
        <h3>Contract at Config Address</h3>
        <p><strong>Config Address:</strong> {OUTBREAK_CONTRACT_ADDRESS}</p>
        {contractInfo ? (
          <div>
            <p><strong>Exists:</strong> {contractInfo.exists ? 'Yes' : 'No'}</p>
            <p><strong>Compatible:</strong> {contractInfo.isCompatible ? 'Yes' : 'No'}</p>
            {contractInfo.infectedCount !== undefined && (
              <p><strong>Infected Count:</strong> {contractInfo.infectedCount}</p>
            )}
            {contractInfo.error && <p><strong>Error:</strong> {contractInfo.error}</p>}
            {contractInfo.methods && (
              <div>
                <p><strong>Available Methods:</strong></p>
                <ul>
                  {contractInfo.methods.map((method, idx) => (
                    <li key={idx}>{method}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p>No contract information available</p>
        )}
      </div>
      
      <div className="verify-custom">
        <h3>Verify Custom Address</h3>
        <div className="input-group">
          <input 
            type="text" 
            value={customAddress} 
            onChange={(e) => setCustomAddress(e.target.value)}
            placeholder="Enter contract address"
          />
          <button onClick={verifyCustomAddress}>Verify</button>
        </div>
        
        {verifyResult && (
          <div className="verify-result">
            {verifyResult.loading ? (
              <p>Verifying...</p>
            ) : verifyResult.error ? (
              <p className="error">{verifyResult.error}</p>
            ) : (
              <div>
                <p><strong>Exists:</strong> {verifyResult.exists ? 'Yes' : 'No'}</p>
                <p><strong>Compatible:</strong> {verifyResult.isCompatible ? 'Yes' : 'No'}</p>
                {verifyResult.infectedCount !== undefined && (
                  <p><strong>Infected Count:</strong> {verifyResult.infectedCount}</p>
                )}
                {verifyResult.methods && verifyResult.methods.length > 0 && (
                  <details>
                    <summary>Available Methods ({verifyResult.methods.length})</summary>
                    <ul>
                      {verifyResult.methods.map((method, idx) => (
                        <li key={idx}>{method}</li>
                      ))}
                    </ul>
                  </details>
                )}
                
                {verifyResult.exists && verifyResult.isCompatible && (
                  <button 
                    onClick={() => handleForceAddress(customAddress)}
                    className="force-btn"
                  >
                    Use This Address
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="all-deployments">
        <h3>All Contract Deployments</h3>
        {deployments.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Network ID</th>
                <th>Address</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((dep, idx) => (
                <tr key={idx} className={dep.isCurrent ? 'current-network' : ''}>
                  <td>{dep.networkId}</td>
                  <td>{dep.address}</td>
                  <td>
                    {dep.error ? (
                      <span className="error">Error: {dep.error}</span>
                    ) : dep.exists ? (
                      <span className="success">Available</span>
                    ) : (
                      <span className="warning">No Contract</span>
                    )}
                    {dep.isCurrent && <span className="current"> (current)</span>}
                  </td>
                  <td>
                    {dep.exists && (
                      <button 
                        onClick={() => handleForceAddress(dep.address)}
                        className="small-btn"
                      >
                        Use This
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No deployments found</p>
        )}
      </div>
      
      <button onClick={checkDeployment} className="refresh-btn">
        Refresh Information
      </button>

      <style dangerouslySetInnerHTML={{__html: `
        .contract-debug {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }
        
        .error-message {
          background: #f8d7da;
          border: 1px solid #f5c6cb;
          border-radius: 4px;
          padding: 10px;
          margin-bottom: 15px;
        }
        
        .forced-address-alert {
          background: #fff3cd;
          border: 1px solid #ffecb5;
          border-radius: 4px;
          padding: 10px;
          margin-bottom: 15px;
        }
        
        .deployment-info, .contract-info, .all-deployments, .verify-custom, .contract-health {
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          padding: 15px;
          margin-bottom: 15px;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
        }
        
        th, td {
          border: 1px solid #dee2e6;
          padding: 8px;
          text-align: left;
        }
        
        th {
          background-color: #f2f2f2;
        }
        
        .current-network {
          background-color: #e8f4f8;
        }
        
        .success {
          color: green;
        }
        
        .warning {
          color: orange;
        }
        
        .error {
          color: red;
        }
        
        .current {
          font-weight: bold;
        }
        
        .refresh-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 15px;
          border-radius: 4px;
          cursor: pointer;
          margin-right: 10px;
        }
        
        .danger-btn {
          background: #dc3545;
          color: white;
          border: none;
          padding: 10px 15px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
        }
        
        .force-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
        }
        
        .small-btn {
          background: #6c757d;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        
        .input-group {
          display: flex;
          margin-bottom: 10px;
        }
        
        .input-group input {
          flex: 1;
          padding: 8px;
          border: 1px solid #ced4da;
          border-radius: 4px 0 0 4px;
        }
        
        .input-group button {
          background: #6c757d;
          color: white;
          border: none;
          padding: 8px 15px;
          border-radius: 0 4px 4px 0;
          cursor: pointer;
        }
        
        .deployment-list {
          list-style: none;
          padding: 0;
        }
        
        .deployment-list li {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px;
          border-bottom: 1px solid #eee;
        }
        
        .deployment-list li:last-child {
          border-bottom: none;
        }
      `}} />
    </div>
  );
};

export default ContractDebug;
