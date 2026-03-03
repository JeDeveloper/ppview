# PPView - Claude Code Guide

PPView is a React-based 3D visualization tool for oxDNA molecular dynamics simulations and patchy particle systems.

## Tech Stack

- **React 18.3.1** (Create React App)
- **Three.js 0.168.0** + **React Three Fiber 8.17.7** + **@react-three/drei 9.113.0**
- **Zustand** for state management (3 stores)
- Deployed to GitHub Pages at `https://zoombya.github.io/ppview`

## Development Commands

```bash
npm start       # Dev server at http://localhost:3000
npm test        # Jest tests in watch mode
npm run build   # Production build
npm run deploy  # Deploy to GitHub Pages
```

## Architecture

### State Management (Zustand)
- `src/store/particleStore.js` — particle/trajectory data (`positions`, `topData`, `trajFile`, `configIndex`, etc.)
- `src/store/uiStore.js` — UI state (legends, toggles, playback, selection, color scheme, iframe mode)
- `src/store/clusteringStore.js` — clustering highlights (`highlightedClusters` Set, `showOnlyHighlightedClusters`)

Components read from stores directly — **no prop drilling**. `ParticleScene` takes only one prop (`onParticleDoubleClick`).

### Key Components
- `App.js` — file loading, trajectory nav, GLTF export, iframe message handling
- `ParticleScene.js` — Three.js scene (lighting, controls, 3D rendering)
- `Particles.js` — instanced mesh rendering with cluster/selection visual states
- `Patches.js` — cone geometry patches (tips point inward, bases face outward)
- `ClusteringPane.js` — DBSCAN clustering UI with histogram
- `ColorSchemeSelector.js` — 6 color schemes, persisted to `localStorage`
- `utils/fileTypeDetector.js` — content-based file format detection

### File Format Support

| Format | Files | Detection |
|--------|-------|-----------|
| Lorenzo topology | `.top` | `<count> <type_count>` header |
| Flavio topology | `particles.txt` + `patches.txt` | companion files |
| Raspberry topology | `.top` | `iP`/`iR`/`iC` keywords in file |
| MGL (self-contained) | `.mgl` | `@` separator + optional `.Box:` header |
| Trajectory | `.dat`, `.traj`, `.conf` | content keywords |
| MGL Trajectory | `.mgl` with `.Box:` | multi-frame `.Box:` headers |

File type priority: `traj > last > init > conf`

### Raspberry Format (self-contained `.top`)
```
<N> <type_count>
# comments ignored
iP <id> <strength> <color> <x,y,z> <a1x,a1y,a1z>   # patch definition
iR <x,y,z> <radius>                                  # repulsion site (IDs by order)
iC <type_id> <count> <patch_ids> <repulsion_ids>     # particle type
```
- Uses standard oxDNA trajectory (`.dat`) alongside
- Parsed by `parseRaspberryTopology` in `topologyParser.js`
- Repulsion sites are stored but not currently rendered

## oxDNA Specifics

- Particles have `position (x,y,z)` and orientation vectors `(a1, a3)`
- Patches are in local coordinates, transformed by particle rotation matrix
- Periodic boundary conditions with automatic CoM centering
- Patches rendered as inward-pointing cones (base = interaction zone)

## Performance Patterns

- **Instanced rendering**: `THREE.InstancedMesh` for particles and patches
- **Demand rendering**: `frameloop="demand"` on Canvas to reduce idle CPU
- **Memoized clustering**: only recomputes when epsilon/minPoints change
- Color updates only touch the `instanceColor` buffer, not geometry

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `P` | Screenshot |
| `Q/A` | Shift particles on X-axis |
| `W/S` | Shift particles on Y-axis |
| `E/D` | Shift particles on Z-axis |

## Iframe Embedding

PPView detects iframe mode (`window.self !== window.top`) and hides controls. Supports `postMessage` interface:

- `drop` — load `File[]`
- `download` — trigger screenshot + GLTF export
- `remove-event` — disable drag-drop
- `iframe_drop` — load files with `view_settings` object (`Box`, `Controls`, `PatchLegend`, `ParticleLegend`, `ClusteringPane`, etc.)

## Adding Features

**New file format**: extend `utils/fileTypeDetector.js`, add parser in `App.js#handleFilesReceived`, convert to internal format.

**New analysis feature**: create component in `src/components/`, add state to appropriate store, integrate with `ParticleScene`, add to GLTF export if needed.

**New color scheme**: add entry to `src/colors.js#colorSchemes` with `{ name, colors: ['#hex', ...] }`.

## Color Assignment

```
particle color = scheme.colors[typeIndex % scheme.colors.length]
patch color    = scheme.colors[patchID   % scheme.colors.length]
```

Stored in `localStorage` under key `ppview_color_scheme`.

## Cluster Visualization States

| State | Color | Scale |
|-------|-------|-------|
| Normal | type-based | 1.0× |
| Highlighted cluster | type-based | 1.3× |
| Dimmed (not in selected clusters) | gray | 0.3× |
| Selected particle | yellow | — |
