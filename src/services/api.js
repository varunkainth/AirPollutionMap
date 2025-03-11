import axios from 'axios';
import { INDIAN_CITIES_DATA, CITY_ALIASES, GLOBAL_CITY_LOCATIONS, INDIAN_CITY_LOCATIONS } from '../constants/Indian_City';

// Replace with your actual API key
const OPENWEATHER_API_KEY = import.meta.env.VITE_api_key;

// AQI data cache
const aqiDataCache = {};
const CACHE_EXPIRATION = 30 * 60 * 1000;

// Flatten the city data for easy access
const ALL_INDIAN_CITIES = Object.values(INDIAN_CITIES_DATA).flat();

// Get all city names including alternates for quick lookup
const getAllCityNames = () => {
  const names = [];
  ALL_INDIAN_CITIES.forEach(city => {
    names.push(city.name);
    if (city.alternateNames) {
      names.push(...city.alternateNames);
    }
  });
  return names;
};

const ALL_CITY_NAMES = getAllCityNames();

/**
 * Get Indian cities that start with a specific prefix
 * @param {string} prefix - The prefix to search for (e.g., 'G')
 * @param {number} limit - Maximum number of results
 * @returns {Array} - Array of matching city objects
 */
const getIndianCitiesByPrefix = (prefix, limit = 10) => {
  if (!prefix || prefix.length === 0) return [];
  
  prefix = prefix.toUpperCase();
  const firstChar = prefix.charAt(0);
  
  // If we have cities starting with this letter
  if (INDIAN_CITIES_DATA[firstChar]) {
    const results = [];
    
    // First check exact prefix matches
    INDIAN_CITIES_DATA[firstChar].forEach(city => {
      if (city.name.toUpperCase().startsWith(prefix)) {
        results.push({
          ...city,
          display: `${city.name}, ${city.state}`,
          score: 100
        });
      } else if (city.alternateNames) {
        // Check alternate names
        const matchingAlternateName = city.alternateNames.find(alt => 
          alt.toUpperCase().startsWith(prefix)
        );
        
        if (matchingAlternateName) {
          results.push({
            ...city,
            display: `${matchingAlternateName} (${city.name}), ${city.state}`,
            score: 90
          });
        }
      }
    });
    
    // Sort by score (exact matches first)
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, limit);
  }
  
  return [];
};

/**
 * Perform fuzzy search for Indian cities
 * @param {string} query - The search query
 * @param {number} limit - Maximum number of results
 * @returns {Array} - Array of matching city objects
 */
const searchIndianCities = (query, limit = 10) => {
  if (!query || query.length === 0) return [];
  
  const normalizedQuery = query.toLowerCase();
  const results = [];
  
  // Search through all cities
  ALL_INDIAN_CITIES.forEach(city => {
    let score = 0;
    const cityNameLower = city.name.toLowerCase();
    
    // Exact match gets highest score
    if (cityNameLower === normalizedQuery) {
      score = 100;
    } 
    // Starts with query gets high score
    else if (cityNameLower.startsWith(normalizedQuery)) {
      score = 90;
    }
    // Contains query gets medium score
    else if (cityNameLower.includes(normalizedQuery)) {
      score = 80;
    }
    // Check alternate names if available
    else if (city.alternateNames) {
      for (const altName of city.alternateNames) {
        const altNameLower = altName.toLowerCase();
        if (altNameLower === normalizedQuery) {
          score = 85;
          break;
        } else if (altNameLower.startsWith(normalizedQuery)) {
          score = 75;
          break;
        } else if (altNameLower.includes(normalizedQuery)) {
          score = 65;
          break;
        }
      }
    }
    
    // If there's a match, add to results
    if (score > 0) {
      results.push({
        ...city,
        display: `${city.name}, ${city.state}`,
        score
      });
    }
  });
  
  // Sort by score (highest first)
  results.sort((a, b) => b.score - a.score);
  
  return results.slice(0, limit);
};

/**
 * Enhanced city search function that combines API results with local database
 * @param {string} query - The search query
 * @param {boolean} getFirst - Whether to return only the first result
 * @returns {Promise} - Promise resolving to search results
 */
export const searchCities = async (query, getFirst = false) => {
  try {
    if (!query || query.trim().length === 0) {
      return getFirst ? null : [];
    }
    
    const normalizedQuery = query.trim();
    
    // If query is just 1-2 characters, use prefix search for Indian cities only
    if (normalizedQuery.length <= 2) {
      const localResults = getIndianCitiesByPrefix(normalizedQuery);
      
      if (getFirst && localResults.length > 0) {
        const first = localResults[0];
        return {
          city: first.name,
          coordinates: { lat: first.lat, lng: first.lng },
          state: first.state
        };
      }
      
      return localResults.map(city => ({
        name: city.display,
        lat: city.lat,
        lon: city.lng,
        country: 'IN',
        state: city.state
      }));
    }
    
    // For longer queries, combine local search with API results
    const localResults = searchIndianCities(normalizedQuery);
    
    // Also get results from the API for broader search
    let apiResults = [];
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
          normalizedQuery
        )}&limit=10&appid=${OPENWEATHER_API_KEY}`
      );
      apiResults = response.data || [];
    } catch (error) {
      console.error("OpenWeather API error:", error);
      // Continue with local results only
    }
    
    // Process API results to prioritize Indian cities
    const processedApiResults = apiResults.filter(city => {
      // Remove API results that duplicate our high-quality local data for Indian cities
      if (city.country === 'IN') {
        const isDuplicate = localResults.some(
          localCity => localCity.name.toLowerCase() === city.name.toLowerCase()
        );
        return !isDuplicate;
      }
      return true;
    });
    
    // Convert local results to match API format
    const formattedLocalResults = localResults.map(city => ({
      name: city.display,
      lat: city.lat,
      lon: city.lng,
      country: 'IN',
      state: city.state
    }));
    
    // Combine and prioritize results
    let combinedResults = [...formattedLocalResults];
    
    // Only add API results if we want to include non-Indian cities or don't have enough local results
    if (formattedLocalResults.length < 5) {
      // Add API results, prioritizing Indian cities
      const indianApiResults = processedApiResults.filter(city => city.country === 'IN');
      const nonIndianApiResults = processedApiResults.filter(city => city.country !== 'IN');
      
      combinedResults = [
        ...formattedLocalResults,
        ...indianApiResults,
        ...nonIndianApiResults
      ].slice(0, 10);
    }
    
    if (getFirst && combinedResults.length > 0) {
      const { lat, lon, name, state } = combinedResults[0];
      return {
        city: name,
        coordinates: { lat, lng: lon },
        state
      };
    }
    
    return combinedResults;
  } catch (error) {
    console.error("Error searching cities:", error);
    throw error;
  }
};

/**
 * Intelligent function to get nearby locations for any city worldwide
 * @param {number} lat - Latitude of the city
 * @param {number} lon - Longitude of the city
 * @param {string} city - City name
 * @returns {Array} - Array of nearby location objects
 */
export const getNearbyLocations = async (lat, lon, city) => {
  try {
    // Normalize city name to handle aliases and case insensitivity
    const normalizedCityName = city.toLowerCase().trim();
    const cityKey = CITY_ALIASES[normalizedCityName] || normalizedCityName;
    
    // Check if we have predefined locations for Indian cities
    if (INDIAN_CITY_LOCATIONS[cityKey]) {
      console.log(`Using predefined locations for Indian city: ${city}`);
      return INDIAN_CITY_LOCATIONS[cityKey];
    }
    
    // Check if we have predefined locations for global cities
    if (GLOBAL_CITY_LOCATIONS[cityKey]) {
      console.log(`Using predefined locations for global city: ${city}`);
      return GLOBAL_CITY_LOCATIONS[cityKey];
    }
    
    // For cities without predefined locations, generate algorithmic locations
    console.log(`Generating algorithmic locations for: ${city}`);
    
    // Try to get real city data from reverse geocoding for better naming
    let cityData = null;
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${OPENWEATHER_API_KEY}`,
        { timeout: 3000 } // Add timeout to avoid hanging
      );
      if (response.data && response.data.length > 0) {
        cityData = response.data[0];
      }
    } catch (error) {
      console.warn("Could not fetch additional city data, using basic algorithm");
    }
    
    // Generate locations in different directions around the city
    const locations = [];
    const directions = [
      { name: "North", dlat: 0.025, dlng: 0 },
      { name: "Northeast", dlat: 0.02, dlng: 0.02 },
      { name: "East", dlat: 0, dlng: 0.025 },
      { name: "Southeast", dlat: -0.02, dlng: 0.02 },
      { name: "South", dlat: -0.025, dlng: 0 },
      { name: "Southwest", dlat: -0.02, dlng: -0.02 },
      { name: "West", dlat: 0, dlng: -0.025 },
      { name: "Northwest", dlat: 0.02, dlng: -0.02 },
    ];

    // For larger cities, use larger distance increments
    // If we got population data from reverse geocoding
    const isLargeCity = cityData?.population > 1000000;
    const scaleFactor = isLargeCity ? 1.5 : 1.0;

    directions.forEach((dir) => {
      locations.push({
        name: `${city} - ${dir.name}`,
        lat: lat + (dir.dlat * scaleFactor),
        lng: lon + (dir.dlng * scaleFactor),
        id: `${normalizedCityName.replace(/\s+/g, "-")}-${dir.name.toLowerCase()}`,
      });
    });

    // Add city center
    locations.push({
      name: `${city} - Center`,
      lat,
      lng: lon,
      id: `${normalizedCityName.replace(/\s+/g, "-")}-center`,
    });

    return locations;
  } catch (error) {
    console.error("Error getting nearby locations:", error);
    // Provide fallback in case of errors
    return [
      {
        name: `${city} - Center`,
        lat,
        lng: lon,
        id: `${city.toLowerCase().replace(/\s+/g, "-")}-center`,
      },
      {
        name: `${city} - North`,
        lat: lat + 0.025,
        lng: lon,
        id: `${city.toLowerCase().replace(/\s+/g, "-")}-north`,
      },
      {
        name: `${city} - South`,
        lat: lat - 0.025,
        lng: lon,
        id: `${city.toLowerCase().replace(/\s+/g, "-")}-south`,
      }
    ];
  }
};

/**
 * Fetch air quality data with improved caching and error handling
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude 
 * @param {AbortSignal} signal - Optional abort signal for cancellable requests
 * @returns {Promise} - Promise resolving to air quality data
 */
export const fetchAirQualityData = async (lat, lon, signal) => {
  try {
    // Generate cache key
    const cacheKey = `${lat.toFixed(4)}-${lon.toFixed(4)}`;
    
    // Check if we have cached data that's not expired
    if (aqiDataCache[cacheKey] && 
        (Date.now() - aqiDataCache[cacheKey].timestamp) < CACHE_EXPIRATION) {
      console.log(`Using cached AQI data for ${cacheKey}`);
      return aqiDataCache[cacheKey].data;
    }
    
    // No cache hit, make API request
    console.log(`Fetching fresh AQI data for ${cacheKey}`);
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`,
      signal ? { signal } : {}
    );
    
    // Store response in cache with timestamp
    aqiDataCache[cacheKey] = {
      data: response.data,
      timestamp: Date.now()
    };
    
    // Clean up old cache entries if cache is too large
    const maxCacheEntries = 100;
    if (Object.keys(aqiDataCache).length > maxCacheEntries) {
      const oldestEntries = Object.entries(aqiDataCache)
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)
        .slice(0, 20); // Remove oldest 20 entries
        
      oldestEntries.forEach(([key]) => {
        delete aqiDataCache[key];
      });
      console.log(`Cache cleanup: removed ${oldestEntries.length} old entries`);
    }
    
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

/**
 * Fetch AQI data for multiple locations with parallel requests and error handling
 * @param {Array} locations - Array of location objects with lat and lng properties
 * @returns {Promise} - Promise resolving to locations with AQI data
 */
export const fetchMultiLocationAQI = async (locations) => {
  try {
    const locationsWithAQI = await Promise.all(
      locations.map(async (location) => {
        try {
          const aqiData = await fetchAirQualityData(location.lat, location.lng);
          return { ...location, aqiData };
        } catch (error) {
          console.error(`Error fetching AQI data for ${location.name}:`, error);
          return { ...location, aqiData: null };
        }
      })
    );

    return locationsWithAQI;
  } catch (error) {
    console.error("Error fetching multi-location AQI data:", error);
    throw error;
  }
};