import axios from 'axios';

// Replace with your actual API key
const OPENWEATHER_API_KEY = '719e5f4d7ab26f550abe6408e89a1172';

// Cache for storing AQI data to reduce API calls
const aqiDataCache = {};

// Cache expiration time in milliseconds (30 minutes)
const CACHE_EXPIRATION = 30 * 60 * 1000;

// Fetch air quality data from OpenWeather API
export const fetchAirQualityData = async (lat, lon, signal) => {
  try {
    // Generate cache key
    const cacheKey = `${lat.toFixed(4)}-${lon.toFixed(4)}`;
    
    // Check if we have cached data that's not expired
    if (aqiDataCache[cacheKey] && 
        (Date.now() - aqiDataCache[cacheKey].timestamp) < CACHE_EXPIRATION) {
      return aqiDataCache[cacheKey].data;
    }
    
    // No cache hit, make API request with abort signal if provided
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`,
      signal ? { signal } : {}
    );
    
    // Store response in cache with timestamp
    aqiDataCache[cacheKey] = {
      data: response.data,
      timestamp: Date.now()
    };
    
    return response.data;
  } catch (error) {
    // Re-throw AbortError directly
    if (error.name === 'AbortError' || (error.message && error.message.includes('aborted'))) {
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';
      throw abortError;
    }
    
    console.error('Error fetching air quality data:', error);
    throw error;
  }
};

// Rest of your API functions


// Search cities for autocomplete
export const searchCities = async (query, getFirst = false) => {
  try {
    const response = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${OPENWEATHER_API_KEY}`
    );
    
    if (getFirst && response.data && response.data.length > 0) {
      const { lat, lon, name } = response.data[0];
      return {
        city: name,
        coordinates: { lat, lng: lon }
      };
    }
    
    return response.data;
  } catch (error) {
    console.error('Error searching cities:', error);
    throw error;
  }
};

// Get nearby locations around a coordinate
export const getNearbyLocations = async (lat, lon, city) => {
  try {
    // For Delhi, return predefined locations
    if (city.toLowerCase() === 'delhi') {
      return [
        { name: "Rajouri Garden", lat: 28.6492, lng: 77.1207, id: "rajouri-garden" },
        { name: "Punjabi Bagh", lat: 28.6741, lng: 77.1313, id: "punjabi-bagh" },
        { name: "Anand Vihar", lat: 28.6462, lng: 77.3159, id: "anand-vihar" },
        { name: "Connaught Place", lat: 28.6315, lng: 77.2167, id: "connaught-place" },
        { name: "Dwarka", lat: 28.5921, lng: 77.0460, id: "dwarka" },
        { name: "R.K. Puram", lat: 28.5680, lng: 77.1765, id: "rk-puram" },
        { name: "Dilshad Garden", lat: 28.6845, lng: 77.3149, id: "dilshad-garden" },
        { name: "Mandir Marg", lat: 28.6364, lng: 77.2014, id: "mandir-marg" },
        { name: "IGI Airport", lat: 28.5562, lng: 77.0999, id: "igi-airport" },
      ];
    } else {
      // For other cities, generate nearby locations algorithmically
      const locations = [];
      const directions = [
        { name: "North", dlat: 0.025, dlng: 0 },
        { name: "Northeast", dlat: 0.02, dlng: 0.02 },
        { name: "East", dlat: 0, dlng: 0.025 },
        { name: "Southeast", dlat: -0.02, dlng: 0.02 },
        { name: "South", dlat: -0.025, dlng: 0 },
        { name: "Southwest", dlat: -0.02, dlng: -0.02 },
        { name: "West", dlat: 0, dlng: -0.025 },
        { name: "Northwest", dlat: 0.02, dlng: -0.02 }
      ];

      directions.forEach((dir, i) => {
        locations.push({
          name: `${city} - ${dir.name}`,
          lat: lat + dir.dlat,
          lng: lon + dir.dlng,
          id: `${city.toLowerCase().replace(/\s+/g, '-')}-${dir.name.toLowerCase()}`
        });
      });

      // Add city center
      locations.push({
        name: `${city} - Center`,
        lat, 
        lng: lon,
        id: `${city.toLowerCase().replace(/\s+/g, '-')}-center`
      });
      
      return locations;
    }
  } catch (error) {
    console.error('Error getting nearby locations:', error);
    throw error;
  }
};

// Fetch AQI data for multiple locations
export const fetchMultiLocationAQI = async (locations) => {
  try {
    // Use Promise.all to fetch data for all locations in parallel
    const promises = locations.map(location => 
      fetchAirQualityData(location.lat, location.lng)
        .then(data => ({
          ...location,
          aqiData: data
        }))
        .catch(error => {
          console.error(`Error fetching data for ${location.name}:`, error);
          return {
            ...location,
            aqiData: null,
            error: true
          };
        })
    );
    
    return await Promise.all(promises);
  } catch (error) {
    console.error('Error fetching multi-location AQI:', error);
    throw error;
  }
};