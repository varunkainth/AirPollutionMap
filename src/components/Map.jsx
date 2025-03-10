import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Tooltip, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import ColorGradient from './ColorGradient';
import { fetchAirQualityData } from '../services/api';
import 'leaflet/dist/leaflet.css';
import './Map.css';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Function to get AQI category name
const getAQICategoryName = (aqi) => {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
};

// Generate simulated AQI data instead of making API calls
const generateSimulatedAQIData = (lat, lng) => {
  // Use location to seed the random number generator for consistency
  const seed = (lat * 10000) + (lng * 10000);
  const random = Math.sin(seed) * 0.5 + 0.5; // Value between 0-1
  
  // Generate a PM2.5 value that's somewhat realistic
  // Base value between 5-50 μg/m³
  const basePM25 = 5 + (random * 45); 
  
  // Add some geographical variance - more pollution near the equator
  const latFactor = 1 - (Math.abs(lat) / 90); // 1 at equator, 0 at poles
  const adjustedPM25 = basePM25 * (0.7 + (latFactor * 0.6));
  
  // Create other pollutants based on PM2.5 with some variation
  const pm10 = adjustedPM25 * (1.5 + (Math.sin(seed * 2) * 0.5));
  const o3 = 20 + (random * 80); // Ozone between 20-100
  const no2 = 10 + (random * 50); // NO2 between 10-60
  const so2 = 5 + (random * 20);  // SO2 between 5-25
  const co = 300 + (random * 1700); // CO between 300-2000
  
  // Create a simulated response object that matches the OpenWeatherMap API format
  return {
    coord: { lon: lng, lat: lat },
    list: [
      {
        main: { aqi: Math.floor(random * 5) + 1 }, // AQI between 1-5
        components: {
          co: co,
          no: 5 + (random * 15),
          no2: no2,
          o3: o3,
          so2: so2,
          pm2_5: adjustedPM25,
          pm10: pm10,
          nh3: 3 + (random * 12)
        },
        dt: Math.floor(Date.now() / 1000) // Current timestamp in seconds
      }
    ]
  };
};

// Generate an area name based on coordinates
const generateAreaName = (lat, lng) => {
  // Create random but consistent area names based on coordinates
  const latPart = Math.abs(lat).toFixed(2);
  const lngPart = Math.abs(lng).toFixed(2);
  
  // Extract digits to create a somewhat pronounceable name
  const digits = `${latPart}${lngPart}`.replace(/\./g, '');
  
  // List of prefixes and suffixes for area names
  const prefixes = ['North', 'South', 'East', 'West', 'Central', 'Upper', 'Lower', 'New', 'Old'];
  const suffixes = ['District', 'Area', 'Zone', 'Sector', 'Region', 'Heights', 'Valley', 'Gardens', 'Park'];
  
  // Use the coordinates to select from the lists
  const prefixIndex = Math.floor((parseInt(digits.substring(0, 2)) % prefixes.length));
  const suffixIndex = Math.floor((parseInt(digits.substring(2, 4)) % suffixes.length));
  
  // Create a middle part that sounds like a place name
  const vowels = 'aeiou';
  const consonants = 'bcdfghjklmnprstvw';
  
  // Use more digits to create the middle part
  let middlePart = '';
  for (let i = 0; i < 3; i++) {
    const consonantIndex = parseInt(digits.substring(i*2, i*2+1)) % consonants.length;
    const vowelIndex = parseInt(digits.substring(i*2+1, i*2+2)) % vowels.length;
    middlePart += consonants[consonantIndex] + vowels[vowelIndex];
  }
  
  // Capitalize first letter
  middlePart = middlePart.charAt(0).toUpperCase() + middlePart.slice(1);
  
  return `${prefixes[prefixIndex]} ${middlePart} ${suffixes[suffixIndex]}`;
};

// Component to track map movements and generate random locations
function MapController({ coordinates, onDynamicLocationsChange }) {
  const map = useMap();
  const isInitialLoad = useRef(true);
  const moveEndTimeoutRef = useRef(null);
  const lastBoundsRef = useRef(null);
  
  // Function to generate random locations within the map bounds
  const generateRandomLocations = useCallback(async () => {
    try {
      // Get current map bounds
      const bounds = map.getBounds();
      const boundsString = bounds.toBBoxString();
      
      // Skip if bounds haven't changed significantly
      if (lastBoundsRef.current === boundsString && !isInitialLoad.current) {
        return;
      }
      
      // Update last bounds reference
      lastBoundsRef.current = boundsString;
      
      const northEast = bounds.getNorthEast();
      const southWest = bounds.getSouthWest();
      
      // Get current zoom level
      const zoom = map.getZoom();
      
      // Determine number of points based on zoom level
      let numPoints;
      if (zoom <= 8) numPoints = 12;
      else if (zoom <= 10) numPoints = 18;
      else if (zoom <= 12) numPoints = 25;
      else numPoints = 30;
      
      const latRange = northEast.lat - southWest.lat;
      const lngRange = northEast.lng - southWest.lng;
      
      // Generate random locations
      const randomLocations = [];
      
      // Use a simpler approach to reduce computational load
      const minDistanceBetweenPoints = Math.min(latRange, lngRange) / (Math.sqrt(numPoints) * 2);
      
      // Keep trying to add points until we have enough or reach max attempts
      let attempts = 0;
      const maxAttempts = numPoints * 5;
      
      while (randomLocations.length < numPoints && attempts < maxAttempts) {
        attempts++;
        
        // Generate a random position within bounds
        const lat = southWest.lat + Math.random() * latRange;
        const lng = southWest.lng + Math.random() * lngRange;
        
        // Check if this point is far enough from all existing points
        let isFarEnough = true;
        for (const existingLocation of randomLocations) {
          const distance = Math.sqrt(
            Math.pow(lat - existingLocation.lat, 2) + 
            Math.pow(lng - existingLocation.lng, 2)
          );
          
          if (distance < minDistanceBetweenPoints) {
            isFarEnough = false;
            break;
          }
        }
        
        // If point is valid, add it to our list
        if (isFarEnough) {
          const id = `random-${lat.toFixed(6)}-${lng.toFixed(6)}`;
          // Generate a more realistic area name
          const name = generateAreaName(lat, lng);
          
          // Generate simulated AQI data for this location immediately
          const aqiData = generateSimulatedAQIData(lat, lng);
          
          randomLocations.push({
            id,
            name,
            lat,
            lng,
            isRandomPoint: true,
            // Pre-populate with simulated data
            aqiData,
            // Add current timestamp
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Notify parent component of the new random locations with pre-populated data
      onDynamicLocationsChange(randomLocations);
    } catch (error) {
      console.error("Error generating random locations:", error);
      // Ensure we don't get stuck in a loading state
      onDynamicLocationsChange([]);
    }
  }, [map, onDynamicLocationsChange]);

  // Setup event handlers for map movement with stronger debounce
  useMapEvents({
    moveend: () => {
      // Clear any existing timeout to prevent multiple calls
      if (moveEndTimeoutRef.current) {
        clearTimeout(moveEndTimeoutRef.current);
      }
      
      // Delay to prevent excessive regeneration
      moveEndTimeoutRef.current = setTimeout(() => {
        generateRandomLocations();
      }, 500);
    },
    zoomend: () => {
      // Clear any existing timeout
      if (moveEndTimeoutRef.current) {
        clearTimeout(moveEndTimeoutRef.current);
      }
      
      moveEndTimeoutRef.current = setTimeout(() => {
        generateRandomLocations();
      }, 500);
    }
  });

  // Set initial map view and generate initial locations once
  useEffect(() => {
    if (isInitialLoad.current) {
      map.setView([coordinates.lat, coordinates.lng], 10);
      
      // Initial generation with delay to ensure map is ready
      setTimeout(() => {
        generateRandomLocations();
        isInitialLoad.current = false;
      }, 300);
    }
  }, [coordinates, map, generateRandomLocations]);

  return null;
}

// ZoomHandler component definition
function ZoomHandler({ onZoomChange }) {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    }
  });
  return null;
}

// Main Map component
function Map({ coordinates, airQualityData, multiLocationData, onLocationSelect, city }) {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(10);
  const [dynamicLocations, setDynamicLocations] = useState([]);
  const mapRef = useRef(null);
  
  // To track if component is mounted
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // AQI color mapping
  const getAQIColor = (aqi) => {
    if (aqi <= 50) return '#00e400'; // Good
    if (aqi <= 100) return '#ffff00'; // Moderate
    if (aqi <= 150) return '#ff7e00'; // Unhealthy for Sensitive Groups
    if (aqi <= 200) return '#ff0000'; // Unhealthy
    if (aqi <= 300) return '#99004c'; // Very Unhealthy
    return '#7e0023'; // Hazardous
  };

  // Calculate AQI from air quality data
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

  const handleMarkerClick = (location) => {
    setSelectedLocation(location);
    if (onLocationSelect) {
      onLocationSelect(location);
    }
  };

  // Function to handle dynamic locations with pre-populated AQI data
  const handleDynamicLocationsChange = useCallback((locations) => {
    if (isMountedRef.current) {
      setDynamicLocations(locations);
    }
  }, []);
  
  // Calculate dynamic radius based on zoom level
  const getCircleRadius = useCallback(() => {
    const baseRadius = 2500;
    
    // Adjust radius based on zoom level with less variation
    if (currentZoom <= 7) return baseRadius * 2;
    if (currentZoom <= 9) return baseRadius * 1.5;
    if (currentZoom === 10) return baseRadius;
    if (currentZoom <= 12) return baseRadius * 0.6;
    if (currentZoom <= 14) return baseRadius * 0.3;
    return baseRadius * 0.15;
  }, [currentZoom]);

  // Handle zoom change
  const handleZoomChange = (newZoom) => {
    setCurrentZoom(newZoom);
  };

  // Main city AQI
  const aqi = airQualityData ? calculateAQI(airQualityData) : 0;
  const aqiColor = getAQIColor(aqi);

  // Get reference to the map for zoom controls
  const whenCreated = (mapInstance) => {
    mapRef.current = mapInstance;
  };

  // Fallback city name in case prop is missing
  const cityName = city || "Selected Location";

  // Format a date as YYYY-MM-DD HH:MM:SS
  const formatDateTime = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };
  
  // Current date/time
  const currentTime = formatDateTime(new Date());

  return (
    <div className="map-container">
      <MapContainer
        center={[coordinates.lat, coordinates.lng]}
        zoom={10}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false} // Hide default zoom control
        whenCreated={whenCreated}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Main city circle overlay */}
        <Circle
          center={[coordinates.lat, coordinates.lng]}
          pathOptions={{
            fillColor: aqiColor,
            fillOpacity: 0.7,
            color: aqiColor,
            weight: 2
          }}
          radius={8000}
        >
          {/* Using cityName variable here instead of directly using city prop */}
          <Tooltip direction="top" offset={[0, -5]} opacity={1} permanent>
            {cityName}: AQI {aqi}
          </Tooltip>
        </Circle>

        {/* Named locations from multiLocationData */}
        {multiLocationData && multiLocationData.map((location) => {
          const locationAqi = location.aqiData ? calculateAQI(location.aqiData) : 0;
          const locationColor = getAQIColor(locationAqi);
          
          return (
            <Circle
              key={location.id}
              center={[location.lat, location.lng]}
              pathOptions={{
                fillColor: locationColor,
                fillOpacity: 0.6,
                color: locationColor,
                weight: 1
              }}
              radius={3000}
              eventHandlers={{
                click: () => handleMarkerClick(location)
              }}
            >
              <Tooltip>{location.name}: AQI {locationAqi}</Tooltip>
              <Popup>
                <div className="location-popup">
                  <h3>{location.name}</h3>
                  <div className="aqi-indicator" style={{ backgroundColor: locationColor }}>
                    AQI: {locationAqi}
                  </div>
                  <p>
                    <strong>PM2.5:</strong> {location.aqiData?.list[0]?.components.pm2_5.toFixed(2)} μg/m³<br />
                    <strong>PM10:</strong> {location.aqiData?.list[0]?.components.pm10.toFixed(2)} μg/m³
                  </p>
                  <button onClick={() => handleMarkerClick(location)}>
                    Show Details
                  </button>
                </div>
              </Popup>
            </Circle>
          );
        })}

        {/* Dynamic randomly positioned AQI points with simulated data */}
        {dynamicLocations.map((location) => {
          const locationAqi = location.aqiData ? calculateAQI(location.aqiData) : 0;
          const locationColor = getAQIColor(locationAqi);
          const aqiCategory = getAQICategoryName(locationAqi);
          
          // Use seeded pseudo-random for consistent rendering
          const seed = location.id.charCodeAt(0) + location.id.charCodeAt(location.id.length - 1);
          const pseudoRandom = Math.sin(seed) * 0.5 + 0.5;
          
          const baseRadius = getCircleRadius();
          const adjustedRadius = baseRadius * (0.9 + pseudoRandom * 0.2);
          const opacity = 0.5 + pseudoRandom * 0.2;
          
          return (
            <Circle
              key={location.id}
              center={[location.lat, location.lng]}
              pathOptions={{
                fillColor: locationColor,
                fillOpacity: opacity,
                color: locationColor,
                weight: 0.5
              }}
              radius={adjustedRadius}
              eventHandlers={{
                click: () => handleMarkerClick(location)
              }}
            >
              {/* Enhanced tooltip with more details */}
              <Tooltip className="detailed-tooltip">
                <div>
                  <strong>{location.name}</strong><br/>
                  <span className="aqi-tag" style={{backgroundColor: locationColor, color: locationAqi > 150 ? 'white' : 'black'}}>
                    AQI: {locationAqi} - {aqiCategory}
                  </span><br/>
                  <small>PM2.5: {location.aqiData?.list[0]?.components.pm2_5.toFixed(1)} μg/m³</small><br/>
                  <small>Updated: {formatDateTime(location.timestamp || new Date())}</small>
                </div>
              </Tooltip>
              <Popup>
                <div className="location-popup">
                  <h3>{location.name}</h3>
                  <div className="aqi-indicator" style={{ backgroundColor: locationColor }}>
                    AQI: {locationAqi} - {aqiCategory}
                  </div>
                  <p>
                    <strong>PM2.5:</strong> {location.aqiData?.list[0]?.components.pm2_5.toFixed(2)} μg/m³<br />
                    <strong>PM10:</strong> {location.aqiData?.list[0]?.components.pm10.toFixed(2)} μg/m³<br />
                    <strong>O₃:</strong> {location.aqiData?.list[0]?.components.o3.toFixed(2)} μg/m³<br />
                    <strong>NO₂:</strong> {location.aqiData?.list[0]?.components.no2.toFixed(2)} μg/m³<br />
                    <strong>SO₂:</strong> {location.aqiData?.list[0]?.components.so2.toFixed(2)} μg/m³<br />
                    <small className="coordinate-text">Coordinates: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</small>
                  </p>
                  <div className="timestamp-info">Updated: {formatDateTime(location.timestamp || new Date())}</div>
                  <button onClick={() => handleMarkerClick(location)}>
                    Show in Sidebar
                  </button>
                </div>
              </Popup>
            </Circle>
          );
        })}

        {/* Map controller for random location generation */}
        <MapController 
          coordinates={coordinates}
          onDynamicLocationsChange={handleDynamicLocationsChange}
        />
        
        {/* ZoomHandler to track zoom changes */}
        <ZoomHandler onZoomChange={handleZoomChange} />
      </MapContainer>

      {/* Custom zoom controls positioned on the right */}
      <div className="custom-zoom-controls">
        <button 
          onClick={() => mapRef.current && mapRef.current.zoomIn()} 
          className="zoom-control zoom-in"
        >
          +
        </button>
        <button 
          onClick={() => mapRef.current && mapRef.current.zoomOut()} 
          className="zoom-control zoom-out"
        >
          -
        </button>
      </div>

      {/* Color Gradient Legend */}
      <ColorGradient />

      {/* Legend */}
      <div className="map-legend">
        <h4>AQI Legend</h4>
        <div className="legend-item">
          <span className="color-box" style={{ backgroundColor: '#00e400' }}></span>
          <span>0-50: Good</span>
        </div>
        <div className="legend-item">
          <span className="color-box" style={{ backgroundColor: '#ffff00' }}></span>
          <span>51-100: Moderate</span>
        </div>
        <div className="legend-item">
          <span className="color-box" style={{ backgroundColor: '#ff7e00' }}></span>
          <span>101-150: Unhealthy for Sensitive Groups</span>
        </div>
        <div className="legend-item">
          <span className="color-box" style={{ backgroundColor: '#ff0000' }}></span>
          <span>151-200: Unhealthy</span>
        </div>
        <div className="legend-item">
          <span className="color-box" style={{ backgroundColor: '#99004c' }}></span>
          <span>201-300: Very Unhealthy</span>
        </div>
        <div className="legend-item">
          <span className="color-box" style={{ backgroundColor: '#7e0023' }}></span>
          <span>301+: Hazardous</span>
        </div>
      </div>
      
      {/* Current time display */}
      <div className="time-display">
        Data as of: {currentTime}
      </div>
    </div>
  );
}

export default Map;