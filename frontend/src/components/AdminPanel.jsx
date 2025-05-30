import React, { useState, useEffect } from 'react';
import { getInfectedCount } from '../utils/blockchain';

const AdminPanel = ({ outbreakLocations, infections, fetchOutbreakLocations }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [totalInfected, setTotalInfected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const count = await getInfectedCount();
        setTotalInfected(count);
      } catch (error) {
        console.error("Error fetching infected count:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleRefreshData = async () => {
    setLoading(true);
    try {
      await fetchOutbreakLocations();
      const count = await getInfectedCount();
      setTotalInfected(count);
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Function to filter locations based on search term
  const filteredOutbreakLocations = outbreakLocations.filter(location => 
    location.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Function to filter infections based on search term
  const filteredInfections = infections.filter(infection => 
    infection.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    infection.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>Health Official Dashboard</h2>
        <div className="admin-controls">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search by location or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <i className="search-icon">🔍</i>
          </div>
          <button 
            className="refresh-button"
            onClick={handleRefreshData}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '↻ Refresh Data'}
          </button>
        </div>
      </div>
      
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <i className="tab-icon">📊</i> Dashboard
        </button>
        <button 
          className={`tab-button ${activeTab === 'outbreaks' ? 'active' : ''}`}
          onClick={() => setActiveTab('outbreaks')}
        >
          <i className="tab-icon">📍</i> Outbreak Locations
        </button>
        <button 
          className={`tab-button ${activeTab === 'infections' ? 'active' : ''}`}
          onClick={() => setActiveTab('infections')}
        >
          <i className="tab-icon">🏥</i> Infection Reports
        </button>
      </div>
      
      <div className="tab-content">
        {/* DASHBOARD TAB */}
        <div className={`tab-pane ${activeTab === 'dashboard' ? 'active' : 'inactive'}`}>
          <div className="stats-grid">
            <div className="stat-card primary">
              <div className="stat-icon">👥</div>
              <div className="stat-content">
                <h4>Total Infections</h4>
                <p>{totalInfected}</p>
              </div>
            </div>
            <div className="stat-card warning">
              <div className="stat-icon">🔴</div>
              <div className="stat-content">
                <h4>Outbreak Areas</h4>
                <p>{outbreakLocations.length}</p>
              </div>
            </div>
            <div className="stat-card info">
              <div className="stat-icon">📝</div>
              <div className="stat-content">
                <h4>Recent Reports</h4>
                <p>{infections.length}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* OUTBREAKS TAB */}
        <div className={`tab-pane ${activeTab === 'outbreaks' ? 'active' : 'inactive'}`}>
          <div className="table-container">
            <div className="table-header">
              <h3>Outbreak Locations</h3>
              <span className="record-count">{filteredOutbreakLocations.length} locations</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Location (Lat, Long)</th>
                  <th>Infected Count</th>
                  <th>Last Updated</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredOutbreakLocations.map((loc, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'even-row' : 'odd-row'}>
                    <td className="location-cell">{loc.location}</td>
                    <td className="count-cell">{loc.infectedCount}</td>
                    <td>{loc.timestamp}</td>
                    <td>
                      <span className={`status-badge ${loc.infectedCount > 10 ? 'critical' : loc.infectedCount > 5 ? 'warning' : 'normal'}`}>
                        {loc.infectedCount > 10 ? 'Critical' : loc.infectedCount > 5 ? 'Warning' : 'Monitoring'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredOutbreakLocations.length === 0 && (
                  <tr>
                    <td colSpan="4" className="empty-table-message">
                      {searchTerm ? "No matching outbreak locations found" : "No outbreak locations reported yet"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* INFECTIONS TAB */}
        <div className={`tab-pane ${activeTab === 'infections' ? 'active' : 'inactive'}`}>
          <div className="table-container">
            <div className="table-header">
              <h3>Infection Reports</h3>
              <span className="record-count">{filteredInfections.length} reports</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Location</th>
                  <th>Reported Time</th>
                  <th>Verified</th>
                </tr>
              </thead>
              <tbody>
                {filteredInfections.map((inf, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'even-row' : 'odd-row'}>
                    <td className="address-cell">
                      <div className="address-container">
                        <span className="address-text">{inf.address.substring(0, 6)}...{inf.address.substring(inf.address.length - 4)}</span>
                        <button className="copy-btn" onClick={() => navigator.clipboard.writeText(inf.address)}>Copy</button>
                      </div>
                    </td>
                    <td>{inf.location}</td>
                    <td>{inf.timestamp}</td>
                    <td>
                      <span className="verified-badge">
                        <i className="verify-icon">✓</i> Blockchain Verified
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredInfections.length === 0 && (
                  <tr>
                    <td colSpan="4" className="empty-table-message">
                      {searchTerm ? "No matching infection reports found" : "No infections reported yet"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
