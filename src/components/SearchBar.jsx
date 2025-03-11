import React, { useState, useEffect, useRef } from 'react';
import { searchCities } from '../services/api';
import './SearchBar.css';

function SearchBar({ onCitySearch }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState('');
  const searchTimeoutRef = useRef(null);
  const suggestionRef = useRef(null);
  const inputRef = useRef(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch suggestions as user types
  useEffect(() => {
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Don't search if query is too short
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce search to prevent excessive API calls
    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const cities = await searchCities(searchQuery);
        setSuggestions(cities);
        setShowSuggestions(cities.length > 0);
      } catch (err) {
        console.error('Error fetching suggestions:', err);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    // Clean up timeout on component unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      setError('Please enter a city name');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setShowSuggestions(false);
    
    try {
      const result = await searchCities(searchQuery, true);
      if (!result) {
        setError('Could not find the location. Please check the city name.');
        return;
      }
      
      const { city, coordinates } = result;
      onCitySearch(city, coordinates);
    } catch (err) {
      setError('Could not find the location. Please check the city name.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    // Extract display name from suggestion if it exists, otherwise use name
    const cityName = suggestion.display || suggestion.name;
    
    setSearchQuery(cityName);
    setShowSuggestions(false);
    onCitySearch(
      cityName, 
      { lat: suggestion.lat, lng: suggestion.lon || suggestion.lng }
    );
  };

  const formatSuggestionLabel = (suggestion) => {
    // If the suggestion already has a formatted display name, use it
    if (suggestion.display) {
      return suggestion.display;
    }
    
    // Otherwise build a formatted name with available data
    let label = suggestion.name;
    
    if (suggestion.state && !suggestion.name.includes(suggestion.state)) {
      label += `, ${suggestion.state}`;
    }
    
    if (suggestion.country && suggestion.country !== 'IN') {
      label += `, ${suggestion.country}`;
    } else if (suggestion.country === 'IN' && !label.includes('India')) {
      label += ', India';
    }
    
    return label;
  };

  return (
    <div className="search-bar" ref={suggestionRef}>
      <form onSubmit={handleSearch}>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search city (e.g., Delhi, Mumbai, London)"
          disabled={isLoading}
          onFocus={() => {
            if (searchQuery.length >= 2 && suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          aria-label="Search for a city"
          autoComplete="off"
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {showSuggestions && suggestions.length > 0 && (
        <ul className="suggestions-list">
          {suggestions.map((suggestion, index) => (
            <li 
              key={`${suggestion.name}-${index}`}
              onClick={() => handleSuggestionClick(suggestion)}
              tabIndex={0}
              role="option"
              aria-selected="false"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleSuggestionClick(suggestion);
                }
              }}
            >
              {formatSuggestionLabel(suggestion)}
            </li>
          ))}
        </ul>
      )}
      
      {error && <p className="error-message" aria-live="assertive">{error}</p>}
    </div>
  );
}

export default SearchBar;