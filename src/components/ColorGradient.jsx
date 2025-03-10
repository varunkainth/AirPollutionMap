import React from 'react';
import './ColorGradient.css';

function ColorGradient() {
  return (
    <div className="gradient-container">
      <div className="color-gradient"></div>
      <div className="gradient-labels">
        <div className="gradient-value">0</div>
        <div className="gradient-value">50</div>
        <div className="gradient-value">100</div>
        <div className="gradient-value">150</div>
        <div className="gradient-value">200</div>
        <div className="gradient-value">300+</div>
      </div>
    </div>
  );
}

export default ColorGradient;