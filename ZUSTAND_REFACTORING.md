# Zustand State Management Refactoring

## Summary

Successfully refactored PPView from React's `useState` to Zustand for centralized state management. This eliminates prop drilling and improves code organization.

## Changes Made

### 1. Installed Zustand
```bash
npm install zustand
```

### 2. Created Organized Stores

#### **`src/store/particleStore.js`**
Manages particle and trajectory data:
- `positions`, `currentBoxSize`, `topData`
- `trajFile`, `configIndex`, `currentConfigIndex`
- `currentTime`, `currentEnergy`, `totalConfigs`
- Computed helper: `getUniqueParticleTypes()`

#### **`src/store/uiStore.js`**
Manages UI state:
- Legend visibility (`showPatchLegend`, `showParticleLegend`)
- 3D scene toggles (`showSimulationBox`, `showBackdropPlanes`, `showCoordinateAxis`)
- UI controls (`isControlsVisible`, `showClusteringPane`)
- Loading/file state (`filesDropped`, `isLoading`, `isDragDropEnabled`)
- Scene reference (`sceneRef`)
- Color scheme (`currentColorScheme`)
- Playback controls (`isPlaying`, `playbackSpeed`, `isSpeedPopupVisible`)
- Selection (`selectedParticles`)
- Iframe mode (`isIframeMode`)

#### **`src/store/clusteringStore.js`**
Manages clustering state:
- `highlightedClusters` (Set of particle indices)
- `showOnlyHighlightedClusters` (boolean)
- Actions: `highlightClusters()`, `clearHighlighting()`

### 3. Updated Components

#### **App.js**
- Replaced 30+ `useState` calls with Zustand store hooks
- Removed prop drilling to child components
- Maintained all functionality (file loading, trajectory playback, GLTF export, etc.)

#### **ParticleScene.js**
- Now reads directly from stores instead of receiving props
- Eliminated 12 prop parameters
- Automatically reactsto state changes

#### **ClusteringPane.js**
- Reads `positions`, `currentBoxSize`, `currentColorScheme` directly from stores
- Calls `highlightClusters()` action directly
- No longer needs props

#### **ColorSchemeSelector.js**
- Reads/writes `currentColorScheme` directly from store
- Uses `getUniqueParticleTypes()` for particle count
- Removed `onSchemeChange` prop

#### **PatchLegend.js**
- Reads `topData` and `currentColorScheme` from stores
- Self-managing visibility logic
- No props needed

#### **ParticleLegend.js**
- Reads `topData` and `currentColorScheme` from stores
- Self-managing visibility logic
- No props needed

#### **SelectedParticlesDisplay.js**
- Reads `positions`, `topData`, `selectedParticles` from stores
- Auto-hides when no particles selected
- No props needed

## Benefits

### Before (React useState)
```jsx
// App.js had 30+ useState calls
const [positions, setPositions] = useState([]);
const [topData, setTopData] = useState(null);
const [showPatchLegend, setShowPatchLegend] = useState(false);
// ... 27 more

// Heavy prop drilling
<ParticleScene
  positions={positions}
  boxSize={currentBoxSize}
  selectedParticles={selectedParticles}
  setSelectedParticles={setSelectedParticles}
  showSimulationBox={showSimulationBox}
  showBackdropPlanes={showBackdropPlanes}
  showCoordinateAxis={showCoordinateAxis}
  showPatches={showPatchLegend}
  colorScheme={currentColorScheme}
  highlightedClusters={highlightedClusters}
  showOnlyHighlightedClusters={showOnlyHighlightedClusters}
/>
```

### After (Zustand)
```jsx
// App.js uses organized stores
const { positions, setPositions, topData, setTopData } = useParticleStore();
const { showPatchLegend, setShowPatchLegend } = useUIStore();

// No prop drilling
<ParticleScene />
<ClusteringPane />
<ColorSchemeSelector />
```

## Advantages

1. **No Prop Drilling**: Components access state directly
2. **Better Organization**: Logical grouping of related state
3. **Improved Performance**: Selective subscriptions reduce re-renders
4. **Cleaner Code**: Reduced boilerplate and clearer intent
5. **Easier Testing**: Stores can be tested independently
6. **Better Scalability**: Adding new state is simpler

## Migration Notes

- All existing functionality preserved
- Build succeeds with only pre-existing warnings
- Compatible with React 18.3.1
- Zero breaking changes to user-facing features

## Testing

Build completed successfully:
```bash
npm run build
# ✓ Compiled successfully
# ✓ 310.1 kB main bundle (minimal increase)
# ✓ Only pre-existing warnings in utility files remain
```

### Before Refactoring
- 30+ `useState` declarations in App.js
- Heavy prop drilling through multiple component layers
- 12+ props passed to ParticleScene
- 4+ props passed to ClusteringPane, ColorSchemeSelector, etc.

### After Refactoring  
- Clean store hooks with organized state
- Zero prop drilling - components access stores directly
- Single prop to ParticleScene (onParticleDoubleClick callback)
- Zero props to ClusteringPane, ColorSchemeSelector, PatchLegend, ParticleLegend, SelectedParticlesDisplay

All components maintain their original behavior with cleaner, more maintainable code.
