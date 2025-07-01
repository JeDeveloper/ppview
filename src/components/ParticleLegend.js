import React from 'react';
import { getParticleColors } from '../colors'; 


function ParticleLegend({ particleTypes, colorScheme = null }) {
  const particleColors = getParticleColors(colorScheme);
  
  return (
    <div className="particle-legend">
      <h3>Particle Color Legend</h3>
      <ul>
        {particleTypes.map((type, index) => (
          <li key={index}>
            <span
              className="color-box"
              style={{
                backgroundColor:
                  particleColors[type.typeIndex % particleColors.length],
              }}
            ></span>
            Particle Type {type.typeIndex}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ParticleLegend;