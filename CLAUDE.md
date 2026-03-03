# PPView - Claude Code Guide

PPView is a React-based 3D visualization tool for oxDNA molecular dynamics simulations and patchy particle systems.

## Tech Stack

- **React 18.3.1** (Create React App)
- **Three.js 0.168.0** + **React Three Fiber 8.17.7** + **@react-three/drei 9.113.0**
- **@react-three/gpu-pathtracer** for path tracing mode
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
- `src/store/particleStore.js` — particle/trajectory data (`positions`, `topData`, `trajFile`, `configIndex`, `particleRadius`, etc.)
- `src/store/uiStore.js` — UI state (legends, toggles, playback, selection, color scheme, iframe mode, pathtracer config)
- `src/store/clusteringStore.js` — clustering highlights (`highlightedClusters` Set, `showOnlyHighlightedClusters`)

Components read from stores directly — **no prop drilling**.

### Key Components
- `App.js` — file loading, trajectory nav, GLTF export, iframe message handling
- `ParticleScene.js` — Three.js scene (lighting, controls, 3D rendering, Springs)
- `Particles.js` — instanced mesh rendering; consolidates all raycasting for click/selection including repulsion site beads (registration pattern)
- `Patches.js` — cone geometry patches; size proportional to `particleRadius` from store; both `useEffect` (standard) and `useMemo patchData` (path tracer) use `particleRadius`-aware scale factor
- `RepulsionSites.js` — instanced bead rendering for raspberry particles; inner sphere hidden, only outer beads rendered and selectable; registers mesh + metadata with `Particles.js` via `onRegister` callback
- `Springs.js` — instanced cylinder rendering for SRS spring bonds; hides springs longer than half box size (periodic boundary filter); uses zero-scale matrix for all skipped instances to avoid ghost artifacts
- `ClusteringPane.js` — DBSCAN clustering UI with histogram
- `ColorSchemeSelector.js` — 6 color schemes, persisted to `localStorage`
- `utils/fileTypeDetector.js` — content-based file format detection

### File Format Support

| Format | Files | Detection |
|--------|-------|-----------|
| Lorenzo topology | `.top` | `<count> <type_count>` 2-token header |
| Flavio topology | `particles.txt` + `patches.txt` | companion files |
| Raspberry topology | `.top` | `iP`/`iR`/`iC` keywords in file |
| SRS Springs topology | `.psp` | 4-integer header + `iS` keyword in file |
| MGL (self-contained) | `.mgl` | `@` separator + optional `.Box:` header |
| Trajectory | `.dat`, `.traj`, `.conf` | content keywords |
| MGL Trajectory | `.mgl` with `.Box:` | multi-frame `.Box:` headers |

File type priority: `traj > last > init > conf`

Detection order in `fileTypeDetector.js`: SRS Springs (4-token header + `iS`) is checked **before** the 2-token header check to avoid mis-classifying `.psp` files. Format extraction uses `type.split('-').slice(1).join('_')` so `topology-srs_springs` → format `srs_springs`.

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
- Inner sphere (center particle) scaled to zero — invisible
- Outer beads rendered as `RepulsionSites` instanced spheres (yellow when selected)
- All raycasting for bead selection is handled by `Particles.js` via `registerRepulsionMesh` callback

#### Selection architecture for raspberry particles
`RepulsionSites` registers `{mesh, numBeads, globalIndices, particlePositions}` with `Particles.js` via `onRegister(typeIndex, data)`. The unified click handler in `Particles.js` first checks the main `InstancedMesh` (skipping particles that `hasRepulsionSites=true`), then iterates `repulsionMeshDataRef.current` to check bead meshes. This avoids the race condition of two separate native DOM click listeners.

### SRS Springs Format (Bullview `.psp`)
```
<numParticles> <numStrands> <maxSpringsPerParticle> <repeatedPatchesPerParticle>
# iP = iP, id, color, strength, x y z
iP <id> <color> <strength> <x> <y> <z>
# iS = iS, id, k, r0, x y z
iS <id> <k> <r0> <x> <y> <z>
# Body: particleType strand radius mass numPatches [patchId...] [neighborIdx springIdx]...
<particleType> <strand> <radius> <mass> <numPatches> [patchIds...] [neighborIdx springIdx]...
```
- Parsed by `parseSRSSpringsTopology` in `topologyParser.js`
- `strand` field → `typeIndex` (mapped via `strandToTypeIndex`)
- Returns `particleTypeMapping` (per-particle patch assignments), `particleTypes` (per-strand summary), `springConnections` (deduplicated by `min(p1,p2)-max(p1,p2)` key), and `srsParticleRadius`
- `App.js` sets `particleRadius` from `srsParticleRadius` after parsing
- Springs rendered by `Springs.js` as gray cylinders; springs longer than `min(box)/2` are hidden
- Patches assigned per-particle from body line; `particlesByType` uses first particle's type as representative per strand

### Patch Rendering (`Patches.js`)
- Cone tip placed at particle surface, base flares **outward** (away from center)
- Cone geometry translated so tip = origin; rotated so +Y aligns with inward direction
- `coneRadius = particleRadius * 0.4`, `coneHeight = particleRadius * 0.8` — proportional, format-agnostic
- Scale factor heuristic: `patchVectorLength < 1.5` → unit-vector format (Flavio): `scaleFactor = particleRadius`; `>= 1.5` → absolute-position format (Lorenzo/SRS): `scaleFactor = particleRadius / patchVectorLength`
- Both `useEffect` (standard instanced mode) and `useMemo patchData` (path tracer individual meshes) use the same `particleRadius`-aware scale
- `particleRadius` is in dependency arrays of both `useEffect` and `useMemo`
- Path tracer mode renders individual `<mesh>` elements per patch; standard mode uses `InstancedMesh`

### Springs Rendering (`Springs.js`)
- Unit `CylinderGeometry(1,1,1,8)` scaled per instance: `scale = (springRadius, distance, springRadius)` where `springRadius = particleRadius * 0.15`
- Cylinder oriented with `setFromUnitVectors(up, dir)` between particle positions
- All skipped instances (degenerate, out-of-range, or too-long) get explicit `makeScale(0,0,0)` matrix to prevent ghost cylinders at origin and stale matrices during translation

## oxDNA Specifics

- Particles have `position (x,y,z)` and orientation vectors `(a1, a3)`
- Patches are in local coordinates, transformed by particle rotation matrix
- Periodic boundary conditions with automatic CoM centering
- Patches rendered as outward-pointing cones (tip on surface, base outside)

## Performance Patterns

- **Instanced rendering**: `THREE.InstancedMesh` for particles, patches, repulsion site beads, and springs
- **Zero-scale hidden instances**: skipped instances use `makeScale(0,0,0)` matrix instead of `continue` to avoid ghost geometry
- **Demand rendering**: `frameloop="demand"` on Canvas (always-on when path tracing)
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

**New file format**: extend `utils/fileTypeDetector.js` (add detection in `analyzeTopologyFile` before the 2-token header fallback if needed), add parser in `topologyParser.js`, dispatch in `parseTopFile`, handle any format-specific store initialization in `App.js`.

**New particle type with custom geometry**: create a component like `RepulsionSites.js`, register its mesh with `Particles.js` via `onRegister` callback to consolidate raycasting, scale the main sphere to zero for that particle type.

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
