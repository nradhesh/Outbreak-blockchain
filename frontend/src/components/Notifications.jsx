import React, { useState, useEffect } from 'react';

const Notifications = ({ type, message, onClose, onRetry, details }) => {
  const [visible, setVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);
  
  useEffect(() => {
    setVisible(true);
    
    // Auto-hide success notifications after 5 seconds
    if (type === 'success' && onClose) {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300); // Allow time for fade-out animation
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [type, message, onClose]);
  
  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      if (onClose) onClose();
    }, 300); // Allow time for fade-out animation
  };
  
  const handleRetry = () => {
    if (onRetry) onRetry();
  };
  
  // Function to get the appropriate icon based on notification type
  const getIcon = () => {
    switch(type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'alert': return '🔔';
      default: return 'ℹ';
    }
  };
  
  return (
    <div className={`notification ${type} ${visible ? 'visible' : 'hidden'} ${expanded ? 'expanded' : ''}`}>
      <div className="notification-content">
        <span className={`notification-icon ${type}`}>
          {getIcon()}
        </span>
        <span className="notification-message">{message}</span>
        
        <div className="notification-actions">
          {details && (
            <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Less' : 'More'}
            </button>
          )}
          {type === 'error' && onRetry && (
            <button className="retry-btn" onClick={handleRetry}>
              Retry
            </button>
          )}
          <button className="close-btn" onClick={handleClose}>
            ×
          </button>
        </div>
      </div>
      
      {expanded && details && (
        <div className="notification-details">
          {details.userLocation && (
            <p><strong>Your location:</strong> {details.userLocation}</p>
          )}
          {details.outbreakLocation && (
            <p><strong>Outbreak location:</strong> {details.outbreakLocation}</p>
          )}
          {details.distance && (
            <p><strong>Distance:</strong> {(details.distance / 1000).toFixed(2)}km</p>
          )}
          {details.infectedCount && (
            <p><strong>Cases:</strong> {details.infectedCount}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;