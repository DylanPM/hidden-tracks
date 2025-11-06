import React, { useState, useEffect, useMemo } from 'react';
import { useFeatureMap } from '../../hooks/useFeatureMap';

// Human-friendly feature labels (bidirectional) with colors
const FEATURE_CONFIG = {
  danceability: {
    low: { emoji: '🧘', name: 'Chill', desc: 'Relaxed, not for dancing' },
    high: { emoji: '💃', name: 'Dance', desc: 'Made for dancing' },
    color: '#a855f7' // purple
  },
  energy: {
    low: { emoji: '😌', name: 'Calm', desc: 'Mellow and peaceful' },
    high: { emoji: '⚡', name: 'Energetic', desc: 'Intense and active' },
    color: '#ef4444' // red
  },
  speechiness: {
    low: { emoji: '🎵', name: 'Musical', desc: 'Instrumental melodies' },
    high: { emoji: '🗣️', name: 'Wordy', desc: 'Lots of talking/rapping' },
    color: '#eab308' // yellow
  },
  acousticness: {
    low: { emoji: '🎹', name: 'Electronic', desc: 'Synths and machines' },
    high: { emoji: '🎸', name: 'Acoustic', desc: 'Live instruments' },
    color: '#f97316' // orange
  },
  valence: {
    low: { emoji: '😢', name: 'Sad', desc: 'Melancholic feeling' },
    high: { emoji: '😊', name: 'Happy', desc: 'Upbeat and cheerful' },
    color: '#ec4899' // pink
  },
  tempo_norm: {
    low: { emoji: '🐌', name: 'Slow', desc: 'Slower tempo' },
    high: { emoji: '🥁', name: 'Fast', desc: 'Quick tempo' },
    color: '#06b6d4' // cyan
  },
  popularity: {
    low: { emoji: '💎', name: 'Niche', desc: 'Underground and rare' },
    high: { emoji: '🔥', name: 'Popular', desc: 'Mainstream hits' },
    color: '#fbbf24' // amber/gold
  },
  instrumentalness: {
    low: { emoji: '🎤', name: 'Vocal', desc: 'With singing' },
    high: { emoji: '🎼', name: 'Instrumental', desc: 'No vocals' },
    color: '#3b82f6' // blue
  }
};

/**
 * GenreConstellationSelect - Feature Map Version
 *
 * Visualizes genres on a 2D map based on their audio features.
 * Users navigate by clicking genres → subgenres → tracks, then launch.
 */
export function GenreConstellationSelect({ onLaunch }) {
  // Manifest + load state
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // One-time intro
  const [showIntro, setShowIntro] = useState(true);
  useEffect(() => {
    if (sessionStorage.getItem('ht_seen_intro') === '1') setShowIntro(false);
  }, []);
  const dismissIntro = () => {
    sessionStorage.setItem('ht_seen_intro', '1');
    setShowIntro(false);
  };

  // Navigation state
  const [viewStack, setViewStack] = useState([]); // e.g. [], ['rock'], ['rock', 'metal']
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [loadedTracks, setLoadedTracks] = useState([]); // Actual track data with features
  const [selectedNodeKey, setSelectedNodeKey] = useState(null); // Key of node with LAUNCH overlay

  // Visual state
  const [exaggeration, setExaggeration] = useState(1.2);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [hoveredAxisLabel, setHoveredAxisLabel] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(0.85); // Start zoomed out to prevent clipping

  // Active features (all enabled by default)
  const [activeFeatures, setActiveFeatures] = useState({
    danceability: true,
    energy: true,
    speechiness: true,
    acousticness: true,
    valence: true,
    tempo_norm: true,
    popularity: true,
    instrumentalness: true
  });

  // Difficulty (kept for compatibility)
  const [difficulty] = useState('medium');

  // Load manifest
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/genre_constellation_manifest.json');
        if (!res.ok) throw new Error(`Failed to load genre manifest`);
        const data = await res.json();
        setManifest(data);
        setLoading(false);
      } catch (e) {
        setError(e.message);
        setLoading(false);
      }
    })();
  }, []);

  // Helper: Navigate manifest tree by path
  const getManifestNode = (pathArray) => {
    if (!manifest) return null;
    let node = manifest;
    for (const part of pathArray) {
      if (node[part]) node = node[part];
      else if (node.subgenres?.[part]) node = node.subgenres[part];
      else return null;
    }
    return node;
  };

  // Get current node in the tree
  const getCurrentNode = () => getManifestNode(viewStack);

  // Get children of current node
  const getChildren = () => {
    if (viewStack.length === 0) {
      // Root level: show all genres
      if (!manifest) return [];
      return Object.keys(manifest)
        .filter(k => k !== 'global' && k !== 'build' && k !== 'features')
        .map(k => ({ key: k, type: 'genre', data: manifest[k] }));
    }

    // Subgenres
    const node = getCurrentNode();
    if (!node?.subgenres) return [];
    return Object.keys(node.subgenres).map(k => ({
      key: k,
      type: 'subgenre',
      data: node.subgenres[k]
    }));
  };

  // Get seeds for current node
  const getSeeds = () => {
    const node = getCurrentNode();
    if (!node) return [];
    if (viewStack.length === 0) return [];
    return node?.seeds || node?._seeds || [];
  };

  const children = getChildren();
  const seeds = getSeeds();

  // Gather sibling features for local normalization
  const siblingFeatures = useMemo(() => {
    if (children.length === 0) return null;
    return children.map(child => child.data?.features).filter(f => f);
  }, [children]);

  // Compute positions with local normalization
  const { positions: rawPositions } = useFeatureMap(manifest, exaggeration, activeFeatures, siblingFeatures);

  // Clamp positions to octagon boundary
  const positions = useMemo(() => {
    const AXIS_RADIUS = 250;
    const MAX_DISTANCE = AXIS_RADIUS - 60;

    const clamped = {};
    Object.keys(rawPositions).forEach(key => {
      const pos = rawPositions[key];
      const distance = Math.sqrt(pos.x * pos.x + pos.y * pos.y);

      if (distance > MAX_DISTANCE) {
        const scale = MAX_DISTANCE / distance;
        clamped[key] = {
          x: pos.x * scale,
          y: pos.y * scale
        };
      } else {
        clamped[key] = pos;
      }
    });
    return clamped;
  }, [rawPositions]);

  // Description text
  const currentGenre = viewStack.length > 0 ? viewStack[viewStack.length - 1] : null;
  const genreDescription = currentGenre ? getGenreDescription(currentGenre) : 'Choose a genre to explore';

  // Handle clicks
  const handleGenreClick = async (key) => {
    const newStack = [...viewStack, key];
    setViewStack(newStack);
    setSelectedTrack(null);
    setLoadedTracks([]);
    setHoveredItem(null); // Reset hover to prevent ghosting
    // Set LAUNCH overlay on parent node (which will appear in new view)
    setSelectedNodeKey(`parent-${key}`);
    // Progressive zoom: 20% more for each level from 0.85 base
    setZoomLevel(0.85 + (newStack.length * 0.2));
  };

  const handleTrackClick = async (track) => {
    setSelectedTrack(track);
    setSelectedNodeKey(track.uri); // Set LAUNCH overlay on clicked track
  };

  const handleBack = () => {
    if (viewStack.length === 0) return;
    const newStack = viewStack.slice(0, -1);
    setViewStack(newStack);
    setSelectedTrack(null);
    setLoadedTracks([]);
    setHoveredItem(null); // Reset hover to prevent ghosting

    // Progressive zoom: reduce by 20% for each level back from 0.85 base
    setZoomLevel(0.85 + (newStack.length * 0.2));

    // Clear LAUNCH overlay when going back to root
    if (newStack.length === 0) {
      setSelectedNodeKey(null);
    } else {
      // Keep LAUNCH on the parent node
      setSelectedNodeKey(`parent-${newStack[newStack.length - 1]}`);
    }
  };

  const canLaunch = () => seeds.length > 0 || selectedTrack;

  const handleLaunch = () => {
    if (selectedTrack) {
      onLaunch([selectedTrack], difficulty);
      return;
    }
    if (seeds.length > 0) {
      onLaunch(seeds, difficulty);
    }
  };

  // Load track features when showing seeds
  useEffect(() => {
    if (seeds.length === 0) {
      setLoadedTracks([]);
      return;
    }

    (async () => {
      try {
        const tracks = await Promise.all(
          seeds.map(async seed => {
            try {
              const res = await fetch(`/profiles/${seed.filename}`);
              if (!res.ok) return null;
              const profile = await res.json();

              // Clamp track position too
              const rawPos = {
                danceability: profile.seed.danceability,
                energy: profile.seed.energy,
                speechiness: profile.seed.speechiness,
                acousticness: profile.seed.acousticness,
                valence: profile.seed.valence,
                tempo_norm: profile.seed.tempo_norm,
                popularity: profile.seed.popularity,
                instrumentalness: profile.seed.instrumentalness
              };

              return {
                ...seed,
                features: rawPos
              };
            } catch (e) {
              console.warn('Failed to load track features:', seed.filename);
              return null;
            }
          })
        );
        setLoadedTracks(tracks.filter(t => t !== null));
      } catch (e) {
        console.error('Error loading track features:', e);
      }
    })();
  }, [seeds]);

  // Viewport config
  const VIEWPORT_WIDTH = 640;
  const VIEWPORT_HEIGHT = 928;
  const CENTER_X = VIEWPORT_WIDTH / 2;
  const CENTER_Y = VIEWPORT_HEIGHT / 2;

  // Helper: Resolve collisions between nodes
  const resolveCollisions = (items) => {
    const nodeRadius = 27; // Max radius for collision detection
    const overlapThreshold = 0.3; // 30% overlap triggers push
    const pushStrength = 1.5; // How much to push apart
    const maxIterations = 3;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let hadCollision = false;

      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const item1 = items[i];
          const item2 = items[j];

          const dx = item2.x - item1.x;
          const dy = item2.y - item1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = nodeRadius * 2;

          // Calculate overlap percentage
          if (distance < minDistance) {
            const overlap = (minDistance - distance) / minDistance;

            if (overlap > overlapThreshold) {
              hadCollision = true;

              // Push apart along the line connecting them
              const angle = Math.atan2(dy, dx);
              const pushDistance = (minDistance - distance) * pushStrength / 2;

              item1.x -= Math.cos(angle) * pushDistance;
              item1.y -= Math.sin(angle) * pushDistance;
              item2.x += Math.cos(angle) * pushDistance;
              item2.y += Math.sin(angle) * pushDistance;
            }
          }
        }
      }

      if (!hadCollision) break; // Early exit if no collisions found
    }

    return items;
  };

  // Render items with positions
  const renderItems = () => {
    const items = [];

    if (children.length > 0) {
      // Add parent node at its position (if not at root)
      if (viewStack.length > 0) {
        const parentPath = viewStack.join('.');
        const parentPos = positions[parentPath];
        const parentKey = `parent-${viewStack[viewStack.length - 1]}`;
        if (parentPos) {
          items.push({
            key: parentKey,
            label: viewStack[viewStack.length - 1],
            x: parentPos.x,
            y: parentPos.y,
            type: 'parent',
            isParent: true,
            onClick: () => {
              // Select parent for launching
              setSelectedNodeKey(parentKey);
            }
          });
        }
      }

      // Show child genres/subgenres
      children.forEach(child => {
        const path = [...viewStack, child.key].join('.');
        const pos = positions[path];
        if (!pos) return;

        items.push({
          key: child.key,
          label: child.key,
          x: pos.x,
          y: pos.y,
          type: child.type,
          onClick: () => handleGenreClick(child.key)
        });
      });
    } else if (loadedTracks.length > 0) {
      // For tracks: show parent node at center (origin) + tracks in circle
      const parentPath = viewStack.join('.');
      const parentPos = positions[parentPath] || { x: 0, y: 0 };
      const parentKey = `parent-${viewStack[viewStack.length - 1]}`;

      // Add parent node at its position (center of track circle)
      items.push({
        key: parentKey,
        label: viewStack[viewStack.length - 1],
        x: parentPos.x,
        y: parentPos.y,
        type: 'parent',
        isParent: true,
        onClick: () => {
          setSelectedNodeKey(parentKey);
        }
      });

      // Arrange tracks in circle around parent
      const circleRadius = 120;
      const MAX_DISTANCE = 190; // Octagon boundary
      const parentDistance = Math.sqrt(parentPos.x * parentPos.x + parentPos.y * parentPos.y);

      // If parent is near edge, arrange tracks in an arc facing inward
      if (parentDistance > 50) {
        // Calculate angle from center to parent
        const parentAngle = Math.atan2(parentPos.y, parentPos.x);
        // Arrange tracks in a 240-degree arc facing toward center (away from edge)
        const arcStart = parentAngle + Math.PI - (Math.PI * 2 / 3); // 120 degrees before opposite
        const arcEnd = parentAngle + Math.PI + (Math.PI * 2 / 3); // 120 degrees after opposite
        const arcSpan = arcEnd - arcStart;
        const angleStep = arcSpan / (loadedTracks.length > 1 ? loadedTracks.length - 1 : 1);

        loadedTracks.forEach((track, i) => {
          const angle = arcStart + (i * angleStep);
          let x = parentPos.x + Math.cos(angle) * circleRadius;
          let y = parentPos.y + Math.sin(angle) * circleRadius;

          // Clamp to octagon if still outside
          const trackDistance = Math.sqrt(x * x + y * y);
          if (trackDistance > MAX_DISTANCE) {
            const scale = MAX_DISTANCE / trackDistance;
            x *= scale;
            y *= scale;
          }

          items.push({
            key: track.uri || i,
            label: `${track.artist}\n- ${track.name}`,
            x,
            y,
            type: 'track',
            track: track,
            onClick: () => handleTrackClick(track),
            isSelected: selectedTrack?.uri === track.uri
          });
        });
      } else {
        // Parent near center, use full circle
        const angleStep = (Math.PI * 2) / loadedTracks.length;

        loadedTracks.forEach((track, i) => {
          const angle = i * angleStep;
          const x = parentPos.x + Math.cos(angle) * circleRadius;
          const y = parentPos.y + Math.sin(angle) * circleRadius;

          items.push({
            key: track.uri || i,
            label: `${track.artist}\n- ${track.name}`,
            x,
            y,
            type: 'track',
            track: track,
            onClick: () => handleTrackClick(track),
            isSelected: selectedTrack?.uri === track.uri
          });
        });
      }
    }

    return resolveCollisions(items);
  };

  const items = renderItems();

  // Get selected node position for connection lines and LAUNCH overlay
  const selectedNode = items.find(item => item.key === selectedNodeKey);
  const selectedNodePos = selectedNode ? { x: selectedNode.x, y: selectedNode.y } : { x: 0, y: 0 };

  // Axis configuration (bidirectional labels) - 16 evenly spaced segments
  const axisConfig = useMemo(() => {
    if (!manifest?.global) return [];

    const { feature_angles } = manifest.global.display;
    const segmentAngleStep = (Math.PI * 2) / 16; // 16 segments = 22.5° each
    const axisRadius = 340; // Distance from center to axis label (outside octagon ring, further out)

    const labels = [];

    feature_angles.forEach((feature, i) => {
      const config = FEATURE_CONFIG[feature];
      const enabled = activeFeatures[feature] !== false;

      if (!config) return;

      // High end at segment i (0-7)
      const highAngle = i * segmentAngleStep;
      labels.push({
        feature,
        end: 'high',
        angle: highAngle,
        x: Math.cos(highAngle) * axisRadius,
        y: Math.sin(highAngle) * axisRadius,
        emoji: config.high.emoji,
        name: config.high.name,
        desc: config.high.desc,
        enabled
      });

      // Low end at segment (i + 8), which is 180° opposite (8-15)
      const lowAngle = (i + 8) * segmentAngleStep;
      labels.push({
        feature,
        end: 'low',
        angle: lowAngle,
        x: Math.cos(lowAngle) * axisRadius,
        y: Math.sin(lowAngle) * axisRadius,
        emoji: config.low.emoji,
        name: config.low.name,
        desc: config.low.desc,
        enabled
      });
    });

    return labels;
  }, [manifest, activeFeatures]);

  // Compute feature weights for focused node (for disco floor effect)
  const focusedNodeFeatureWeights = useMemo(() => {
    const focusedNode = hoveredItem || selectedNode;
    if (!focusedNode || !manifest?.global) return null;

    // Determine path: parent/track use viewStack, regular node adds its key
    const pathArray = (focusedNode.isParent || focusedNode.track)
      ? viewStack
      : [...viewStack, focusedNode.key];

    const node = getManifestNode(pathArray);
    const nodeFeatures = node?.features;
    if (!nodeFeatures) return null;

    const { feature_angles } = manifest.global.display;
    const { quantiles } = manifest.global;

    // Normalize each feature to 0-1 using quantiles
    const weights = {};
    feature_angles.forEach(feature => {
      const value = nodeFeatures[feature];
      if (value == null || isNaN(value)) {
        weights[feature] = 0.5;
        return;
      }

      const q = quantiles[feature];
      if (!q) {
        weights[feature] = 0.5;
        return;
      }

      // Approximate percentile
      let percentile;
      if (value <= q.p10) percentile = 0.1;
      else if (value <= q.p50) percentile = 0.1 + 0.4 * ((value - q.p10) / (q.p50 - q.p10));
      else if (value <= q.p90) percentile = 0.5 + 0.4 * ((value - q.p50) / (q.p90 - q.p50));
      else percentile = 0.9 + 0.1 * Math.min(1, (value - q.p90) / (q.p90 - q.p50));

      weights[feature] = percentile;
    });

    return weights;
  }, [hoveredItem, selectedNode, manifest, viewStack]);

  // Toggle feature
  const toggleFeature = (feature) => {
    setActiveFeatures(prev => ({ ...prev, [feature]: !prev[feature] }));
  };

  // Enable only one feature
  const enableOnly = (feature) => {
    const newFeatures = {};
    Object.keys(activeFeatures).forEach(f => {
      newFeatures[f] = f === feature;
    });
    setActiveFeatures(newFeatures);
  };

  // Loading / error states
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Loading genres…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative font-sans overflow-hidden">
      {/* Intro modal */}
      {showIntro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70">
          <div className="w-full max-w-xl rounded-2xl bg-zinc-900 shadow-xl border border-zinc-800">
            <div className="p-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-3">Welcome to Hidden Tracks</h2>
              <p className="text-zinc-300 mb-2">
                Explore how algorithmic recommendation systems curate music.
              </p>
              <p className="text-zinc-400 mb-4">
                Pick a genre, sub-genre, or a song, hit LAUNCH, then try to guess which songs would be recommended for a playlist.
              </p>
              <p className="text-zinc-500 text-xs mb-6">
                Built with help from Anthropic's Claude.
              </p>
              <button
                onClick={dismissIntro}
                className="px-5 py-2 rounded-lg font-semibold bg-green-500 text-black hover:bg-green-400 transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature toggles */}
      <div className="fixed right-4 top-4 z-20 bg-zinc-900/90 rounded-lg p-3 max-w-xs border border-zinc-700">
        <div className="text-xs font-bold text-zinc-400 mb-2">FEATURES</div>
        <div className="space-y-1">
          {manifest?.global?.display?.feature_angles.map(feature => {
            const config = FEATURE_CONFIG[feature];
            const enabled = activeFeatures[feature] !== false;
            if (!config) return null;

            return (
              <div key={feature} className="flex items-center gap-2 group">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => toggleFeature(feature)}
                  className="w-3 h-3"
                />
                <span className="text-sm cursor-pointer flex-1" onClick={() => toggleFeature(feature)}>
                  <span className="mr-1">{config.low.emoji}</span>
                  <span className={enabled ? 'text-white' : 'text-zinc-600'}>{config.low.name}</span>
                  <span className="mx-1">↔</span>
                  <span className="mr-1">{config.high.emoji}</span>
                  <span className={enabled ? 'text-white' : 'text-zinc-600'}>{config.high.name}</span>
                </span>
                <button
                  onClick={() => enableOnly(feature)}
                  className="text-xs px-1 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 opacity-0 group-hover:opacity-100 transition"
                  title="Only this one"
                >
                  only
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main canvas */}
      <div className="flex flex-col items-center justify-center min-h-screen">
        <svg
          width={VIEWPORT_WIDTH}
          height={VIEWPORT_HEIGHT}
          viewBox={`0 0 ${VIEWPORT_WIDTH} ${VIEWPORT_HEIGHT}`}
          className="select-none"
          style={{
            transformOrigin: `${CENTER_X + selectedNodePos.x}px ${CENTER_Y + selectedNodePos.y}px`,
            transform: `scale(${zoomLevel})`,
            transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform-origin 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <defs>
            {/* Circular path for orbiting text (follows hover) - closer to node */}
            <path
              id="descPath"
              d={`
                M ${CENTER_X + (hoveredItem?.x || selectedNodePos.x)} ${CENTER_Y + (hoveredItem?.y || selectedNodePos.y)}
                m -60, 0
                a 60,60 0 1,1 120,0
                a 60,60 0 1,1 -120,0
              `}
            />
            {/* Glow filter for hover effect */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            {/* Stronger glow for text (20% more) */}
            <filter id="textGlow">
              <feGaussianBlur stdDeviation="3.6" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Background click area - go back if outside octagon */}
          {viewStack.length > 0 && (
            <rect
              x="0"
              y="0"
              width={VIEWPORT_WIDTH}
              height={VIEWPORT_HEIGHT}
              fill="transparent"
              className="cursor-pointer"
              onClick={handleBack}
            />
          )}

          {/* Subtle background floor coloring - always visible, shows feature colors */}
          {manifest?.global?.display?.feature_angles.map((feature, i) => {
            const angleStep = (Math.PI * 2) / 8;
            const angle = i * angleStep;
            const nextAngle = ((i + 1) % 8) * angleStep;
            const featureColor = FEATURE_CONFIG[feature]?.color || '#22c55e';
            const radius = 250;

            return (
              <path
                key={`floor-bg-${feature}`}
                d={`
                  M ${CENTER_X} ${CENTER_Y}
                  L ${CENTER_X + Math.cos(angle) * radius} ${CENTER_Y + Math.sin(angle) * radius}
                  L ${CENTER_X + Math.cos(nextAngle) * radius} ${CENTER_Y + Math.sin(nextAngle) * radius}
                  Z
                `}
                fill={featureColor}
                opacity={0.08}
                style={{
                  pointerEvents: 'none'
                }}
              />
            );
          })}

          {/* Disco floor - connected polygon based on feature weights */}
          {focusedNodeFeatureWeights && (() => {
            const feature_angles = manifest?.global?.display?.feature_angles;
            if (!feature_angles) return null;

            const angleStep = (Math.PI * 2) / 8;
            const maxRadius = 250;
            const minRadius = 50;

            // Calculate spike endpoints
            const points = feature_angles.map((feature, i) => {
              const angle = i * angleStep;
              const weight = focusedNodeFeatureWeights[feature];
              const strength = Math.abs(weight - 0.5) * 2;
              const spikeRadius = minRadius + (strength * (maxRadius - minRadius));

              return {
                x: CENTER_X + Math.cos(angle) * spikeRadius,
                y: CENTER_Y + Math.sin(angle) * spikeRadius,
                weight,
                strength
              };
            });

            // Create path connecting all points
            const pathData = points.map((p, i) =>
              `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
            ).join(' ') + ' Z';

            // Find dominant feature (highest strength) and use its color
            let dominantFeature = feature_angles[0];
            let maxStrength = points[0].strength;
            points.forEach((p, i) => {
              if (p.strength > maxStrength) {
                maxStrength = p.strength;
                dominantFeature = feature_angles[i];
              }
            });

            const color = FEATURE_CONFIG[dominantFeature]?.color || '#22c55e';
            const avgStrength = points.reduce((sum, p) => sum + p.strength, 0) / points.length;
            const opacity = 0.2 + (avgStrength * 0.3);

            return (
              <path
                d={pathData}
                fill={color}
                opacity={opacity}
                stroke={color}
                strokeWidth="2"
                strokeOpacity={opacity * 1.5}
                style={{
                  transition: 'opacity 0.5s ease, fill 0.5s ease, d 0.5s ease',
                  pointerEvents: 'none'
                }}
              />
            );
          })()}

          {/* Circular ring with embedded 16 axis label segments (Trivial Pursuit style) */}
          <g
            style={{
              transformOrigin: `${CENTER_X}px ${CENTER_Y}px`,
              animation: viewStack.length > 0 ? 'breathe 4.5s ease-in-out infinite' : 'none'
            }}
          >
          {axisConfig.map((label, idx) => {
            const isHovered = hoveredAxisLabel === `${label.feature}-${label.end}`;

            // Hover pushes segment outward by 30px
            const outerRadius = isHovered ? 310 : 280;
            const innerRadius = 260;

            // Calculate arc angles for this segment
            const angleStep = (Math.PI * 2) / 16; // 16 segments total
            const startAngle = label.angle - angleStep / 2;
            const endAngle = label.angle + angleStep / 2;

            const featureColor = FEATURE_CONFIG[label.feature]?.color || '#22c55e';

            // Create arc path for this segment
            const outerStart = {
              x: CENTER_X + Math.cos(startAngle) * outerRadius,
              y: CENTER_Y + Math.sin(startAngle) * outerRadius
            };
            const outerEnd = {
              x: CENTER_X + Math.cos(endAngle) * outerRadius,
              y: CENTER_Y + Math.sin(endAngle) * outerRadius
            };
            const innerStart = {
              x: CENTER_X + Math.cos(startAngle) * innerRadius,
              y: CENTER_Y + Math.sin(startAngle) * innerRadius
            };
            const innerEnd = {
              x: CENTER_X + Math.cos(endAngle) * innerRadius,
              y: CENTER_Y + Math.sin(endAngle) * innerRadius
            };

            const segmentPath = `
              M ${outerStart.x} ${outerStart.y}
              A ${outerRadius} ${outerRadius} 0 0 1 ${outerEnd.x} ${outerEnd.y}
              L ${innerEnd.x} ${innerEnd.y}
              A ${innerRadius} ${innerRadius} 0 0 0 ${innerStart.x} ${innerStart.y}
              Z
            `;

            // Text position (curved along arc)
            const textRadius = (outerRadius + innerRadius) / 2;
            const textPathRadius = textRadius;

            return (
              <g key={`ring-segment-${label.feature}-${label.end}`}>
                {/* Arc segment */}
                <path
                  d={segmentPath}
                  fill={featureColor}
                  fillOpacity={label.enabled ? 0.4 : 0.2}
                  stroke={featureColor}
                  strokeWidth="0.5"
                  className="cursor-pointer transition-all duration-200"
                  onClick={viewStack.length > 0 ? handleBack : undefined}
                  onMouseEnter={() => setHoveredAxisLabel(`${label.feature}-${label.end}`)}
                  onMouseLeave={() => setHoveredAxisLabel(null)}
                />

                {/* Curved text along arc */}
                <defs>
                  {/* Title path (outer) */}
                  <path
                    id={`arc-title-${label.feature}-${label.end}`}
                    d={`
                      M ${CENTER_X + Math.cos(startAngle) * (outerRadius - 5)} ${CENTER_Y + Math.sin(startAngle) * (outerRadius - 5)}
                      A ${outerRadius - 5} ${outerRadius - 5} 0 0 1 ${CENTER_X + Math.cos(endAngle) * (outerRadius - 5)} ${CENTER_Y + Math.sin(endAngle) * (outerRadius - 5)}
                    `}
                  />
                  {/* Description path (below title) */}
                  {isHovered && (
                    <path
                      id={`arc-desc-${label.feature}-${label.end}`}
                      d={`
                        M ${CENTER_X + Math.cos(startAngle) * (textPathRadius - 3)} ${CENTER_Y + Math.sin(startAngle) * (textPathRadius - 3)}
                        A ${textPathRadius - 3} ${textPathRadius - 3} 0 0 1 ${CENTER_X + Math.cos(endAngle) * (textPathRadius - 3)} ${CENTER_Y + Math.sin(endAngle) * (textPathRadius - 3)}
                      `}
                    />
                  )}
                </defs>
                {/* Title text */}
                <text
                  fill="white"
                  fontSize={isHovered ? "11" : "10"}
                  fontWeight="700"
                  className="transition-all duration-200"
                  style={{ pointerEvents: 'none' }}
                >
                  <textPath href={`#arc-title-${label.feature}-${label.end}`} startOffset="50%" textAnchor="middle">
                    {label.name}
                  </textPath>
                </text>
                {/* Description text (only on hover) */}
                {isHovered && (
                  <text
                    fill="white"
                    fontSize="7"
                    fontWeight="400"
                    opacity="0.8"
                    style={{ pointerEvents: 'none' }}
                  >
                    <textPath href={`#arc-desc-${label.feature}-${label.end}`} startOffset="50%" textAnchor="middle">
                      {label.desc.slice(0, 25)}
                    </textPath>
                  </text>
                )}
              </g>
            );
          })}
          </g>

          {/* Outward arrows around ring (clickability indicator) */}
          {viewStack.length > 0 && (() => {
            const arrowCount = 8;
            const arrowRadius = 295; // Between ring segments
            const arrowAngleStep = (Math.PI * 2) / arrowCount;

            return Array.from({ length: arrowCount }).map((_, i) => {
              const angle = i * arrowAngleStep;
              const x = CENTER_X + Math.cos(angle) * arrowRadius;
              const y = CENTER_Y + Math.sin(angle) * arrowRadius;

              // Create arrow path pointing outward (chevron style: >>)
              const arrowSize = 10;
              const arrowAngle = 0.35; // Angle spread for arrow lines
              const arrowPath = `
                M ${x + Math.cos(angle) * -2} ${y + Math.sin(angle) * -2}
                L ${x + Math.cos(angle - arrowAngle) * arrowSize} ${y + Math.sin(angle - arrowAngle) * arrowSize}
                M ${x + Math.cos(angle) * -2} ${y + Math.sin(angle) * -2}
                L ${x + Math.cos(angle + arrowAngle) * arrowSize} ${y + Math.sin(angle + arrowAngle) * arrowSize}
              `;

              return (
                <g
                  key={`arrow-${i}`}
                  style={{
                    animation: 'arrowPulse 4.5s ease-in-out infinite',
                    animationDelay: `${i * 0.15}s`
                  }}
                >
                  <path
                    d={arrowPath}
                    stroke="#71717a"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    fill="none"
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              );
            });
          })()}

          {/* Axis lines (8 total) - point to center of ring segments */}
          {manifest?.global?.display?.feature_angles.map((feature, i) => {
            const angleStep = (Math.PI * 2) / 8;
            const angle = i * angleStep;
            const enabled = activeFeatures[feature] !== false;

            return (
              <line
                key={`axis-${feature}`}
                x1={CENTER_X}
                y1={CENTER_Y}
                x2={CENTER_X + Math.cos(angle) * 270}
                y2={CENTER_Y + Math.sin(angle) * 270}
                stroke="#3f3f46"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity={enabled ? 0.3 : 0.1}
              />
            );
          })}

          {/* Connection lines from selected node to children (always visible) */}
          {selectedNodeKey && items.map(item => (
            <line
              key={`line-${item.key}`}
              x1={CENTER_X + selectedNodePos.x}
              y1={CENTER_Y + selectedNodePos.y}
              x2={CENTER_X + item.x}
              y2={CENTER_Y + item.y}
              stroke="#22c55e"
              strokeWidth={hoveredItem?.key === item.key ? "3" : "1"}
              opacity={hoveredItem?.key === item.key ? 0.8 : 0.2}
              strokeDasharray={hoveredItem?.key === item.key ? "0" : "2 2"}
              style={{
                transition: 'all 0.2s ease'
              }}
            />
          ))}

          {/* Items (genres/subgenres/tracks) */}
          {items.map(item => {
            const isSelected = item.key === selectedNodeKey;
            const isHovered = hoveredItem?.key === item.key;
            const nodeRadius = item.type === 'track' ? 21 : 27; // Further reduced for less overlap
            const launchRingRadius = 60; // Outer ring for LAUNCH overlay

            return (
              <g
                key={item.key}
                onMouseEnter={() => setHoveredItem(item)}
                onMouseLeave={() => setHoveredItem(null)}
                className="cursor-pointer"
                transform={`translate(${CENTER_X + item.x}, ${CENTER_Y + item.y})`}
              >
                {/* LAUNCH overlay ring (if selected or hovered) */}
                {(isSelected || isHovered) && canLaunch() && (
                  <>
                    {/* Clickable launch ring (between node and outer ring) */}
                    <circle
                      r={launchRingRadius}
                      fill="#22c55e"
                      opacity="0.15"
                      className="cursor-pointer hover:opacity-30 transition-opacity"
                      style={{
                        animation: 'pulse 2s ease-in-out infinite'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLaunch();
                      }}
                    />
                    {/* Outer stroke for text ring */}
                    <circle
                      r={launchRingRadius}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="2"
                      opacity="0.6"
                      style={{ pointerEvents: 'none' }}
                    />
                    {/* Go! text on launch ring */}
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#22c55e"
                      fontSize="16"
                      fontWeight="900"
                      style={{ pointerEvents: 'none' }}
                      stroke="#18181b"
                      strokeWidth="3"
                      paintOrder="stroke"
                    >
                      Go!
                    </text>
                  </>
                )}

                {/* Main node circle */}
                <circle
                  r={nodeRadius}
                  fill={isSelected ? '#22c55e' : '#18181b'}
                  fillOpacity={isSelected || isHovered ? 1.0 : 0.6}
                  stroke={isSelected ? '#22c55e' : item.isSelected ? '#eab308' : isHovered ? '#16a34a' : '#22c55e'}
                  strokeWidth={isSelected ? '4' : item.isSelected ? '4' : isHovered ? '3' : '2'}
                  strokeOpacity={isSelected || isHovered ? 1.0 : 0.6}
                  className="hover:fill-zinc-800 transition-all"
                  filter={isHovered ? 'url(#glow)' : undefined}
                  onClick={item.onClick}
                />

                {/* Node label - always show circular text around edge */}
                <defs>
                  <path
                    id={`nodePath-${item.key}`}
                    d={`
                      M 0 0
                      m -${nodeRadius}, 0
                      a ${nodeRadius},${nodeRadius} 0 1,1 ${nodeRadius * 2},0
                      a ${nodeRadius},${nodeRadius} 0 1,1 -${nodeRadius * 2},0
                    `}
                  />
                </defs>
                <text
                  fill="white"
                  fillOpacity={isSelected || isHovered ? 1.0 : 0.6}
                  fontSize={isHovered ? (item.type === 'track' ? 13.2 : 15.6) : (item.type === 'track' ? 9.6 : 12)}
                  fontWeight="600"
                  filter={isHovered ? 'url(#textGlow)' : undefined}
                  style={{
                    pointerEvents: 'none',
                    transition: 'font-size 0.15s ease, fill-opacity 0.15s ease'
                  }}
                >
                  <textPath href={`#nodePath-${item.key}`} startOffset="0%">
                    {item.label.length > 20 ? item.label.slice(0, 20) + '…' : item.label}
                  </textPath>
                </text>

                {/* Go! text in center (follows hover) */}
                {(isSelected || isHovered) && (
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="14"
                    fontWeight="900"
                    style={{ pointerEvents: 'none' }}
                  >
                    Go!
                  </text>
                )}
              </g>
            );
          })}

          {/* Orbiting description text (follows hover, shows genre descriptions) */}
          {selectedNode && (
            <g
              style={{
                transformOrigin: `${CENTER_X + (hoveredItem?.x || selectedNodePos.x)}px ${CENTER_Y + (hoveredItem?.y || selectedNodePos.y)}px`,
                animation: `orbit 11000ms linear infinite`,
                pointerEvents: 'none'
              }}
            >
              <text fontSize="14" fill="#b7f7cf" fontWeight="600" letterSpacing="0.5px">
                <textPath href="#descPath" startOffset="0%">
                  {hoveredItem
                    ? (hoveredItem.type === 'track' && hoveredItem.track
                        ? `${hoveredItem.track.artist} - ${hoveredItem.track.name}`
                        : getGenreDescription(hoveredItem.label))
                    : (selectedNode.type === 'track' && selectedNode.track
                        ? `${selectedNode.track.artist} - ${selectedNode.track.name}`
                        : genreDescription)
                  }
                </textPath>
              </text>
            </g>
          )}

          {/* Root-level instruction text (outside ring) */}
          {!selectedNode && viewStack.length === 0 && (
            <>
              <defs>
                <path
                  id="rootPath"
                  d={`
                    M ${CENTER_X} ${CENTER_Y}
                    m -300, 0
                    a 300,300 0 1,1 600,0
                    a 300,300 0 1,1 -600,0
                  `}
                />
              </defs>
              <g
                style={{
                  transformOrigin: `${CENTER_X}px ${CENTER_Y}px`,
                  animation: `orbit 18000ms linear infinite`,
                  pointerEvents: 'none'
                }}
              >
                <text fontSize="16" fill="#b7f7cf" fontWeight="700" letterSpacing="1px">
                  <textPath href="#rootPath" startOffset="0%">
                    Click a genre to explore the musical landscape
                  </textPath>
                </text>
                <text fontSize="16" fill="#b7f7cf" fontWeight="700" letterSpacing="1px">
                  <textPath href="#rootPath" startOffset="50%">
                    Click a genre to explore the musical landscape
                  </textPath>
                </text>
              </g>
            </>
          )}

          {/* BACK text orbiting outside ring (when navigated) */}
          {viewStack.length > 0 && (
            <>
              <defs>
                <path
                  id="backPath"
                  d={`
                    M ${CENTER_X} ${CENTER_Y}
                    m -300, 0
                    a 300,300 0 1,1 600,0
                    a 300,300 0 1,1 -600,0
                  `}
                />
              </defs>
              <g
                style={{
                  transformOrigin: `${CENTER_X}px ${CENTER_Y}px`,
                  animation: `orbit 20000ms linear infinite`,
                  pointerEvents: 'none'
                }}
              >
                <text fontSize="14" fill="#71717a" fontWeight="900" letterSpacing="1px">
                  <textPath href="#backPath" startOffset="0%">
                    ▷ Tap outside the ring to go back a level
                  </textPath>
                </text>
                <text fontSize="14" fill="#71717a" fontWeight="900" letterSpacing="1px">
                  <textPath href="#backPath" startOffset="50%">
                    ▷ Tap outside the ring to go back a level
                  </textPath>
                </text>
              </g>
            </>
          )}
        </svg>
      </div>

      {/* Debug: Exaggeration slider */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-zinc-800/90 px-4 py-2 rounded-lg z-30">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">Spread:</span>
          <input
            type="range"
            min="0.5"
            max="4.0"
            step="0.1"
            value={exaggeration}
            onChange={(e) => setExaggeration(parseFloat(e.target.value))}
            className="w-32"
          />
          <span className="text-xs text-white font-mono">{exaggeration.toFixed(1)}</span>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes orbit {
          from { transform: rotate(360deg); }
          to   { transform: rotate(0deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.25; transform: scale(1.05); }
        }
        @keyframes backPulse {
          0%, 100% { fill-opacity: 0.2; }
          50% { fill-opacity: 0.35; }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.008); }
        }
        @keyframes arrowPulse {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

// Genre descriptions (kept from original)
function getGenreDescription(genreName) {
  const map = {
    rock: 'Guitars forward, live drum feel, verse–chorus lift. Expect riffs, backbeat, and amp grit.',
    electronic: 'Synths, drum machines, and grid-tight rhythm. Texture and pulse drive the form.',
    'hip hop': 'Drum patterns and vocal rhythm lead. Kicks, snares, and flow sit in the pocket.',
    'r&b': 'Smooth vocals over pocketed drums and warm chords. Melody glides and bass sings.',
    soul: 'Powerful vocals, rich harmony, and groove-led rhythm sections.',
    funk: 'Syncopated bass, clipped guitars, tight drums. The pocket is the hook.',
    jazz: 'Improvisation, extended harmony, acoustic or electric ensembles, swing or straight.',
    country: 'Story-first songs, steady backbeat, twang color. Choruses land clean.',
    folk: 'Acoustic instruments, intimate vocals, lyric focus, simple harmonic movement.',
    latin: 'Percussive rhythm languages, clave patterns, dance forms, bright hooks.',
    reggae: 'Off-beat skank guitar, deep bass, laid-back groove, spacious mix.',
    afrobeat: 'Polyrhythms, long vamps, horn punches, call and response.',
    classical: 'Orchestral or chamber instruments, formal structures, dynamic range.',
    experimental: 'Form and timbre as a playground. Expect rule-bending structures.',
    metal: 'High-gain guitars, aggressive drums, extended techniques, darker harmony.',
    punk: 'Fast, raw, direct. Power chords, shouted hooks, minimal ornament.',
    house: 'Four-on-the-floor, warm bass, looped chords, long builds.',
    techno: 'Machine pulse and evolving timbre. Functional rhythm for movement.',
    trance: 'Big melodic leads, saw stacks, euphoric drops, long phrases.',
    dubstep: 'Half-time lurch, wobble bass, stark space between hits.',
    rap: 'Bars over drums, cadence and rhyme carry the hook.',
    trap: 'Fast hats, 808 subs, sparse melodies, minor-key pads.',
    // Jazz subgenres
    'cool jazz': 'Relaxed tempos, lighter tone, contrapuntal arrangements. West Coast restraint.',
    'nu jazz': 'Electronic textures meet jazz harmony. Broken beats and ambient drift.',
    bebop: 'Fast tempos, complex changes, virtuosic solos. Head-solo-head form.',
    'hard bop': 'Gospel and blues inflections added to bebop language. Groovier, earthier.',
    'smooth jazz': 'Radio-friendly melodies, steady grooves, polished production. Easy flow.',
    'jazz fusion': 'Electric instruments, rock/funk energy, extended soloing over vamps.',
    swing: 'Big band arrangements, danceable pulse, riff-based melodies.',
    'bossa nova': 'Samba rhythms slowed, whisper-close vocals, jazz chords, gentle movement.',
    // Rock subgenres
    'alternative rock': 'Indie spirit, wider palette than classic rock. Hooks with bite.',
    'indie rock': 'DIY ethos, melodic focus, jangly guitars, earnest delivery.',
    shoegaze: 'Wall-of-sound guitars, buried vocals, texture over clarity, dreamy wash.',
    'classic rock': 'Blues-based riffs, anthem choruses, guitar solos. Stadium-ready.',
    'garage rock': 'Raw, lo-fi, energetic. Three chords and attitude.',
    'psychedelic rock': 'Effects-heavy, extended jams, modal harmony, consciousness expansion.',
    'hard rock': 'Louder, heavier blues rock. Big riffs, powerful vocals.',
    'roots rock': 'Back to basics, Americana influence, organic feel, honest lyrics.',
    'southern rock': 'Blues and country blend, dual guitars, regional pride.',
    // Metal subgenres
    'stoner metal': 'Downtuned, fuzzy, groove-heavy. Desert rock meets Black Sabbath.',
    'death metal': 'Extreme vocals, blast beats, complex riffing, dark themes.',
    'nu metal': 'Hip-hop rhythms, downtuned guitars, angst-driven vocals.',
    // Punk subgenres
    emo: 'Emotional lyrics, dynamic shifts, melodic hardcore roots, confessional tone.',
    // Electronic subgenres
    'deep house': 'Warm, soulful, subtle. Jazz and soul samples over steady kick.',
    'tech house': 'Minimal, techy, stripped-back. Focus on groove and rhythm.',
    'progressive house': 'Long builds, layered melodies, journey-focused arrangements.',
    'drum and bass': 'Breakbeats at 170+ BPM, heavy bass, jungle energy.',
    'uk garage': '2-step rhythms, shuffled hi-hats, bass pressure, nocturnal vibe.',
    synthwave: 'Retro-futuristic, 80s nostalgia, analog synths, neon aesthetics.',
    ambient: 'Atmospheric, minimal rhythm, sound design focus, immersive space.',
    // Pop subgenres
    pop: 'Hook-first songwriting, radio-ready production, universal appeal.',
    'dance pop': 'Four-on-floor beats, catchy vocals, club-ready energy.',
    'indie pop': 'Jangly, melodic, DIY charm, lighter touch than indie rock.',
    electropop: 'Synth-driven pop, bright production, electronic textures.',
    // Hip Hop subgenres
    drill: 'Dark, aggressive, sliding 808s, street narratives, ominous atmosphere.',
    'gangsta rap': 'Hard-hitting beats, street life stories, West Coast G-funk or East Coast boom-bap.',
    'east coast hip hop': 'Sample-heavy, boom-bap drums, lyrical focus, NYC swagger.',
    'west coast rap': 'G-funk synths, laid-back grooves, melodic bass, California sun.',
    'southern hip hop': 'Crunk energy or chopped & screwed, regional slang, 808 bass.',
    'conscious hip hop': 'Socially aware lyrics, jazz/soul samples, message-driven.',
    'underground hip hop': 'Independent, experimental, lyrical depth, anti-commercial.',
    phonk: 'Memphis rap samples, dark aesthetic, cowbell hits, lo-fi crunch.',
    'cloud rap': 'Ethereal beats, Auto-Tuned flows, spacious mix, dreamy atmosphere.',
    // Soul/R&B subgenres
    disco: 'Four-on-the-floor, string sections, funk bass, dance floor euphoria.',
    motown: 'Polished pop-soul, tambourine backbeat, call-response vocals, Detroit sound.',
    'neo soul': 'Vintage soul modernized, live instrumentation, introspective lyrics.',
    'quiet storm': 'Late-night smooth R&B, mellow grooves, romantic themes.',
    // Reggae subgenres
    reggaeton: 'Dembow rhythm, Spanish vocals, reggae/dancehall roots, Latin fusion.',
    dancehall: 'Digital riddims, DJ toasts, upbeat energy, Jamaican patois.',
    ska: 'Upstroke guitars, walking bass, horn sections, precursor to reggae.',
    dub: 'Remix culture, heavy reverb/delay, bass emphasis, stripped-down versions.',
    // Latin subgenres
    salsa: 'Clave-driven, horn sections, piano montunos, Afro-Cuban roots.',
    cumbia: 'Colombian rhythms, accordion or synths, dancing groove, infectious pulse.',
    mambo: 'Big band Latin jazz, syncopated brass, dance-floor energy.',
    merengue: 'Fast 2/4 rhythm, accordion, tambora drums, Dominican dance music.',
    'latin pop': 'Pop structures with Latin rhythms, crossover appeal, Spanish or bilingual.',
    tropical: 'Caribbean and Latin dance rhythms, bright production, summer vibes.',
    afropop: 'African rhythms meet pop production, joyful energy, pan-African fusion.',
    amapiano: 'South African house, log drum bass, jazzy keys, laid-back groove.',
    // Classical subgenres
    'modern classical': 'Contemporary composition, extended techniques, film score aesthetics.',
    romantic: 'Emotional expression, rich orchestration, 19th century European tradition.',
    // Country subgenres
    'classic country': 'Honky-tonk piano, steel guitar, traditional songwriting, Nashville sound.',
    'country rock': 'Electric guitars, rock energy, country storytelling, Southern California vibe.',
    'outlaw country': 'Anti-Nashville, rough edges, rebellious spirit, Willie & Waylon.',
    // Blues
    blues: 'Twelve-bar form, call and response, bent notes, emotional catharsis.',
    bluegrass: 'Acoustic strings, high lonesome vocals, virtuosic picking, Appalachian roots.',
    'indie folk': 'Acoustic intimacy, poetic lyrics, folk traditions modernized, lo-fi warmth.',
  };
  const key = String(genreName || '').toLowerCase();
  return map[key] || 'Choose a genre, subgenre, or track to explore its hidden patterns';
}
