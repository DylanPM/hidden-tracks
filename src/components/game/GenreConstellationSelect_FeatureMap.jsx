import React, { useState, useEffect, useMemo } from 'react';
import { useFeatureMap } from '../../hooks/useFeatureMap';

// Font standardization system
const FONT_STYLES = {
  largest: {
    // Ring instruction text (circling "Click anywhere outside...")
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: '1px'
  },
  large: {
    // Focus ring text, outer ring labels
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: '0.5px'
  },
  medium: {
    // Genre node title, inner node text
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: '0px'
  },
  small: {
    // More information text inside ring extrusion
    fontSize: 9,
    fontWeight: 500,
    letterSpacing: '0px'
  }
};

// Human-friendly feature labels (bidirectional) with Spotify-inspired colors
const FEATURE_CONFIG = {
  danceability: {
    low: { emoji: '🧘', name: 'Chill', desc: 'Relaxed, not for dancing', info: 'How suitable for dancing. Chill tracks feel contemplative; danceable tracks have strong beat and rhythm.' },
    high: { emoji: '💃', name: 'Danceable', desc: 'Made for dancing', info: 'How suitable for dancing. Chill tracks feel contemplative; danceable tracks have strong beat and rhythm.' },
    color: '#8B5CF6' // Muted purple
  },
  energy: {
    low: { emoji: '😌', name: 'Calm', desc: 'Mellow and peaceful', info: 'Perceptual intensity from 0-1. Calm is gentle; energetic is fast, loud, and noisy.' },
    high: { emoji: '⚡', name: 'Energetic', desc: 'Intense and active', info: 'Perceptual intensity from 0-1. Calm is gentle; energetic is fast, loud, and noisy.' },
    color: '#EF4444' // Vibrant red
  },
  speechiness: {
    low: { emoji: '🎵', name: 'Wordless', desc: 'Instrumental melodies', info: 'Presence of spoken words. Wordless is pure music; wordy contains talk shows, podcasts, or rap.' },
    high: { emoji: '🗣️', name: 'Wordy', desc: 'Lots of talking/rapping', info: 'Presence of spoken words. Wordless is pure music; wordy contains talk shows, podcasts, or rap.' },
    color: '#F59E0B' // Amber
  },
  acousticness: {
    low: { emoji: '🎹', name: 'Electric', desc: 'Synths and machines', info: 'Confidence that track uses acoustic instruments. Electric is electronic/synthesized; acoustic is unplugged.' },
    high: { emoji: '🎸', name: 'Acoustic', desc: 'Live instruments', info: 'Confidence that track uses acoustic instruments. Electric is electronic/synthesized; acoustic is unplugged.' },
    color: '#EC4899' // Pink
  },
  valence: {
    low: { emoji: '😢', name: 'Sad', desc: 'Melancholic feeling', info: 'Musical positiveness. Sad tracks sound negative (angry, depressed); happy tracks sound positive (cheerful, euphoric).' },
    high: { emoji: '😊', name: 'Happy', desc: 'Upbeat and cheerful', info: 'Musical positiveness. Sad tracks sound negative (angry, depressed); happy tracks sound positive (cheerful, euphoric).' },
    color: '#FB923C' // Orange
  },
  tempo_norm: {
    low: { emoji: '🐌', name: 'Slow', desc: 'Slower tempo', info: 'Overall tempo in BPM. Slow is laid-back and relaxed; fast is driving and urgent.' },
    high: { emoji: '🥁', name: 'Fast', desc: 'Quick tempo', info: 'Overall tempo in BPM. Slow is laid-back and relaxed; fast is driving and urgent.' },
    color: '#06B6D4' // Cyan
  },
  popularity: {
    low: { emoji: '💎', name: 'Niche', desc: 'Underground and rare', info: 'Based on play count and recency. Niche is underground; popular is mainstream hits.' },
    high: { emoji: '🔥', name: 'Popular', desc: 'Mainstream hits', info: 'Based on play count and recency. Niche is underground; popular is mainstream hits.' },
    color: '#FBBF24' // Yellow
  },
  instrumentalness: {
    low: { emoji: '🎤', name: 'Vocal', desc: 'With singing', info: 'Predicts absence of vocals. Vocal has singing/lyrics; instrumental is purely musical.' },
    high: { emoji: '🎼', name: 'Instrumental', desc: 'No vocals', info: 'Predicts absence of vocals. Vocal has singing/lyrics; instrumental is purely musical.' },
    color: '#3B82F6' // Blue
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
  const [showBackHint, setShowBackHint] = useState(false);
  const [backHintInterval, setBackHintInterval] = useState(null);
  const [backHintInitialTimeout, setBackHintInitialTimeout] = useState(null);
  const [backHintPosition, setBackHintPosition] = useState({ x: 0, y: 0 });

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

  // Compute positions with global normalization (for root level)
  const { positions: rawGlobalPositions } = useFeatureMap(manifest, exaggeration, activeFeatures, null);

  // Compute positions with local normalization (for nested levels)
  const siblingFeatures = viewStack.length > 0 && children.length > 0
    ? children.map(c => c.data?.features).filter(f => f)
    : null;
  const { positions: rawLocalPositions } = useFeatureMap(manifest, exaggeration, activeFeatures, siblingFeatures);

  // Clamp positions to octagon boundary
  const globalPositions = useMemo(() => {
    const AXIS_RADIUS = 250;
    const MAX_DISTANCE = AXIS_RADIUS - 60;

    const clamped = {};
    Object.keys(rawGlobalPositions).forEach(key => {
      const pos = rawGlobalPositions[key];
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
  }, [rawGlobalPositions]);

  const localPositions = useMemo(() => {
    const AXIS_RADIUS = 250;
    const MAX_DISTANCE = AXIS_RADIUS - 60;

    const clamped = {};
    Object.keys(rawLocalPositions).forEach(key => {
      const pos = rawLocalPositions[key];
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
  }, [rawLocalPositions]);

  // Use global positions for root, local for nested levels
  const positions = viewStack.length === 0 ? globalPositions : localPositions;

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
    setShowBackHint(false); // Hide hint when going back
    if (backHintInitialTimeout) clearTimeout(backHintInitialTimeout);
    if (backHintInterval) clearInterval(backHintInterval);

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
      // Two modes: root level (absolute positions) vs nested levels (centered with relative positions)
      if (viewStack.length === 0) {
        // ROOT LEVEL: Show genres at their absolute feature positions
        children.forEach(child => {
          const path = child.key;
          const pos = positions[path];
          if (!pos) return;

          const childData = child.data;
          const hasSubgenresData = childData?.subgenres && Object.keys(childData.subgenres).length > 0;
          const hasSeeds = (childData?.seeds || childData?._seeds)?.length > 0;
          const hasSubgenres = hasSubgenresData || hasSeeds;

          items.push({
            key: child.key,
            label: child.key,
            x: pos.x,
            y: pos.y,
            type: child.type,
            hasSubgenres,
            hasSeeds,
            onClick: () => handleGenreClick(child.key)
          });
        });
      } else {
        // NESTED LEVEL: Center parent and show children at local attribute positions
        const parentKey = `parent-${viewStack[viewStack.length - 1]}`;
        const parentData = getCurrentNode();

        items.push({
          key: parentKey,
          label: viewStack[viewStack.length - 1],
          x: 0, // Center parent at origin (UX choice, not attribute-based)
          y: 0,
          type: 'parent',
          isParent: true,
          hasSubgenres: false,
          hasSeeds: (parentData?.seeds || parentData?._seeds)?.length > 0,
          onClick: () => {
            setSelectedNodeKey(parentKey);
          }
        });

        // Show children at their local attribute positions (normalized to siblings)
        children.forEach((child) => {
          const childPath = [...viewStack, child.key].join('.');
          const childPos = positions[childPath];

          if (!childPos) return;

          const childData = child.data;
          const hasSubgenresData = childData?.subgenres && Object.keys(childData.subgenres).length > 0;
          const hasSeeds = (childData?.seeds || childData?._seeds)?.length > 0;
          const hasSubgenres = hasSubgenresData || hasSeeds;

          items.push({
            key: child.key,
            label: child.key,
            x: childPos.x, // Use local position directly (already normalized to siblings)
            y: childPos.y,
            type: child.type,
            hasSubgenres,
            hasSeeds,
            onClick: () => handleGenreClick(child.key)
          });
        });
      }
    } else if (loadedTracks.length > 0) {
      // For tracks: show parent node at center + tracks in circle
      const parentKey = `parent-${viewStack[viewStack.length - 1]}`;
      const parentData = getCurrentNode();

      // Add parent node at center
      items.push({
        key: parentKey,
        label: viewStack[viewStack.length - 1],
        x: 0, // Center at origin
        y: 0,
        type: 'parent',
        isParent: true,
        hasSubgenres: false,
        hasSeeds: (parentData?.seeds || parentData?._seeds)?.length > 0,
        onClick: () => {
          setSelectedNodeKey(parentKey);
        }
      });

      // Arrange tracks in full circle around parent
      const circleRadius = 120;
      const angleStep = (Math.PI * 2) / loadedTracks.length;

      loadedTracks.forEach((track, i) => {
        const angle = i * angleStep;
        const x = Math.cos(angle) * circleRadius;
        const y = Math.sin(angle) * circleRadius;

        items.push({
          key: track.uri || i,
          label: `option ${i + 1}`,
          x,
          y,
          type: 'track',
          track: track,
          hasSubgenres: false,
          hasSeeds: false,
          onClick: () => handleTrackClick(track),
          isSelected: selectedTrack?.uri === track.uri
        });
      });
    }

    return resolveCollisions(items);
  };

  const items = renderItems();

  // Compute preview items when hovering a node with children
  const previewItems = useMemo(() => {
    if (!hoveredItem || !manifest?.global) return [];

    // Determine what would be shown if we clicked this node
    const nextViewStack = hoveredItem.isParent ? viewStack : [...viewStack, hoveredItem.key];

    // Get the node we're previewing
    let previewNode = manifest;
    for (const part of nextViewStack) {
      if (previewNode[part]) previewNode = previewNode[part];
      else if (previewNode.subgenres?.[part]) previewNode = previewNode.subgenres[part];
      else return [];
    }

    /* OLD CODE: Feature-based positioning with local normalization
    // Helper to compute positions with local normalization
    const computeLocalPositions = (subgenres) => {
      const { feature_angles, projection_scale, speechiness_contrast_gamma } = manifest.global.display;
      const { quantiles: globalQuantiles } = manifest.global;

      // Collect sibling features for local normalization
      const siblingFeatures = Object.values(subgenres)
        .map(sg => sg.features)
        .filter(f => f);

      if (siblingFeatures.length === 0) return {};

      // Compute local quantiles
      const localQuantiles = {};
      feature_angles.forEach(featureName => {
        const values = siblingFeatures
          .map(s => s[featureName])
          .filter(v => v != null && !isNaN(v))
          .sort((a, b) => a - b);

        if (values.length === 0) {
          localQuantiles[featureName] = globalQuantiles[featureName];
          return;
        }

        const p10Idx = Math.floor(values.length * 0.1);
        const p50Idx = Math.floor(values.length * 0.5);
        const p90Idx = Math.floor(values.length * 0.9);

        localQuantiles[featureName] = {
          p10: values[p10Idx],
          p50: values[p50Idx],
          p90: values[p90Idx]
        };
      });

      // Project each subgenre to 2D
      const angleStep = (Math.PI * 2) / feature_angles.length;
      const featureAngles = feature_angles.reduce((acc, feature, i) => {
        acc[feature] = i * angleStep;
        return acc;
      }, {});

      const projectTo2D = (features) => {
        let x = 0, y = 0;

        feature_angles.forEach(featureName => {
          if (activeFeatures[featureName] === false) return;

          const rawValue = features[featureName];
          if (rawValue == null || isNaN(rawValue)) return;

          const q = localQuantiles[featureName];
          if (!q) return;

          // Normalize to percentile
          let percentile;
          if (rawValue <= q.p10) percentile = 0.1;
          else if (rawValue <= q.p50) percentile = 0.1 + 0.4 * ((rawValue - q.p10) / (q.p50 - q.p10));
          else if (rawValue <= q.p90) percentile = 0.5 + 0.4 * ((rawValue - q.p50) / (q.p90 - q.p50));
          else percentile = 0.9 + 0.1 * Math.min(1, (rawValue - q.p90) / (q.p90 - q.p50));

          // Apply contrast curve for speechiness
          if (featureName === 'speechiness') {
            percentile = Math.pow(percentile, 1 / speechiness_contrast_gamma);
          }

          // Convert to weight
          const weight = (percentile - 0.5) * 2 * exaggeration;
          const angle = featureAngles[featureName];
          x += weight * Math.cos(angle);
          y += weight * Math.sin(angle);
        });

        return {
          x: x * projection_scale,
          y: y * projection_scale
        };
      };

      const result = {};
      Object.keys(subgenres).forEach(key => {
        if (subgenres[key].features) {
          result[key] = projectTo2D(subgenres[key].features);
        }
      });

      return result;
    };
    */

    // Check if it has subgenres
    if (previewNode.subgenres && Object.keys(previewNode.subgenres).length > 0) {
      // Show subgenres at their local attribute positions (where they'll appear after clicking)
      const subgenreKeys = Object.keys(previewNode.subgenres);
      const previews = [];

      // Compute local positions for preview (normalized to siblings)
      const previewSiblingFeatures = subgenreKeys
        .map(key => previewNode.subgenres[key]?.features)
        .filter(f => f);

      // Use the hook to compute positions with local normalization
      const { positions: previewLocalPositions } = useFeatureMap(
        manifest,
        exaggeration,
        activeFeatures,
        previewSiblingFeatures.length > 0 ? previewSiblingFeatures : null
      );

      subgenreKeys.forEach((key) => {
        // Calculate full path to this subgenre
        const subgenrePath = [...nextViewStack, key].join('.');
        const pos = previewLocalPositions[subgenrePath];

        if (!pos) return;

        const subgenreData = previewNode.subgenres[key];
        const hasSubgenresData = subgenreData?.subgenres && Object.keys(subgenreData.subgenres).length > 0;
        const hasSeeds = (subgenreData?.seeds || subgenreData?._seeds)?.length > 0;

        previews.push({
          key: key,
          label: key,
          x: pos.x,
          y: pos.y,
          type: 'subgenre',
          hasSubgenres: hasSubgenresData || hasSeeds,
          isPreview: true
        });
      });
      return previews;
    }

    // Check if it has seeds (tracks)
    const seeds = previewNode?.seeds || previewNode?._seeds || [];
    if (seeds.length > 0 && loadedTracks.length === 0) {
      // CENTER CODE: Cluster track previews in center of ring
      const numTracks = Math.min(seeds.length, 5); // Show up to 5 track previews
      const previews = [];

      // Arrange in a tight grid centered at origin
      const cols = Math.ceil(Math.sqrt(numTracks));
      const spacing = 60;
      const gridWidth = (cols - 1) * spacing;
      const gridHeight = (Math.ceil(numTracks / cols) - 1) * spacing;

      for (let i = 0; i < numTracks; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = (col * spacing) - (gridWidth / 2);
        const y = (row * spacing) - (gridHeight / 2);

        previews.push({
          key: `preview-track-${i}`,
          label: `option ${i + 1}`,
          x,
          y,
          type: 'track',
          hasSubgenres: false,
          isPreview: true
        });
      }
      return previews;
    }

    return [];
  }, [hoveredItem, manifest, positions, viewStack, loadedTracks, exaggeration, activeFeatures]);

  // Get selected node position for connection lines and LAUNCH overlay
  const selectedNode = items.find(item => item.key === selectedNodeKey);
  const selectedNodePos = selectedNode ? { x: selectedNode.x, y: selectedNode.y } : { x: 0, y: 0 };

  // Axis configuration (bidirectional labels) - 16 evenly-spaced segments
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

      // High end at evenly-spaced positions (0°, 22.5°, 45°, 67.5°, 90°, 112.5°, 135°, 157.5°)
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
        info: config.high.info,
        enabled
      });

      // Low end 180° opposite (8 segments away: 180°, 202.5°, 225°, 247.5°, 270°, 292.5°, 315°, 337.5°)
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
        info: config.low.info,
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
              <div key={feature} className="flex items-center gap-2 group" title={config.low.info}>
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
            transition: 'transform 1.2s cubic-bezier(0.23, 1, 0.32, 1), transform-origin 1.2s cubic-bezier(0.23, 1, 0.32, 1)'
          }}
        >
          <defs>
            {/* Circular path for orbiting text (follows hover) - orbits at green ring edge */}
            <path
              id="descPath"
              d={`
                M ${CENTER_X + (hoveredItem?.x || selectedNodePos.x)} ${CENTER_Y + (hoveredItem?.y || selectedNodePos.y)}
                m -75, 0
                a 75,75 0 1,1 150,0
                a 75,75 0 1,1 -150,0
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
              onMouseMove={(e) => {
                const svg = e.currentTarget.ownerSVGElement;
                const pt = svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
                setBackHintPosition({ x: svgP.x, y: svgP.y });
              }}
              onMouseEnter={() => {
                // Cycle: 2.5s hidden, 2.5s visible, repeat

                // Initial delay before first show
                const initialDelay = setTimeout(() => {
                  setShowBackHint(true);

                  // After showing for the first time, start cycling interval
                  const interval = setInterval(() => {
                    setShowBackHint(prev => !prev);
                  }, 2500);
                  setBackHintInterval(interval);
                }, 2500);

                setBackHintInitialTimeout(initialDelay);
              }}
              onMouseLeave={() => {
                if (backHintInitialTimeout) clearTimeout(backHintInitialTimeout);
                if (backHintInterval) clearInterval(backHintInterval);
                setBackHintInterval(null);
                setBackHintInitialTimeout(null);
                setShowBackHint(false);
              }}
            />
          )}

          {/* Subtle background floor coloring - 16 evenly-spaced segments */}
          {manifest?.global?.display?.feature_angles.map((feature, i) => {
            const segmentAngleStep = (Math.PI * 2) / 16; // 22.5° per segment
            const featureColor = FEATURE_CONFIG[feature]?.color || '#1DB954';
            const radius = 250;

            // High end segment at evenly-spaced position i
            const highStartAngle = i * segmentAngleStep - segmentAngleStep / 2;
            const highEndAngle = i * segmentAngleStep + segmentAngleStep / 2;

            // Low end segment 180° opposite (8 segments away)
            const lowStartAngle = (i + 8) * segmentAngleStep - segmentAngleStep / 2;
            const lowEndAngle = (i + 8) * segmentAngleStep + segmentAngleStep / 2;

            return (
              <g key={`floor-bg-${feature}`}>
                {/* High end segment */}
                <path
                  d={`
                    M ${CENTER_X} ${CENTER_Y}
                    L ${CENTER_X + Math.cos(highStartAngle) * radius} ${CENTER_Y + Math.sin(highStartAngle) * radius}
                    L ${CENTER_X + Math.cos(highEndAngle) * radius} ${CENTER_Y + Math.sin(highEndAngle) * radius}
                    Z
                  `}
                  fill={featureColor}
                  opacity={0.08}
                  style={{ pointerEvents: 'none' }}
                />
                {/* Low end segment */}
                <path
                  d={`
                    M ${CENTER_X} ${CENTER_Y}
                    L ${CENTER_X + Math.cos(lowStartAngle) * radius} ${CENTER_Y + Math.sin(lowStartAngle) * radius}
                    L ${CENTER_X + Math.cos(lowEndAngle) * radius} ${CENTER_Y + Math.sin(lowEndAngle) * radius}
                    Z
                  `}
                  fill={featureColor}
                  opacity={0.08}
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            );
          })}

          {/* Disco floor - connected 16-point polygon based on feature weights */}
          {focusedNodeFeatureWeights && (() => {
            const feature_angles = manifest?.global?.display?.feature_angles;
            if (!feature_angles) return null;

            const segmentAngleStep = (Math.PI * 2) / 16; // 22.5° per segment for even spacing
            const maxRadius = 250;
            const minRadius = 50;

            // Create 16 points at evenly-spaced angles
            const points = [];

            feature_angles.forEach((feature, i) => {
              const weight = focusedNodeFeatureWeights[feature];

              // High end point at evenly-spaced position i
              const highAngle = i * segmentAngleStep;
              const highRadius = minRadius + (weight * (maxRadius - minRadius));
              points.push({
                x: CENTER_X + Math.cos(highAngle) * highRadius,
                y: CENTER_Y + Math.sin(highAngle) * highRadius,
                weight,
                strength: weight
              });
            });

            feature_angles.forEach((feature, i) => {
              const weight = focusedNodeFeatureWeights[feature];

              // Low end point 180° opposite (8 segments away)
              const lowAngle = (i + 8) * segmentAngleStep;
              const lowRadius = minRadius + ((1 - weight) * (maxRadius - minRadius));
              points.push({
                x: CENTER_X + Math.cos(lowAngle) * lowRadius,
                y: CENTER_Y + Math.sin(lowAngle) * lowRadius,
                weight: 1 - weight,
                strength: 1 - weight
              });
            });

            // Create path connecting all 16 points in order
            const pathData = points.map((p, i) =>
              `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
            ).join(' ') + ' Z';

            // Find dominant feature (highest strength from either high or low)
            let dominantFeature = feature_angles[0];
            let maxStrength = 0;
            feature_angles.forEach((feature, i) => {
              const weight = focusedNodeFeatureWeights[feature];
              const highStrength = weight;
              const lowStrength = 1 - weight;

              if (highStrength > maxStrength) {
                maxStrength = highStrength;
                dominantFeature = feature;
              }
              if (lowStrength > maxStrength) {
                maxStrength = lowStrength;
                dominantFeature = feature;
              }
            });

            const color = FEATURE_CONFIG[dominantFeature]?.color || '#1DB954';
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
                  transition: 'opacity 0.8s cubic-bezier(0.23, 1, 0.32, 1), fill 0.8s cubic-bezier(0.23, 1, 0.32, 1), d 0.8s cubic-bezier(0.23, 1, 0.32, 1)',
                  pointerEvents: 'none'
                }}
              />
            );
          })()}

          {/* Preview lines (rendered early so they appear underneath everything) */}
          {previewItems.length > 0 && hoveredItem && previewItems.map((previewItem) => {
            return (
              <g key={`preview-line-${previewItem.key}`}>
                {/* Static dotted line */}
                <line
                  x1={CENTER_X + hoveredItem.x}
                  y1={CENTER_Y + hoveredItem.y}
                  x2={CENTER_X + previewItem.x}
                  y2={CENTER_Y + previewItem.y}
                  stroke="#1DB954"
                  strokeWidth="1"
                  strokeDasharray="6 4"
                  opacity="0.2"
                  style={{ pointerEvents: 'none' }}
                />

                {/* Animated "zipper" dashes traveling along the line */}
                <line
                  x1={CENTER_X + hoveredItem.x}
                  y1={CENTER_Y + hoveredItem.y}
                  x2={CENTER_X + previewItem.x}
                  y2={CENTER_Y + previewItem.y}
                  stroke="#1DB954"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  opacity="0.8"
                  style={{
                    pointerEvents: 'none',
                    animation: `dashPulse 1.5s linear infinite`
                  }}
                />
              </g>
            );
          })}

          {/* Circular ring with embedded 16 axis label segments (Trivial Pursuit style) */}
          <g
            style={{
              transformOrigin: `${CENTER_X}px ${CENTER_Y}px`,
              animation: viewStack.length > 0 ? 'breathe 4.5s ease-in-out infinite' : 'none'
            }}
          >
          {axisConfig.map((label, idx) => {
            const isHovered = hoveredAxisLabel === `${label.feature}-${label.end}`;
            // Also light up if the opposite end is hovered
            const oppositeEnd = label.end === 'high' ? 'low' : 'high';
            const isOppositeHovered = hoveredAxisLabel === `${label.feature}-${oppositeEnd}`;

            // Hover pushes segment outward by 30px
            const outerRadius = isHovered ? 315 : 285;
            const innerRadius = 245;

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

            // Text position (curved along arc, centered mid-ring)
            const textRadius = (outerRadius + innerRadius) / 2;

            return (
              <g key={`ring-segment-${label.feature}-${label.end}`}>
                {/* Arc segment */}
                <path
                  d={segmentPath}
                  fill={featureColor}
                  fillOpacity={label.enabled ? (isHovered || isOppositeHovered ? 0.6 : 0.4) : 0.2}
                  stroke={featureColor}
                  strokeWidth="2"
                  className="cursor-pointer"
                  style={{ transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)' }}
                  onClick={viewStack.length > 0 ? handleBack : undefined}
                  onMouseEnter={() => setHoveredAxisLabel(`${label.feature}-${label.end}`)}
                  onMouseLeave={() => setHoveredAxisLabel(null)}
                />

                {/* Curved text along arc */}
                <defs>
                  {/* Title path (centered mid-ring) */}
                  <path
                    id={`arc-title-${label.feature}-${label.end}`}
                    d={`
                      M ${CENTER_X + Math.cos(startAngle) * textRadius} ${CENTER_Y + Math.sin(startAngle) * textRadius}
                      A ${textRadius} ${textRadius} 0 0 1 ${CENTER_X + Math.cos(endAngle) * textRadius} ${CENTER_Y + Math.sin(endAngle) * textRadius}
                    `}
                  />
                </defs>
                {/* Title text */}
                <text
                  fill="white"
                  fontSize={isHovered ? FONT_STYLES.large.fontSize + 1 : FONT_STYLES.large.fontSize}
                  fontWeight={FONT_STYLES.large.fontWeight}
                  letterSpacing={FONT_STYLES.large.letterSpacing}
                  style={{ pointerEvents: 'none', transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)' }}
                >
                  <textPath href={`#arc-title-${label.feature}-${label.end}`} startOffset="50%" textAnchor="middle">
                    {label.name}
                  </textPath>
                </text>
              </g>
            );
          })}
          </g>

          {/* Axis lines (16 total) - one to each ring segment */}
          {axisConfig.map((label) => {
            return (
              <line
                key={`axis-${label.feature}-${label.end}`}
                x1={CENTER_X}
                y1={CENTER_Y}
                x2={CENTER_X + Math.cos(label.angle) * 270}
                y2={CENTER_Y + Math.sin(label.angle) * 270}
                stroke="#3f3f46"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity={label.enabled ? 0.3 : 0.1}
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
              stroke="#1DB954"
              strokeWidth={hoveredItem?.key === item.key ? "3" : "1"}
              opacity={hoveredItem?.key === item.key ? 0.8 : 0.2}
              strokeDasharray={hoveredItem?.key === item.key ? "0" : "2 2"}
              style={{
                transition: 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)'
              }}
            />
          ))}

          {/* Items (genres/subgenres/tracks) */}
          {items.map(item => {
            const isSelected = item.key === selectedNodeKey;
            const isHovered = hoveredItem?.key === item.key;
            const nodeRadius = 27; // Same size for all nodes
            const focusRingRadius = 75; // Green ring radius

            // Hide siblings when preview is active (only show hovered item + parent nodes)
            const hasPreview = previewItems.length > 0;
            const shouldHide = hasPreview && !isHovered && !item.isParent;

            if (shouldHide) return null;

            return (
              <g
                key={item.key}
                onMouseEnter={() => setHoveredItem(item)}
                onMouseLeave={() => setHoveredItem(null)}
                className="cursor-pointer"
                transform={`translate(${CENTER_X + item.x}, ${CENTER_Y + item.y})`}
              >
                {/* Focus ring (always on hover) */}
                {isHovered && (
                  <>
                    {/* Green fill circle */}
                    <circle
                      r={focusRingRadius}
                      fill="#1DB954"
                      opacity="0.15"
                      style={{
                        animation: 'pulse 2s ease-in-out infinite, fadeIn 0.2s ease-in',
                        pointerEvents: 'none'
                      }}
                    />
                    {/* Green stroke ring */}
                    <circle
                      r={focusRingRadius}
                      fill="none"
                      stroke="#1DB954"
                      strokeWidth="2"
                      opacity="0.6"
                      style={{
                        pointerEvents: 'none',
                        animation: 'fadeIn 0.2s ease-in'
                      }}
                    />
                  </>
                )}

                {/* Main node circle */}
                <circle
                  r={nodeRadius}
                  fill={isSelected ? '#1DB954' : '#18181b'}
                  fillOpacity={isSelected || isHovered ? 1.0 : 0.6}
                  stroke={isSelected ? '#1DB954' : item.isSelected ? '#eab308' : isHovered ? '#1DB954' : '#1DB954'}
                  strokeWidth={isSelected ? '4' : item.isSelected ? '4' : isHovered ? '3' : '2'}
                  strokeOpacity={isSelected || isHovered ? 1.0 : 0.6}
                  className="hover:fill-zinc-800 transition-all"
                  filter={isHovered ? 'url(#glow)' : undefined}
                  onClick={item.onClick}
                />

                {/* Node label - show circular text around edge */}
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
                  fontSize={isHovered ? FONT_STYLES.medium.fontSize + 3 : FONT_STYLES.medium.fontSize}
                  fontWeight={FONT_STYLES.medium.fontWeight}
                  filter={isHovered ? 'url(#textGlow)' : undefined}
                  style={{
                    pointerEvents: 'none',
                    transition: 'font-size 0.4s cubic-bezier(0.23, 1, 0.32, 1), fill-opacity 0.4s cubic-bezier(0.23, 1, 0.32, 1)'
                  }}
                >
                  <textPath href={`#nodePath-${item.key}`} startOffset="0%">
                    {item.label.length > 20 ? item.label.slice(0, 20) + '…' : item.label}
                  </textPath>
                </text>

                {/* Center action text (only on hover) - two lines: icon + word */}
                {isHovered && (
                  <>
                    {item.hasSubgenres ? (
                      /* Has subgenres: show ↓ "More" */
                      <>
                        <text
                          textAnchor="middle"
                          y="-6"
                          fill="white"
                          fontSize="20"
                          fontWeight="900"
                          style={{
                            pointerEvents: 'none',
                            animation: 'fadeIn 0.2s ease-in'
                          }}
                        >
                          ↓
                        </text>
                        <text
                          textAnchor="middle"
                          y="10"
                          fill="white"
                          fontSize="11"
                          fontWeight="700"
                          style={{
                            pointerEvents: 'none',
                            animation: 'fadeIn 0.2s ease-in'
                          }}
                        >
                          More
                        </text>
                      </>
                    ) : (
                      /* Leaf node: show ▶ "Play" */
                      <>
                        <text
                          textAnchor="middle"
                          y="-6"
                          fill="white"
                          fontSize="20"
                          fontWeight="900"
                          style={{
                            pointerEvents: 'none',
                            animation: 'fadeIn 0.2s ease-in'
                          }}
                        >
                          ▶
                        </text>
                        <text
                          textAnchor="middle"
                          y="10"
                          fill="white"
                          fontSize="11"
                          fontWeight="700"
                          style={{
                            pointerEvents: 'none',
                            animation: 'fadeIn 0.2s ease-in'
                          }}
                        >
                          Play
                        </text>
                      </>
                    )}
                  </>
                )}
              </g>
            );
          })}

          {/* Preview nodes (shown when hovering a node with children) */}
          {previewItems.length > 0 && hoveredItem && previewItems.map((previewItem) => {
            const nodeRadius = 27;

            return (
              <g key={`preview-node-${previewItem.key}`}>
                {/* Preview node */}
                <g
                  transform={`translate(${CENTER_X + previewItem.x}, ${CENTER_Y + previewItem.y})`}
                  opacity="0.5"
                  style={{ pointerEvents: 'none' }}
                >
                  {/* Node circle */}
                  <circle
                    r={nodeRadius}
                    fill="#18181b"
                    stroke="#1DB954"
                    strokeWidth="2"
                    strokeOpacity="0.6"
                  />

                  {/* Node label */}
                  <defs>
                    <path
                      id={`previewNodePath-${previewItem.key}`}
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
                    fillOpacity="0.6"
                    fontSize={FONT_STYLES.medium.fontSize}
                    fontWeight={FONT_STYLES.medium.fontWeight}
                  >
                    <textPath href={`#previewNodePath-${previewItem.key}`} startOffset="0%">
                      {previewItem.label.length > 20 ? previewItem.label.slice(0, 20) + '…' : previewItem.label}
                    </textPath>
                  </text>
                </g>
              </g>
            );
          })}

          {/* Orbiting description text (follows hover, shows genre descriptions) */}
          {(hoveredItem || selectedNode) && (
            <g
              style={{
                transformOrigin: `${CENTER_X + (hoveredItem?.x || selectedNodePos.x)}px ${CENTER_Y + (hoveredItem?.y || selectedNodePos.y)}px`,
                animation: `orbit 11000ms linear infinite`,
                pointerEvents: 'none'
              }}
            >
              <text fontSize={FONT_STYLES.large.fontSize} fill="#b7f7cf" fontWeight={FONT_STYLES.large.fontWeight} letterSpacing={FONT_STYLES.large.letterSpacing}>
                <textPath href="#descPath" startOffset="0%">
                  {hoveredItem
                    ? (hoveredItem.type === 'track' && hoveredItem.track
                        ? `${hoveredItem.track.artist} - ${hoveredItem.track.name}`
                        : getGenreDescription(hoveredItem.label))
                    : (selectedNode?.type === 'track' && selectedNode.track
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
                <text fontSize={FONT_STYLES.largest.fontSize} fill="#b7f7cf" fontWeight={FONT_STYLES.largest.fontWeight} letterSpacing={FONT_STYLES.largest.letterSpacing}>
                  <textPath href="#rootPath" startOffset="0%">
                    Click a genre to explore the musical landscape
                  </textPath>
                </text>
                <text fontSize={FONT_STYLES.largest.fontSize} fill="#b7f7cf" fontWeight={FONT_STYLES.largest.fontWeight} letterSpacing={FONT_STYLES.largest.letterSpacing}>
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
                  animation: `orbit 22000ms linear infinite`,
                  pointerEvents: 'none'
                }}
              >
                <text fontSize={FONT_STYLES.largest.fontSize} fill="#a1a1aa" fontWeight={FONT_STYLES.largest.fontWeight} letterSpacing={FONT_STYLES.largest.letterSpacing}>
                  <textPath href="#backPath" startOffset="0%">
                    Click anywhere outside the ring to go back
                  </textPath>
                </text>
                <text fontSize={FONT_STYLES.largest.fontSize} fill="#a1a1aa" fontWeight={FONT_STYLES.largest.fontWeight} letterSpacing={FONT_STYLES.largest.letterSpacing}>
                  <textPath href="#backPath" startOffset="50%">
                    Click anywhere outside the ring to go back
                  </textPath>
                </text>
              </g>
            </>
          )}

          {/* Ring label descriptions (tooltip box) */}
          {axisConfig.map((label) => {
            const isHovered = hoveredAxisLabel === `${label.feature}-${label.end}`;
            if (!isHovered) return null;

            // Position tooltip box near the segment
            const tooltipX = CENTER_X + Math.cos(label.angle) * 350;
            const tooltipY = CENTER_Y + Math.sin(label.angle) * 350;

            // Wrap text into multiple lines (approx 40 chars per line)
            const words = label.info.split(' ');
            const lines = [];
            let currentLine = '';

            words.forEach(word => {
              if ((currentLine + word).length > 40) {
                lines.push(currentLine.trim());
                currentLine = word + ' ';
              } else {
                currentLine += word + ' ';
              }
            });
            if (currentLine) lines.push(currentLine.trim());

            return (
              <g key={`desc-${label.feature}-${label.end}`}>
                {/* Tooltip background */}
                <rect
                  x={tooltipX - 110}
                  y={tooltipY - 15 - (lines.length * 6)}
                  width="220"
                  height={lines.length * 12 + 10}
                  fill="rgba(0, 0, 0, 0.9)"
                  stroke="white"
                  strokeWidth="1"
                  rx="4"
                  style={{ pointerEvents: 'none' }}
                />
                {/* Tooltip text (multiple lines) */}
                {lines.map((line, i) => (
                  <text
                    key={i}
                    x={tooltipX}
                    y={tooltipY - (lines.length - i - 1) * 12}
                    textAnchor="middle"
                    fill="white"
                    fontSize="10"
                    fontWeight="400"
                    opacity="0.95"
                    style={{ pointerEvents: 'none' }}
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}

          {/* Back navigation hint text (shown at mouse position after delay) */}
          {showBackHint && viewStack.length > 0 && (
            <text
              x={backHintPosition.x}
              y={backHintPosition.y}
              textAnchor="middle"
              fill="white"
              fontSize={FONT_STYLES.medium.fontSize}
              fontWeight={FONT_STYLES.medium.fontWeight}
              opacity="0.8"
              style={{
                pointerEvents: 'none',
                animation: 'fadeIn 0.3s ease-in, fadeOut 0.3s ease-out 0.7s'
              }}
            >
              Click anywhere to back up a level
            </text>
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
        @keyframes dashPulse {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -10; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: inherit; }
        }
        @keyframes fadeOut {
          from { opacity: inherit; }
          to { opacity: 0; }
        }

        /* Fade-in transition for hover effects */
        .hover-fade-in {
          animation: fadeIn 0.2s ease-in;
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
