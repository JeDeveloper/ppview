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
- `OxDNANucleotides.js` — four instanced meshes (backbone sphere, nucleoside ellipsoid, connector cylinder, backbone connector cylinder); raycasts backbone mesh for click/double-click selection; separate lightweight selection effect updates only backbone sphere colors
- `ClusteringPane.js` — DBSCAN clustering UI with histogram
- `ColorSchemeSelector.js` — 6 color schemes, persisted to `localStorage`
- `utils/fileTypeDetector.js` — content-based file format detection

### File Format Support

| Format | Files | Detection |
|--------|-------|-----------|
| oxDNA nucleotide | `.top` | 2-token header + 2nd line has nucleotide letter (A/T/G/C/U) as token[1] |
| Lorenzo topology | `.top` | `<count> <type_count>` 2-token header |
| Flavio topology | `*particles*.txt` + `*.patch.txt` | companion files (name-flexible) |
| Raspberry topology | `.top` | `iP`/`iR`/`iC` keywords in file |
| SRS Springs topology | `.psp` | 4-integer header + `iS` keyword in file |
| MGL (self-contained) | `.mgl` | `@` separator + optional `.Box:` header |
| Trajectory | `.dat`, `.traj`, `.conf` | content keywords |
| MGL Trajectory | `.mgl` with `.Box:` | multi-frame `.Box:` headers |

File type priority: `traj > last > init > conf`

Detection order in `analyzeTopologyFile`: SRS Springs → (2-token header check) → Raspberry → **oxDNA nucleotide** → Flavio → Lorenzo. Format extraction uses `type.split('-').slice(1).join('_')` so `topology-oxdna_nucleotide` → format `oxdna_nucleotide`.

### oxDNA Nucleotide Format (standard `.top`)
```
<N> <nStrands>
<strandId> <base> <n3> <n5>   # one line per nucleotide; n3/n5 index = -1 at chain ends
```
- Parsed by `parseOxDNANucleotideTopology` in `topologyParser.js`
- Returns `nucleotides: [{index, strandId, base, n3, n5}]` and `format: 'oxdna_nucleotide'`
- `particleTypeMapping` assigns one `typeIndex` per strand (for color cycling)
- `ParticleScene` checks `topData?.nucleotides?.length` and renders `OxDNANucleotides` instead of `Particles`

#### OxDNANucleotides geometry (matches oxdna-viewer)
All positions computed from trajectory `a1`/`a3` vectors:
- `a2 = (a3 × a1).normalize()`
- **Backbone**: `bb = p + (−0.34·a1 + 0.3408·a2)`, sphere r=0.2
- **Nucleoside**: `ns = p + 0.34·a1`, sphere r=0.3 scaled `[0.7, 0.3, 0.7]`, rotated Y→a3
- **Connector** (ns↔bb): center=`(bb+ns)/2`, Y→`(bb−ns)`, height=0.8147053, cylinder r=0.1
- **Backbone connector** (bb→n3 bb): center=`(bb+bbN3)/2`, Y→`(bbN3−bb)`, height=`|bbN3−bb|`, tapered cylinder r=0.1→0.02; hidden if length ≥ 0.9×any box dimension
- Strand colors capped at 4 (`% Math.min(4, strandColors.length)`)
- Base colors: A=`0x4747B8`, G=`0xFFFF33`, C=`0x8CFF8C`, T/U=`0xFF3333`
- Uses `setColorAt` (THREE.js native, r130+) — no custom shader needed

#### Selection in OxDNANucleotides
- Click handler on backbone `InstancedMesh` via `gl.domElement` native listener
- `instanceId` from raycast = nucleotide index into `positions` store
- Ctrl/Cmd+click for multi-selection; miss clears selection
- Separate lightweight `useEffect` (depends on `selectedParticles`) updates only backbone sphere colors: selected → yellow, others → strand color
- Double-click calls `onParticleDoubleClick` for camera zoom animation

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

### Flavio Companion File Lookup (`parseFlavioTopology`)
`parseFlavioTopology(content, fileMap, options)` resolves the particles and patches files with a multi-step fallback:

**Particles file** (in priority order):
1. `options.particleFile` — exact name from `particle_file` field in a loaded oxDNA input file
2. `"particles.txt"` — hardcoded fallback
3. Any file in `fileMap` whose name matches `/particles.*\.txt$/i` (e.g. `CRYSTAL.particles (1).txt`)

**Patches file** (in priority order):
1. `options.patchFile` — exact name from `patchy_file` field in a loaded oxDNA input file
2. `"patches.txt"` — hardcoded fallback
3. Any file in `fileMap` whose name ends with `.patch.txt` (e.g. `sat3.patch.txt`)

`options` is populated in `App.js` from a parsed oxDNA input file (`particle_file` / `patchy_file` keys). If no input file is present, `options` is `{}` and the fallbacks apply. `parseTopFile` accepts a 4th `options` argument and forwards it to `parseFlavioTopology`.

**`PATCHY_radius` from input file**: parsed in `App.js` before topology loading and applied via `setParticleRadius`. For Flavio format, `srsParticleRadius` is never set, so the input-file value is preserved.

### Patch Rendering (`Patches.js`)
- Cone tip placed at particle surface, base flares **outward** (away from center)
- Cone geometry translated so tip = origin; rotated so +Y aligns with inward direction
- `coneRadius = particleRadius * 0.4`, `coneHeight = particleRadius * 0.8` — proportional, format-agnostic
- Scale factor: **always** `particleRadius / patchVectorLength` — normalises the patch direction vector to exactly `particleRadius` length, placing the tip on the sphere surface. Works for all formats: unit vectors (Lorenzo, ~1.0), sub-unit Flavio positions (~0.47), and larger absolute-position values. Degenerate vectors (< 1e-9) are skipped.
- Both `useEffect` (standard instanced mode) and `useMemo patchData` (path tracer individual meshes) use the same scale formula
- `particleRadius` is in dependency arrays of both `useEffect` and `useMemo`
- Path tracer mode renders individual `<mesh>` elements per patch; standard mode uses `InstancedMesh`

### Springs Rendering (`Springs.js`)
- Unit `CylinderGeometry(1,1,1,8)` scaled per instance: `scale = (springRadius, distance, springRadius)` where `springRadius = particleRadius * 0.15`
- Cylinder oriented with `setFromUnitVectors(up, dir)` between particle positions
- All skipped instances (degenerate, out-of-range, or too-long) get explicit `makeScale(0,0,0)` matrix to prevent ghost cylinders at origin and stale matrices during translation

## oxDNA Specifics

- Trajectory positions have `{x, y, z, a1: {x,y,z}, a3: {x,y,z}}` — orientation vectors come from `parseConfiguration` in `trajectoryLoader.js`
- Standard oxDNA topology (nucleotide format) triggers `OxDNANucleotides` rendering; patchy-particle topologies (Lorenzo/Flavio/Raspberry/SRS) use `Particles` rendering
- Patches for patchy particles are in local coordinates, transformed by particle rotation matrix
- Periodic boundary conditions with automatic CoM centering
- Patches rendered as outward-pointing cones (tip on surface, base outside)

## Performance Patterns

- **Instanced rendering**: `THREE.InstancedMesh` for particles, patches, repulsion site beads, springs, and all four nucleotide mesh types
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

**New file format**: extend `utils/fileTypeDetector.js` (add detection in `analyzeTopologyFile` — note the detection order above), add parser in `topologyParser.js`, dispatch in `parseTopFile`, add to the `categorizeFiles` switch in `fileTypeDetector.js`, handle any format-specific store initialization in `App.js`.

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
