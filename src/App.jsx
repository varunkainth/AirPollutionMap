import React, { useState, useEffect } from 'react';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import SearchBar from './components/SearchBar';
import { fetchAirQualityData, getNearbyLocations, fetchMultiLocationAQI } from './services/api';
import './App.css';

function App() {
  const [city, setCity] = useState('Delhi');
  const [coordinates, setCoordinates] = useState({ lat: 28.6139, lng: 77.2090 }); // Delhi coordinates
  const [airQualityData, setAirQualityData] = useState(null);
  const [multiLocationData, setMultiLocationData] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch main city AQI data
        const data = await fetchAirQualityData(coordinates.lat, coordinates.lng);
        setAirQualityData(data);
        
        // Get nearby locations for the city
        const nearbyLocations = await getNearbyLocations(coordinates.lat, coordinates.lng, city);
        
        // Fetch AQI data for all locations
        const locationsWithAQI = await fetchMultiLocationAQI(nearbyLocations);
        setMultiLocationData(locationsWithAQI);
        
        setSelectedLocation(null);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch air quality data');
        setLoading(false);
        console.error(err);
      }
    };

    fetchData();
  }, [coordinates, city]);

  const handleCitySearch = async (newCity, newCoordinates) => {
    setCity(newCity);
    setCoordinates(newCoordinates);
  };

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Air Quality Index Map</h1>
        <SearchBar onCitySearch={handleCitySearch} />
      </header>
      <main className="app-content">
        {loading ? (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Loading air quality data...</p>
          </div>
        ) : error ? (
          <div className="error">
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>Try Again</button>
          </div>
        ) : (
          <>
            <Map 
              coordinates={coordinates} 
              airQualityData={airQualityData}
              multiLocationData={multiLocationData}
              onLocationSelect={handleLocationSelect}
              city={city} // Explicitly passing city prop
            />
            <Sidebar 
              city={city} 
              airQualityData={airQualityData}
              multiLocationData={multiLocationData}
              selectedLocation={selectedLocation}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;