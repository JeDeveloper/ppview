import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useUIStore } from '../store/uiStore';

/**
 * Component to monitor pathtracer progress
 * Tracks the current sample count and updates the store
 */
function PathTracerMonitor() {
  const state = useThree();
  const setPathtracerSamples = useUIStore(state => state.setPathtracerSamples);
  const frameCount = useRef(0);
  const lastLogTime = useRef(0);

  useFrame(() => {
    frameCount.current++;
    
    // Try to find the pathtracer sample count
    let samples = frameCount.current;
    
    // Log every 60 frames to help debug
    const now = Date.now();
    if (now - lastLogTime.current > 1000) {
      console.log('PathTracer frame:', frameCount.current, 'state keys:', Object.keys(state));
      if (state.gl) {
        console.log('GL keys:', Object.keys(state.gl));
      }
      lastLogTime.current = now;
    }
    
    // Update the store with current sample count (using frame count)
    setPathtracerSamples(samples);
  });

  // Reset on mount
  useEffect(() => {
    frameCount.current = 0;
    setPathtracerSamples(0);
    console.log('PathTracerMonitor mounted');
    
    return () => {
      console.log('PathTracerMonitor unmounted');
    };
  }, [setPathtracerSamples]);

  return null;
}

export default PathTracerMonitor;
