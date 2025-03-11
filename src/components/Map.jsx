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

// Global persistent store for random spots
const randomSpotsStore = {
  spots: {},
  add(spot) {
    this.spots[spot.id] = spot;
  },
  getAll() {
    return Object.values(this.spots);
  },
  getInBounds(bounds) {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    return this.getAll().filter(spot => 
      spot.lat >= sw.lat && spot.lat <= ne.lat && 
      spot.lng >= sw.lng && spot.lng <= ne.lng
    );
  },
  clear() {
    this.spots = {};
  }
};

// Generate simulated AQI data
const generateSimulatedAQIData = (lat, lng) => {
  // Create a seed from coordinates for consistent randomness
  const seed = (lat * 10000) + (lng * 10000);
  const random = Math.sin(seed) * 0.5 + 0.5; // Value between 0-1
  
  // Generate PM2.5 value
  const pm25 = 5 + (random * 95); // 5-100 μg/m³
  const pm10 = pm25 * (1.5 + (Math.sin(seed * 2) * 0.3));
  const o3 = 20 + (random * 80);
  const no2 = 10 + (random * 50);
  const so2 = 5 + (random * 20);
  const co = 300 + (random * 1700);
  
  // Create a response object that matches expected format
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
          pm2_5: pm25,
          pm10: pm10,
          nh3: 3 + (random * 12)
        },
        dt: Math.floor(Date.now() / 1000)
      }
    ]
  };
};

// Generate a realistic area name from coordinates
const generateAreaName = (lat, lng) => {
  const prefixes = ['North', 'South', 'East', 'West', 'Central', 'Upper', 'Lower', 'New', 'Old'];
  const suffixes = ['District', 'Area', 'Zone', 'Sector', 'Region', 'Heights', 'Park'];
  
  // Create a seed from coordinates
  const seed = Math.abs(lat * 1000 + lng * 100000);
  const prefixIndex = Math.floor(seed % prefixes.length);
  const suffixIndex = Math.floor((seed / 10) % suffixes.length);
  
  // Create a pronounceable middle part
  const vowels = 'aeiou';
  const consonants = 'bcdfghjklmnprstvw';
  let middlePart = '';
  
  for (let i = 0; i < 2; i++) {
    const consonantIndex = Math.floor((seed / (100 * (i + 1))) % consonants.length);
    const vowelIndex = Math.floor((seed / (10 * (i + 1))) % vowels.length);
    middlePart += consonants[consonantIndex] + vowels[vowelIndex];
  }
  
  middlePart = middlePart.charAt(0).toUpperCase() + middlePart.slice(1);
  return `${prefixes[prefixIndex]} ${middlePart} ${suffixes[suffixIndex]}`;
};

// Map Controller component to handle map events and random spot generation
function MapController({ coordinates, onSpotsUpdate, maxRandomSpots = 15 }) {
  const map = useMap();
  const isInitialMount = useRef(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Function to generate random spots - limited to max number
  const generateRandomSpots = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    
    try {
      const bounds = map.getBounds();
      const visibleSpots = randomSpotsStore.getInBounds(bounds);
      
      // Target number of spots - always between 10-15
      const minSpots = 10;
      const targetSpots = Math.min(maxRandomSpots, 15);
      
      // If we already have enough spots in view and not initial mount, just update
      if (visibleSpots.length >= minSpots && !isInitialMount.current) {
        // If we have too many, limit what we return
        onSpotsUpdate(visibleSpots.slice(0, targetSpots));
        setIsGenerating(false);
        return;
      }
      
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const latRange = ne.lat - sw.lat;
      const lngRange = ne.lng - sw.lng;
      
      // Only create new spots if we don't have enough
      const spotsToCreate = Math.max(0, minSpots - visibleSpots.length);
      
      if (spotsToCreate > 0) {
        // Create an array of potential positions
        const positions = [];
        
        // Divide the map into a grid to ensure even distribution
        const gridSize = Math.ceil(Math.sqrt(targetSpots));
        const latStep = latRange / gridSize;
        const lngStep = lngRange / gridSize;
        
        // Generate grid positions with some randomness
        for (let i = 0; i < gridSize; i++) {
          for (let j = 0; j < gridSize; j++) {
            // Add some randomness to position within grid cell
            const randomLat = sw.lat + (i * latStep) + (Math.random() * latStep);
            const randomLng = sw.lng + (j * lngStep) + (Math.random() * lngStep);
            
            positions.push({ lat: randomLat, lng: randomLng });
          }
        }
        
        // Shuffle and take only what we need
        const shuffledPositions = positions
          .sort(() => 0.5 - Math.random())
          .slice(0, spotsToCreate);
        
        // Create spots at these positions
        for (const pos of shuffledPositions) {
          const id = `spot-${pos.lat.toFixed(5)}-${pos.lng.toFixed(5)}`;
          
          // Only create if not already in store
          if (!randomSpotsStore.spots[id]) {
            // Generate name and simulated AQI data
            const name = generateAreaName(pos.lat, pos.lng);
            const aqiData = generateSimulatedAQIData(pos.lat, pos.lng);
            
            // Add to store
            randomSpotsStore.add({
              id,
              name,
              lat: pos.lat,
              lng: pos.lng,
              aqiData,
              timestamp: new Date().toISOString(),
              isRandomSpot: true
            });
          }
        }
      }
      
      // Update visible spots
      const updatedVisibleSpots = randomSpotsStore.getInBounds(bounds);
      // Limit to target number of spots
      onSpotsUpdate(updatedVisibleSpots.slice(0, targetSpots));
    } catch (error) {
      console.error("Error generating random spots:", error);
    } finally {
      setIsGenerating(false);
      isInitialMount.current = false;
    }
  }, [map, onSpotsUpdate, isGenerating, maxRandomSpots]);
  
  // Set initial view and generate spots
  useEffect(() => {
    map.setView([coordinates.lat, coordinates.lng], 10);
    isInitialMount.current = true;
    
    // Clear spots store when coordinates change
    randomSpotsStore.clear();
    
    // Generate initial spots with delay
    setTimeout(() => {
      generateRandomSpots();
    }, 500);
  }, [coordinates, map, generateRandomSpots]);
  
  // Handle map movement events
  useMapEvents({
    moveend: () => {
      generateRandomSpots();
    },
    zoomend: () => {
      generateRandomSpots();
    }
  });
  
  return null;
}

// ZoomHandler component
function ZoomHandler({ onZoomChange }) {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    }
  });
  return null;
}

// Main Map component
function Map({ coordinates, airQualityData, multiLocationData, onLocationSelect, city, maxRandomSpots = 15 }) {
  const [currentZoom, setCurrentZoom] = useState(10);
  const [randomSpots, setRandomSpots] = useState([]);
  const mapRef = useRef(null);
  
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
    
    // Use OpenWeatherMap AQI if available
    const apiAqi = data.list[0].main?.aqi;
    if (apiAqi) {
      switch (apiAqi) {
        case 1: return 25; // Good
        case 2: return 75; // Moderate  
        case 3: return 125; // Unhealthy for Sensitive Groups
        case 4: return 175; // Unhealthy
        case 5: return 250; // Very Unhealthy
        default: return 0;
      }
    }
    
    // Calculate from PM2.5 if no AQI provided
    const pm25 = data.list[0].components.pm2_5;
    
    if (pm25 <= 12) return Math.round((pm25 / 12) * 50);
    if (pm25 <= 35.4) return Math.round(((pm25 - 12.1) / 23.3) * 50 + 51);
    if (pm25 <= 55.4) return Math.round(((pm25 - 35.5) / 19.9) * 50 + 101);
    if (pm25 <= 150.4) return Math.round(((pm25 - 55.5) / 94.9) * 50 + 151);
    if (pm25 <= 250.4) return Math.round(((pm25 - 150.5) / 99.9) * 100 + 201);
    return Math.round(((pm25 - 250.5) / 149.9) * 100 + 301);
  };

  // Handle marker click - this function sends the location data to the sidebar
  const handleMarkerClick = (location) => {
    if (onLocationSelect) {
      onLocationSelect(location);
    }
  };
  
  // Calculate circle radius based on zoom level - shrinks when zooming in
  const getMainCircleRadius = useCallback(() => {
    const baseRadius = 8000;
    // More aggressive radius reduction when zooming in
    return baseRadius * Math.pow(0.5, currentZoom - 10);
  }, [currentZoom]);
  
  const getSecondaryCircleRadius = useCallback(() => {
    const baseRadius = 3000;
    // More aggressive radius reduction when zooming in
    return baseRadius * Math.pow(0.5, currentZoom - 10);
  }, [currentZoom]);
  
  // Handle zoom change
  const handleZoomChange = (newZoom) => {
    setCurrentZoom(newZoom);
  };
  
  // Handle random spots update
  const handleSpotsUpdate = useCallback((spots) => {
    setRandomSpots(spots);
  }, []);

  // Main city AQI
  const aqi = airQualityData ? calculateAQI(airQualityData) : 0;
  const aqiColor = getAQIColor(aqi);
  
  // Format date time
  const formatDateTime = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };
  
  // Current time for display
  const currentTime = formatDateTime(new Date());

  return (
    <div className="map-container">
      <MapContainer
        center={[coordinates.lat, coordinates.lng]}
        zoom={10}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        whenCreated={(map) => { mapRef.current = map; }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Main city circle - size reduces with zoom */}
        <Circle
          center={[coordinates.lat, coordinates.lng]}
          pathOptions={{
            fillColor: aqiColor,
            fillOpacity: 0.7,
            color: aqiColor,
            weight: 2
          }}
          radius={getMainCircleRadius()}
        >
          <Tooltip direction="top" offset={[0, -5]} opacity={1} permanent>
            {city}: AQI {aqi}
          </Tooltip>
        </Circle>

        {/* Multi-location data circles */}
        {multiLocationData && multiLocationData.map((location) => {
          const locationAqi = location.aqiData ? calculateAQI(location.aqiData) : 0;
          const locationColor = getAQIColor(locationAqi);
          
          return (
            <Circle
              key={location.id || `${location.name}-${location.lat}-${location.lng}`}
              center={[location.lat, location.lng]}
              pathOptions={{
                fillColor: locationColor,
                fillOpacity: 0.6,
                color: locationColor,
                weight: 1
              }}
              radius={getSecondaryCircleRadius()}
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
                  <button onClick={() => handleMarkerClick(location)} className="show-details-btn">
                    Show in Sidebar
                  </button>
                </div>
              </Popup>
            </Circle>
          );
        })}

        {/* Random AQI spots - limited to 10-15 */}
        {randomSpots.map((spot) => {
          const spotAqi = calculateAQI(spot.aqiData);
          const spotColor = getAQIColor(spotAqi);
          const aqiCategory = getAQICategoryName(spotAqi);
          
          return (
            <Circle
              key={spot.id}
              center={[spot.lat, spot.lng]}
              pathOptions={{
                fillColor: spotColor,
                fillOpacity: 0.6,
                color: spotColor,
                weight: 0.5
              }}
              radius={getSecondaryCircleRadius() * 0.9}
              eventHandlers={{
                click: () => handleMarkerClick(spot)
              }}
            >
              <Tooltip className="detailed-tooltip">
                <div>
                  <strong>{spot.name}</strong><br/>
                  <span className="aqi-tag" style={{backgroundColor: spotColor, color: spotAqi > 150 ? 'white' : 'black'}}>
                    AQI: {spotAqi} - {aqiCategory}
                  </span><br/>
                  <small>PM2.5: {spot.aqiData?.list[0]?.components.pm2_5.toFixed(1)} μg/m³</small>
                </div>
              </Tooltip>
              <Popup>
                <div className="location-popup">
                  <h3>{spot.name}</h3>
                  <div className="aqi-indicator" style={{ backgroundColor: spotColor }}>
                    AQI: {spotAqi} - {aqiCategory}
                  </div>
                  <p>
                    <strong>PM2.5:</strong> {spot.aqiData?.list[0]?.components.pm2_5.toFixed(2)} μg/m³<br />
                    <strong>PM10:</strong> {spot.aqiData?.list[0]?.components.pm10.toFixed(2)} μg/m³<br />
                    <strong>O₃:</strong> {spot.aqiData?.list[0]?.components.o3.toFixed(2)} μg/m³<br />
                    <strong>NO₂:</strong> {spot.aqiData?.list[0]?.components.no2.toFixed(2)} μg/m³<br />
                    <small className="coordinate-text">Coordinates: {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}</small>
                  </p>
                  <button onClick={() => handleMarkerClick(spot)} className="show-details-btn">
                    Show in Sidebar
                  </button>
                </div>
              </Popup>
            </Circle>
          );
        })}

        {/* Map controllers */}
        <MapController 
          coordinates={coordinates}
          onSpotsUpdate={handleSpotsUpdate}
          maxRandomSpots={maxRandomSpots}
        />
        <ZoomHandler onZoomChange={handleZoomChange} />
      </MapContainer>

      {/* Custom zoom controls */}
      <div className="custom-zoom-controls">
        <button onClick={() => mapRef.current.zoomIn()} className="zoom-control zoom-in">+</button>
        <button onClick={() => mapRef.current.zoomOut()} className="zoom-control zoom-out">-</button>
      </div>

      {/* Color Gradient Legend */}
      <ColorGradient />

      {/* AQI Legend */}
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
      
      {/* Time display */}
      <div className="time-display">
        Data as of: {currentTime}
      </div>
    </div>
  );
}

export default Map;