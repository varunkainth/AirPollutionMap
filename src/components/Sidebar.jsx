import React, { useState } from 'react';
import './Sidebar.css';

function Sidebar({ city, airQualityData, multiLocationData, selectedLocation }) {
  const [activeTab, setActiveTab] = useState('main');

  if (!airQualityData || !airQualityData.list || !airQualityData.list[0]) {
    return (
      <div className="sidebar">
        <h2>{city}</h2>
        <p>No air quality data available</p>
      </div>
    );
  }

  const { components } = airQualityData.list[0];
  
  // AQI categories
  const getAQICategory = (aqi) => {
    if (aqi <= 50) return { label: 'Good', color: '#00e400', description: 'Air quality is considered satisfactory, and air pollution poses little or no risk.' };
    if (aqi <= 100) return { label: 'Moderate', color: '#ffff00', description: 'Air quality is acceptable; however, some pollutants may be a concern for a small number of people who are unusually sensitive to air pollution.' };
    if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', color: '#ff7e00', description: 'Members of sensitive groups may experience health effects. The general public is not likely to be affected.' };
    if (aqi <= 200) return { label: 'Unhealthy', color: '#ff0000', description: 'Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.' };
    if (aqi <= 300) return { label: 'Very Unhealthy', color: '#99004c', description: 'Health warnings of emergency conditions. The entire population is more likely to be affected.' };
    return { label: 'Hazardous', color: '#7e0023', description: 'Health alert: everyone may experience more serious health effects.' };
  };

  // Calculate AQI
  const calculateAQI = (data) => {
    if (!data || !data.list || !data.list[0]) return 0;
    
    const components = data.list[0].components;
    const pm25 = components.pm2_5;
    
    if (pm25 <= 12) return Math.round((pm25 / 12) * 50);
    if (pm25 <= 35.4) return Math.round(((pm25 - 12.1) / 23.3) * 50 + 51);
    if (pm25 <= 55.4) return Math.round(((pm25 - 35.5) / 19.9) * 50 + 101);
    if (pm25 <= 150.4) return Math.round(((pm25 - 55.5) / 94.9) * 50 + 151);
    if (pm25 <= 250.4) return Math.round(((pm25 - 150.5) / 99.9) * 100 + 201);
    return Math.round(((pm25 - 250.5) / 149.9) * 100 + 301);
  };

  const aqi = calculateAQI(airQualityData);
  const aqiInfo = getAQICategory(aqi);
  
  // Function to render AQI comparison chart
  const renderAQIComparisonChart = () => {
    if (!multiLocationData || multiLocationData.length === 0) {
      return <p>No location data available</p>;
    }

    // Sort locations by AQI level (worst to best)
    const sortedLocations = [...multiLocationData]
      .filter(loc => loc.aqiData)
      .sort((a, b) => calculateAQI(b.aqiData) - calculateAQI(a.aqiData));

    return (
      <div className="aqi-comparison-chart">
        {sortedLocations.map((location) => {
          const locationAqi = calculateAQI(location.aqiData);
          const aqiCategory = getAQICategory(locationAqi);
          const percentage = Math.min(100, (locationAqi / 300) * 100);
          
          return (
            <div key={location.id} className="aqi-chart-item">
              <div className="aqi-chart-name">{location.name}</div>
              <div className="aqi-chart-bar-container">
                <div 
                  className="aqi-chart-bar" 
                  style={{ 
                    width: `${percentage}%`, 
                    backgroundColor: aqiCategory.color 
                  }}
                >
                  {locationAqi}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Function to render pollution details for a specific location
  const renderPollutionDetails = (data) => {
    if (!data || !data.list || !data.list[0]) {
      return <p>No detailed pollution data available</p>;
    }

    const { components } = data.list[0];

    return (
      <div className="pollution-details">
        <div className="pollution-item">
          <span className="label">PM2.5:</span>
          <span className="value">{components.pm2_5.toFixed(2)} μg/m³</span>
        </div>
        <div className="pollution-item">
          <span className="label">PM10:</span>
          <span className="value">{components.pm10.toFixed(2)} μg/m³</span>
        </div>
        <div className="pollution-item">
          <span className="label">Ozone (O₃):</span>
          <span className="value">{components.o3.toFixed(2)} μg/m³</span>
        </div>
        <div className="pollution-item">
          <span className="label">Nitrogen Dioxide (NO₂):</span>
          <span className="value">{components.no2.toFixed(2)} μg/m³</span>
        </div>
        <div className="pollution-item">
          <span className="label">Sulfur Dioxide (SO₂):</span>
          <span className="value">{components.so2.toFixed(2)} μg/m³</span>
        </div>
        <div className="pollution-item">
          <span className="label">Carbon Monoxide (CO):</span>
          <span className="value">{components.co.toFixed(2)} μg/m³</span>
        </div>
        <div className="pollution-item">
          <span className="label">Ammonia (NH₃):</span>
          <span className="value">{components.nh3.toFixed(2)} μg/m³</span>
        </div>
      </div>
    );
  };

  // Render content based on active tab
  const renderContent = () => {
    if (activeTab === 'main') {
      return (
        <>
          <div 
            className="aqi-box" 
            style={{ backgroundColor: aqiInfo.color }}
          >
            <div className="aqi-value">{aqi}</div>
            <div className="aqi-label">AQI</div>
            <div className="aqi-category">{aqiInfo.label}</div>
          </div>
          
          <h3>Air Pollution Components</h3>
          {renderPollutionDetails(airQualityData)}
          
          <h3>Health Recommendations</h3>
          <div className="health-recommendations">
            <p>{aqiInfo.description}</p>
            {aqiInfo.label !== 'Good' && (
              <>
                <h4>Precautions:</h4>
                <ul>
                  {aqi > 100 && <li>Consider wearing masks outdoors</li>}
                  {aqi > 150 && <li>Limit outdoor activities</li>}
                  {aqi > 200 && <li>Stay indoors if possible</li>}
                  {aqi > 300 && <li>Keep windows and doors closed</li>}
                  {aqi > 50 && <li>People with respiratory conditions should take extra precautions</li>}
                </ul>
              </>
            )}
          </div>

          <h3>Useful Air Quality Information</h3>
          <div className="information-section">
            <p><strong>Primary Pollutants:</strong> The main pollutants currently are PM2.5 ({components.pm2_5.toFixed(1)} μg/m³) and PM10 ({components.pm10.toFixed(1)} μg/m³).</p>
            <p><strong>Trend:</strong> Data is based on the latest measurements. Check regularly for updates.</p>
            <p><strong>Source:</strong> Data provided by OpenWeatherMap Air Pollution API.</p>
          </div>
        </>
      );
    } else if (activeTab === 'comparison') {
      return (
        <>
          <h3>AQI Comparison Across {city}</h3>
          <p className="tab-description">Compare air quality across different areas in and around {city}.</p>
          {renderAQIComparisonChart()}
          
          <h3>Worst Air Quality Areas</h3>
          <p>Areas with highest pollution levels require additional attention.</p>
        </>
      );
    } else if (activeTab === 'location' && selectedLocation) {
      const locationAqi = selectedLocation.aqiData ? calculateAQI(selectedLocation.aqiData) : 0;
      const locationAqiInfo = getAQICategory(locationAqi);
      
      return (
        <>
          <h3>{selectedLocation.name}</h3>
          
          <div 
            className="aqi-box" 
            style={{ backgroundColor: locationAqiInfo.color }}
          >
            <div className="aqi-value">{locationAqi}</div>
            <div className="aqi-label">AQI</div>
            <div className="aqi-category">{locationAqiInfo.label}</div>
          </div>
          
          <h3>Detailed Pollutant Information</h3>
          {renderPollutionDetails(selectedLocation.aqiData)}
          
          <div className="location-info">
            <p><strong>Coordinates:</strong> {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}</p>
            <p><strong>Health Impact:</strong> {locationAqiInfo.description}</p>
          </div>
          
          <button 
            className="back-button"
            onClick={() => setActiveTab('comparison')}
          >
            Back to Comparison
          </button>
        </>
      );
    } else {
      return (
        <div className="empty-state">
          <p>Select a location on the map to view detailed information</p>
        </div>
      );
    }
  };

  return (
    <div className="sidebar">
      <h2>{city}</h2>
      
      <div className="tab-navigation">
        <button 
          className={activeTab === 'main' ? 'active' : ''} 
          onClick={() => setActiveTab('main')}
        >
          Main
        </button>
        <button 
          className={activeTab === 'comparison' ? 'active' : ''} 
          onClick={() => setActiveTab('comparison')}
        >
          Compare
        </button>
        {selectedLocation && (
          <button 
            className={activeTab === 'location' ? 'active' : ''} 
            onClick={() => setActiveTab('location')}
          >
            Location
          </button>
        )}
      </div>
      
      <div className="sidebar-content">
        {renderContent()}
      </div>
    </div>
  );
}

export default Sidebar;