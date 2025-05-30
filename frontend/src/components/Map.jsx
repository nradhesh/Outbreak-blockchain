import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Tooltip, useMap } from 'react-leaflet';
import "leaflet/dist/leaflet.css";
import L from 'leaflet';

// Fix for Leaflet marker icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

// Custom icons for different markers
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const outbreakIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Add animation for proximity pulse
const ProximityPulse = ({ position, color = 'red', animate = true }) => {
  const [radius, setRadius] = useState(100);
  const [opacity, setOpacity] = useState(0.6);
  
  useEffect(() => {
    if (!animate) return;
    
    const interval = setInterval(() => {
      setRadius(prev => {
        if (prev >= 1500) return 100;
        return prev + 50;
      });
      
      setOpacity(prev => {
        if (prev <= 0.1) return 0.6;
        return prev - 0.02;
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [animate]);
  
  return (
    <Circle
      center={position}
      radius={radius}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: opacity,
        weight: 1
      }}
    />
  );
};

// Map view control component
const MapViewController = ({ center, zoom, shouldUpdate }) => {
  const map = useMap();
  
  useEffect(() => {
    if (shouldUpdate && center[0] !== 0 && center[1] !== 0) {
      map.flyTo(center, zoom);
    }
  }, [center, zoom, shouldUpdate, map]);
  
  return null;
};

const OutbreakMap = ({ userLocation, outbreakLocations, proximityAlert = null, isLoading }) => {
  const [mapCenter, setMapCenter] = useState([0, 0]);
  const [mapZoom, setMapZoom] = useState(13);
  const [shouldUpdateView, setShouldUpdateView] = useState(false);
  
  const parseLocationString = (locString) => {
    try {
      const [lat, lng] = locString.split(',').map(parseFloat);
      return isNaN(lat) || isNaN(lng) ? [0, 0] : [lat, lng];
    } catch {
      return [0, 0];
    }
  };

  // Determine appropriate zoom level and center
  useEffect(() => {
    let newCenter = [userLocation.lat, userLocation.lng];
    let newZoom = 13;
    
    if (outbreakLocations.length === 0) {
      // Just use user location
    } else {
      // If we have outbreak locations, try to fit all points
      const points = [
        [userLocation.lat, userLocation.lng],
        ...outbreakLocations.map(loc => parseLocationString(loc.location))
      ].filter(point => point[0] !== 0 && point[1] !== 0);
      
      // If we only have the user location, center on it
      if (points.length <= 1) {
        // Use defaults
      } else {
        // Otherwise, calculate the center by averaging all points
        const lats = points.map(p => p[0]);
        const lngs = points.map(p => p[1]);
        
        newCenter = [
          lats.reduce((a, b) => a + b, 0) / lats.length,
          lngs.reduce((a, b) => a + b, 0) / lngs.length
        ];
        newZoom = 11; // A bit zoomed out to show multiple points
      }
    }
    
    // If there's a proximity alert, focus on it
    if (proximityAlert && proximityAlert.outbreakLocation) {
      const alertLocation = parseLocationString(proximityAlert.outbreakLocation);
      if (alertLocation[0] !== 0) {
        newCenter = alertLocation;
        newZoom = 12;
      }
    }
    
    setMapCenter(newCenter);
    setMapZoom(newZoom);
    setShouldUpdateView(true);
    
    // Reset the flag after a delay
    const timer = setTimeout(() => {
      setShouldUpdateView(false);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [userLocation, outbreakLocations, proximityAlert]);

  return (
    <div className="map-container">
      <h2>Outbreak Map</h2>
      {userLocation.lat !== 0 && (
        <MapContainer
          center={[userLocation.lat, userLocation.lng]}
          zoom={13}
          style={{ height: "400px", width: "100%" }}
        >
          <MapViewController 
            center={mapCenter} 
            zoom={mapZoom} 
            shouldUpdate={shouldUpdateView} 
          />
          
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {/* User location */}
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
            <Popup>Your location</Popup>
            <Tooltip direction="top" offset={[0, -20]} opacity={1} permanent>
              You are here
            </Tooltip>
          </Marker>
          
          {/* User safety radius */}
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={1000} // 1km safety check radius
            pathOptions={{ 
              color: "blue", 
              fillColor: "blue", 
              fillOpacity: 0.05,
              weight: 1,
              dashArray: "5, 5"
            }}
          >
            <Popup>Your 1km proximity zone</Popup>
          </Circle>

          {/* Outbreak locations */}
          {outbreakLocations.map((loc, idx) => {
            const [lat, lng] = parseLocationString(loc.location);
            
            // Skip invalid coordinates
            if (lat === 0 && lng === 0) return null;
            
            // Check if this is the outbreak location from a proximity alert
            const isAlertedLocation = proximityAlert && 
                                     proximityAlert.outbreakLocation === loc.location;
            
            return (
              <React.Fragment key={idx}>
                <Marker position={[lat, lng]} icon={outbreakIcon}>
                  <Popup>
                    <strong>Outbreak Area</strong><br/>
                    Cases: {loc.infectedCount}<br/>
                    Reported: {loc.timestamp}
                  </Popup>
                  <Tooltip direction="top" opacity={0.7}>
                    {loc.infectedCount} cases
                  </Tooltip>
                </Marker>
                
                {/* Outbreak radius */}
                <Circle
                  center={[lat, lng]}
                  radius={5000} // 5km radius
                  pathOptions={{ 
                    color: isAlertedLocation ? "#ff6b6b" : "red", 
                    fillColor: isAlertedLocation ? "#ff6b6b" : "red", 
                    fillOpacity: isAlertedLocation ? 0.2 : (0.1 + Math.min(0.3, loc.infectedCount / 50)),
                    weight: isAlertedLocation ? 2 : 1
                  }}
                >
                  <Popup>
                    5km radius around outbreak location.<br/>
                    {loc.infectedCount} cases reported.
                  </Popup>
                </Circle>
                
                {/* Add animated pulse if this is the alerted location */}
                {isAlertedLocation && (
                  <ProximityPulse 
                    position={[lat, lng]} 
                    color="#ff6b6b" 
                    animate={true} 
                  />
                )}
              </React.Fragment>
            );
          })}
          
          {/* Line connecting user to nearby outbreak if proximity alert is active */}
          {proximityAlert && proximityAlert.outbreakLocation && (
            (() => {
              const alertLocation = parseLocationString(proximityAlert.outbreakLocation);
              if (alertLocation[0] !== 0) {
                return (
                  <React.Fragment>
                    <Circle
                      center={[userLocation.lat, userLocation.lng]}
                      radius={proximityAlert.distance || 5000}
                      pathOptions={{ 
                        color: "#ff6b6b", 
                        fillColor: "transparent", 
                        weight: 2,
                        dashArray: "10, 10"
                      }}
                    >
                      <Popup>
                        Distance to outbreak: {((proximityAlert.distance || 5000) / 1000).toFixed(2)}km
                      </Popup>
                    </Circle>
                  </React.Fragment>
                );
              }
              return null;
            })()
          )}
        </MapContainer>
      )}
      <div style={{marginTop: '1rem', fontSize: '0.9rem', color: '#666'}}>
        <p>Blue marker: Your location | Red markers: Outbreak areas</p>
        <p>Red circles represent a 5km radius around each outbreak area.</p>
        {proximityAlert && (
          <p className="proximity-alert-legend">
            <span className="alert-dot"></span> 
            Outbreak proximity alert detected! Exercise caution in this area.
          </p>
        )}
      </div>
    </div>
  );
};

export default OutbreakMap;