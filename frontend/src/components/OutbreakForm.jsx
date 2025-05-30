import React, { useState } from 'react';
import { 
  reportInfection, 
  checkProximity, 
  checkExposureRisk 
} from '../utils/blockchain';

const OutbreakForm = ({ account, locationString, setLocationString, setNotification, setExposureData, onFormSubmit }) => {
  const [individualAddress, setIndividualAddress] = useState('');
  const [testResult, setTestResult] = useState(false);
  const [timeThreshold, setTimeThreshold] = useState(14);
  const [isLoading, setIsLoading] = useState(false);
  const [proximityChecked, setProximityChecked] = useState(false);
  const [proximityResult, setProximityResult] = useState(null);

  const handleReportInfection = async () => {
    try {
      setIsLoading(true);
      await reportInfection(
        individualAddress || account,
        locationString,
        testResult
      );
      if (onFormSubmit) {
        onFormSubmit({
          type: 'success',
          message: "Infection reported successfully!"
        });
      } else {
        setNotification({
          type: 'success',
          message: "Infection reported successfully!"
        });
      }
    } catch (error) {
      console.error("Error reporting infection:", error);
      setNotification({
        type: 'error',
        message: "Error reporting infection: " + error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckLocation = async () => {
    try {
      setIsLoading(true);
      setProximityChecked(false);
      setProximityResult(null);
      
      const result = await checkProximity(locationString);
      
      // Enhanced proximity result handling
      const proximity = {
        isNearOutbreak: result[0] || result.isNearOutbreak,
        outbreakLocation: result[1] || result.outbreakLocation,
        infectedCount: parseInt(result[2] || result.infectedCount || 0),
        distance: parseInt(result[3] || result.distance || 0)
      };
      
      setProximityResult(proximity);
      setProximityChecked(true);
      
      if (proximity.isNearOutbreak) {
        const distanceKm = (proximity.distance / 1000).toFixed(2);
        setNotification({
          type: 'warning',
          message: `Warning! You are ${distanceKm}km from an outbreak area: ${proximity.outbreakLocation} with ${proximity.infectedCount} cases.`
        });
      } else {
        setNotification({
          type: 'info',
          message: "You are not near any known outbreak areas."
        });
      }
    } catch (error) {
      console.error("Error checking location:", error);
      setNotification({
        type: 'error',
        message: "Error checking location proximity: " + error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckExposureRisk = async () => {
    try {
      setIsLoading(true);
      // Convert days to seconds
      const thresholdInSeconds = timeThreshold * 24 * 60 * 60;
      const result = await checkExposureRisk(locationString, thresholdInSeconds);
      
      // Only update exposure data if there's actual exposure
      if (result.exposed && parseInt(result.exposureCount) > 0) {
        setExposureData({ 
          exposed: true, 
          exposureCount: parseInt(result.exposureCount) 
        });
        
        setNotification({
          type: 'warning',
          message: `Warning! You have potential exposure to ${result.exposureCount.toString()} infected individuals in the last ${timeThreshold} days.`,
          details: {
            timeThreshold: timeThreshold,
            exposureCount: parseInt(result.exposureCount),
            location: locationString
          }
        });
      } else {
        // Reset exposure data if no exposure
        setExposureData({ 
          exposed: false, 
          exposureCount: 0
        });
        
        setNotification({
          type: 'info',
          message: `No exposure to infected individuals detected in the last ${timeThreshold} days at your current location.`
        });
      }
    } catch (error) {
      console.error("Error checking exposure risk:", error);
      setNotification({
        type: 'error',
        message: "Error checking exposure risk: " + error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h2>Report Infection</h2>
      <div className="form-group">
        <label>Individual Address:</label>
        <input
          type="text"
          value={individualAddress}
          onChange={(e) => setIndividualAddress(e.target.value)}
          placeholder="Enter wallet address or leave blank for self"
        />
      </div>

      <div className="form-group">
        <label>Location:</label>
        <input
          type="text"
          value={locationString}
          onChange={(e) => setLocationString(e.target.value)}
          placeholder="latitude,longitude"
        />
      </div>

      <div className="form-group">
        <label>Test Result:</label>
        <select
          value={testResult.toString()}
          onChange={(e) => setTestResult(e.target.value === "true")}
        >
          <option value="false">Negative</option>
          <option value="true">Positive</option>
        </select>
      </div>

      <div className="form-group">
        <label>Time Threshold (days):</label>
        <input
          type="number"
          value={timeThreshold}
          onChange={(e) => setTimeThreshold(parseInt(e.target.value) || 14)}
          placeholder="Days to check (default: 14)"
          min="1"
          max="30"
        />
      </div>

      <button
        className="btn"
        onClick={handleReportInfection}
        disabled={isLoading}
      >
        {isLoading ? 'Processing...' : 'Report Infection'}
      </button>

      <div className="action-buttons">
        <button
          className="btn secondary"
          onClick={handleCheckLocation}
          disabled={isLoading}
          title="Check if you are near any outbreak zones (5km radius)"
        >
          Check Nearby Outbreaks
        </button>
        <button
          className="btn secondary"
          onClick={handleCheckExposureRisk}
          disabled={isLoading}
          title="Check if you were near infected individuals in the specified time period"
        >
          Check Exposure History
        </button>
      </div>
      
      {proximityChecked && proximityResult && (
        <div className={`proximity-result ${proximityResult.isNearOutbreak ? 'proximity-warning' : 'proximity-safe'}`}>
          {proximityResult.isNearOutbreak ? (
            <>
              <span className="proximity-icon">⚠️</span>
              <div>
                <p><strong>Outbreak Nearby!</strong></p>
                <p>Distance: {(proximityResult.distance / 1000).toFixed(2)}km</p>
                <p>Cases: {proximityResult.infectedCount}</p>
              </div>
            </>
          ) : (
            <>
              <span className="proximity-icon">✓</span>
              <p>No outbreaks detected nearby</p>
            </>
          )}
        </div>
      )}
      
      <div className="function-explanation">
        <h4>About these functions:</h4>
        <p><strong>Check Nearby Outbreaks:</strong> Shows if there are any active outbreak areas within 5km of your current location.</p>
        <p><strong>Check Exposure History:</strong> Analyzes if you may have been in the same location as infected individuals within the Threshold time period.</p>
      </div>
    </div>
  );
};

export default OutbreakForm;