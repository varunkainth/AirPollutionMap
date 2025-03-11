import React, { useState, useEffect, useCallback } from "react";
import Map from "./components/Map";
import Sidebar from "./components/Sidebar";
import SearchBar from "./components/SearchBar";
import {
  fetchAirQualityData,
  getNearbyLocations,
  fetchMultiLocationAQI,
} from "./services/api";
import "./App.css";

// Define constants
const DEFAULT_CITY = "Delhi";
const DEFAULT_COORDINATES = { lat: 28.6139, lng: 77.209 };

function App() {
  const [city, setCity] = useState(DEFAULT_CITY);
  const [coordinates, setCoordinates] = useState(DEFAULT_COORDINATES);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [airQualityData, setAirQualityData] = useState(null);
  const [multiLocationData, setMultiLocationData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [mapKey, setMapKey] = useState(Date.now()); // Key to force map re-render

  // Function to fetch air quality data for the main city and nearby locations
  const fetchAllAirQualityData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch main city AQI data
      const data = await fetchAirQualityData(coordinates.lat, coordinates.lng);
      setAirQualityData(data);

      // Get nearby locations for the city
      const nearbyLocations = await getNearbyLocations(
        coordinates.lat,
        coordinates.lng,
        city
      );

      // Fetch AQI data for all locations
      const locationsWithAQI = await fetchMultiLocationAQI(nearbyLocations);
      setMultiLocationData(locationsWithAQI);
    } catch (err) {
      console.error("Error fetching air quality data:", err);
      setError("Failed to fetch air quality data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [coordinates, city]);

  // Effect to fetch data when city or coordinates change
  useEffect(() => {
    fetchAllAirQualityData();
  }, [fetchAllAirQualityData, retryCount]);

  // Handle city search from SearchBar
  const handleCitySearch = (newCity, newCoordinates) => {
    setCity(newCity);
    setCoordinates(newCoordinates);
    setSelectedLocation(null); // Reset selected location when changing cities
    setMapKey(Date.now()); // Force map re-render with new coordinates
  };

  // Handle location selection from Map
  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    // Scroll to the location details in the sidebar if needed
    const detailsSection = document.getElementById("location-details");
    if (detailsSection) {
      detailsSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Handle retry when data fetching fails
  const handleRetry = () => {
    setRetryCount((prev) => prev + 1); // Increment retry count to trigger useEffect
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>Air Quality Index Map</h1>
          <SearchBar onCitySearch={handleCitySearch} />
          <div className="header-info">
            <span className="timestamp">
              Current Date and Time (UTC - YYYY-MM-DD HH:MM:SS formatted):
              2025-03-11 09:35:00
            </span>
            <span className="user-info">Current User's Login: Prakriti</span>
          </div>
        </div>
      </header>

      <main className="app-content">
        {loading && !airQualityData ? (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Loading air quality data for {city}...</p>
          </div>
        ) : error ? (
          <div className="error">
            <p>{error}</p>
            <button onClick={handleRetry} className="retry-button">
              Try Again
            </button>
          </div>
        ) : (
          <>
            <Map
              key={mapKey} // Key ensures map re-renders with new coordinates
              coordinates={coordinates}
              airQualityData={airQualityData}
              multiLocationData={multiLocationData}
              onLocationSelect={handleLocationSelect}
              city={city}
              maxRandomSpots={15} // Limit to 15 max random spots
            />
            <Sidebar
              city={city}
              airQualityData={airQualityData}
              multiLocationData={multiLocationData}
              selectedLocation={selectedLocation}
              isLoading={loading}
            />
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>© 2025 Air Quality Index Map | Developed by Prakriti Team</p>
      </footer>
    </div>
  );
}

export default App;
