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
      return;
    }

    // Debounce search to prevent excessive API calls
    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const cities = await searchCities(searchQuery);
        setSuggestions(cities);
        setShowSuggestions(true);
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
      const { city, coordinates } = await searchCities(searchQuery, true);
      onCitySearch(city, coordinates);
    } catch (err) {
      setError('Could not find the location. Please check the city name.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion.name);
    setShowSuggestions(false);
    onCitySearch(suggestion.name, { lat: suggestion.lat, lng: suggestion.lon });
  };

  return (
    <div className="search-bar" ref={suggestionRef}>
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search city (e.g., Delhi, Mumbai)"
          disabled={isLoading}
          onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
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
            >
              {suggestion.name}
              {suggestion.state ? `, ${suggestion.state}` : ''}
              {suggestion.country ? `, ${suggestion.country}` : ''}
            </li>
          ))}
        </ul>
      )}
      
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export default SearchBar;