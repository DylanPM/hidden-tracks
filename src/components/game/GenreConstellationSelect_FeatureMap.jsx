import React, { useState, useEffect, useMemo } from 'react';
import { useFeatureMap } from '../../hooks/useFeatureMap';

// Font standardization system
// Note: Spotify uses "Spotify Mix" (2024) - a proprietary font combining geometric,
// grotesque, and humanist characteristics. Best web alternatives: Inter, DM Sans, Work Sans.
// Currently using Tailwind's font-sans (system-ui stack) which provides good readability.
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
    low: { emoji: '🧘', name: 'Laid-back', desc: 'Relaxed, not for dancing', info: 'How suitable for dancing. Laid-back tracks feel contemplative; danceable tracks have strong beat and rhythm.' },
    high: { emoji: '💃', name: 'Danceable', desc: 'Made for dancing', info: 'How suitable for dancing. Laid-back tracks feel contemplative; danceable tracks have strong beat and rhythm.' },
    color: '#9333EA' // Vivid purple (nightlife/movement)
  },
  energy: {
    low: { emoji: '😌', name: 'Calm', desc: 'Mellow and peaceful', info: 'Perceptual intensity from 0-1. Calm is gentle; energetic is fast, loud, and noisy.' },
    high: { emoji: '⚡', name: 'Energetic', desc: 'Intense and active', info: 'Perceptual intensity from 0-1. Calm is gentle; energetic is fast, loud, and noisy.' },
    color: '#DC2626' // Strong red (intense/hot)
  },
  speechiness: {
    low: { emoji: '🎵', name: 'Wordless', desc: 'Instrumental melodies', info: 'Presence of spoken words. Wordless is pure music; wordy contains talk shows, podcasts, or rap.' },
    high: { emoji: '🗣️', name: 'Wordy', desc: 'Lots of talking/rapping', info: 'Presence of spoken words. Wordless is pure music; wordy contains talk shows, podcasts, or rap.' },
    color: '#EAB308' // Bright yellow (voice/words)
  },
  acousticness: {
    low: { emoji: '🎹', name: 'Electric', desc: 'Synths and machines', info: 'Confidence that track uses acoustic instruments. Electric is electronic/synthesized; acoustic is unplugged.' },
    high: { emoji: '🎸', name: 'Acoustic', desc: 'Live instruments', info: 'Confidence that track uses acoustic instruments. Electric is electronic/synthesized; acoustic is unplugged.' },
    color: '#16A34A' // Vibrant green (natural/organic)
  },
  valence: {
    low: { emoji: '😢', name: 'Sad', desc: 'Melancholic feeling', info: 'Musical positiveness. Sad tracks sound negative (angry, depressed); happy tracks sound positive (cheerful, euphoric).' },
    high: { emoji: '😊', name: 'Happy', desc: 'Upbeat and cheerful', info: 'Musical positiveness. Sad tracks sound negative (angry, depressed); happy tracks sound positive (cheerful, euphoric).' },
    color: '#2563EB' // Bright blue (emotion/mood)
  },
  tempo_norm: {
    low: { emoji: '🐌', name: 'Slow', desc: 'Slower tempo', info: 'Overall tempo in BPM. Slow is laid-back and relaxed; fast is driving and urgent.' },
    high: { emoji: '🥁', name: 'Fast', desc: 'Quick tempo', info: 'Overall tempo in BPM. Slow is laid-back and relaxed; fast is driving and urgent.' },
    color: '#0EA5E9' // Sky blue (speed/motion)
  },
  popularity: {
    low: { emoji: '💎', name: 'Niche', desc: 'Underground and rare', info: 'Based on play count and recency. Niche is underground; popular is mainstream hits.' },
    high: { emoji: '🔥', name: 'Popular', desc: 'Mainstream hits', info: 'Based on play count and recency. Niche is underground; popular is mainstream hits.' },
    color: '#EC4899' // Hot pink (mainstream/trending)
  }
};

// Song of the Day - "Love Again" by Dua Lipa
const SONG_OF_THE_DAY = {
  id: '1imMjt1YGNebtrtTAprKV7',
  name: 'Love Again',
  artist: 'Dua Lipa',
  filename: 'dua-lipa_love-again.json',
  features: {
    danceability: 0.659,
    energy: 0.667,
    valence: 0.468,
    acousticness: 0.00173,
    instrumentalness: 0.0000285,
    speechiness: 0.0339,
    tempo: 115.982,
    tempo_norm: 0.38, // Normalized tempo (115.982 BPM is moderate)
    popularity: 68
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
  const [backHintTimeout, setBackHintTimeout] = useState(null);
  const [backHintPosition, setBackHintPosition] = useState({ x: 0, y: 0 });

  // Active features (all enabled by default) - instrumentalness excluded from display
  const [activeFeatures, setActiveFeatures] = useState({
    danceability: true,
    energy: true,
    speechiness: true,
    acousticness: true,
    valence: true,
    tempo_norm: true,
    popularity: true
  });

  // Difficulty (kept for compatibility)
  const [difficulty] = useState('medium');

  // Filter out instrumentalness from feature_angles for display
  const displayFeatures = useMemo(() => {
    if (!manifest?.global?.display?.feature_angles) return [];
    return manifest.global.display.feature_angles.filter(f => f !== 'instrumentalness');
  }, [manifest]);

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
  const children = useMemo(() => {
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
  }, [viewStack, manifest]);

  // Get seeds for current node
  const seeds = useMemo(() => {
    const node = getCurrentNode();
    if (!node) return [];
    if (viewStack.length === 0) return [];
    return node?.seeds || node?._seeds || [];
  }, [viewStack, manifest]);

  // Compute positions with global normalization (for root level)
  const { positions: rawGlobalPositions, averagedParentFeatures } = useFeatureMap(manifest, exaggeration, activeFeatures, null);

  // Clamp positions to octagon boundary
  // IMPORTANT: Always use global quantiles for semantic consistency
  // This ensures node positions match disco floor rendering at all nesting levels
  const positions = useMemo(() => {
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

  // Song of the Day always at center (0, 0) to evoke mystery
  const songOfTheDayPosition = useMemo(() => {
    return { x: 0, y: 0 };
  }, []);

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
    // Clicking a track launches immediately if it has a valid filename
    if (track?.filename) {
      onLaunch([track], difficulty);
    } else {
      console.warn(`Cannot launch track: missing profile file`);
    }
  };

  const handleBack = () => {
    if (viewStack.length === 0) return;
    const newStack = viewStack.slice(0, -1);
    setViewStack(newStack);
    setSelectedTrack(null);
    setLoadedTracks([]);
    setHoveredItem(null); // Reset hover to prevent ghosting
    setShowBackHint(false); // Hide hint when going back
    if (backHintTimeout) clearTimeout(backHintTimeout);

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
        // Helper function to slugify text (matches profile generation logic)
        const slugify = (text) => {
          return text
            .toLowerCase()
            .replace(/['']/g, '-') // Replace apostrophes with hyphens
            .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
            .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
        };

        const tracks = await Promise.all(
          seeds.map(async seed => {
            try {
              // Construct actual filename from artist and name fields
              // Manifest format: artist-song-title.json (all hyphens)
              // Actual format: artist_song-title.json (underscore separator)
              const artistSlug = slugify(seed.artist);
              const nameSlug = slugify(seed.name);
              const actualFilename = `${artistSlug}_${nameSlug}.json`;

              const res = await fetch(`/profiles/${actualFilename}`);
              if (!res.ok) {
                console.warn(`Failed to fetch: ${actualFilename} (from ${seed.artist} - ${seed.name})`);
                return null;
              }
              const profile = await res.json();

              // New JSON format: features are in tracks[0] instead of seed
              const trackData = profile.tracks && profile.tracks[0];
              if (!trackData) {
                console.warn(`No track data for: ${actualFilename}`);
                return null;
              }

              // Calculate tempo_norm from raw tempo (normalize to 0-1 range)
              // Typical tempo range: 60-180 BPM
              const tempo_norm = Math.max(0, Math.min(1, (trackData.tempo - 60) / 120));

              const rawPos = {
                danceability: trackData.danceability,
                energy: trackData.energy,
                speechiness: trackData.speechiness,
                acousticness: trackData.acousticness,
                valence: trackData.valence,
                tempo_norm: tempo_norm,
                popularity: trackData.popularity,
                instrumentalness: trackData.instrumentalness
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

  // Helper: Resolve collisions between nodes with feature-aware push direction
  const resolveCollisions = (items) => {
    const nodeRadius = 27; // Max radius for collision detection
    const overlapThreshold = 0.2; // 20% overlap triggers push (more sensitive)
    const pushStrength = 2.0; // Stronger push (increased from 1.5)
    const maxIterations = 6; // More iterations (doubled from 3)

    // Helper: Find which feature axis a given angle points toward
    const findNearestFeatureAxis = (angle) => {
      if (!manifest?.global?.display?.feature_angles) return null;

      const featureAngles = displayFeatures;
      const numFeatures = featureAngles.length;

      // Normalize angle to [0, 2π)
      let normalizedAngle = angle % (Math.PI * 2);
      if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;

      let nearestFeature = null;
      let minDiff = Infinity;

      featureAngles.forEach((feature, i) => {
        const featureAngle = (i * Math.PI * 2) / numFeatures;

        // Calculate angular difference (accounting for wrap-around)
        let diff = Math.abs(normalizedAngle - featureAngle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;

        if (diff < minDiff) {
          minDiff = diff;
          nearestFeature = feature;
        }
      });

      return nearestFeature;
    };

    // Helper: Get feature percentile for a node
    const getFeaturePercentile = (item, featureName) => {
      if (!manifest?.global?.quantiles) return 0.5;
      if (!item.data?.features) return 0.5;

      const value = item.data.features[featureName];
      if (value == null || isNaN(value)) return 0.5;

      const q = manifest.global.quantiles[featureName];
      if (!q) return 0.5;

      // Approximate percentile using quantiles (same logic as useFeatureMap)
      if (value <= q.p10) return 0.1 * (value / q.p10);
      if (value <= q.p50) return 0.1 + 0.4 * ((value - q.p10) / (q.p50 - q.p10));
      if (value <= q.p90) return 0.5 + 0.4 * ((value - q.p50) / (q.p90 - q.p50));
      return 0.9 + 0.1 * ((value - q.p90) / (1 - q.p90 + 0.001));
    };

    // FIRST PASS: Enforce parent exclusion zone (run BEFORE any other collision detection)
    // Parent is always at (0, 0) when nested, so push all children away from origin
    const parentNode = items.find(item => item.isParent);
    if (parentNode) {
      // Parent exclusion zone:
      // - Parent node radius: 27px
      // - Label text space (circular text around edge): ~35px
      // - Buffer: 20px
      // Total: 82px minimum distance from parent center
      const PARENT_EXCLUSION_RADIUS = 82;

      items.forEach(item => {
        if (item.isParent) return; // Skip the parent itself

        const dx = item.x - parentNode.x;
        const dy = item.y - parentNode.y;
        const distanceFromParent = Math.sqrt(dx * dx + dy * dy);

        // If inside exclusion zone, push radially outward to the boundary
        if (distanceFromParent < PARENT_EXCLUSION_RADIUS) {
          const angle = Math.atan2(dy, dx);
          // Place at exclusion boundary (or slightly beyond if already close)
          const targetDistance = Math.max(PARENT_EXCLUSION_RADIUS, distanceFromParent + 20);
          item.x = parentNode.x + Math.cos(angle) * targetDistance;
          item.y = parentNode.y + Math.sin(angle) * targetDistance;
        }
      });
    }

    // SECOND PASS: Regular node-to-node collision avoidance with feature-aware push
    // SKIP for root-level view - collision avoidance already handled in useFeatureMap
    // Only needed for nested views where tracks are positioned in a circle
    const isRootView = viewStack.length === 0 && !loadedTracks.length;
    const skipSecondPass = isRootView;

    if (!skipSecondPass) {
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

              // Calculate initial radial push direction
              let pushAngle = Math.atan2(dy, dx);

              // FEATURE-AWARE PUSH: Check if pushing toward a weakness
              // For each node, see if the push direction points toward an axis where it's weak
              const adjustPushForNode = (node, angle) => {
                const nearestAxis = findNearestFeatureAxis(angle);
                if (!nearestAxis) return angle;

                const percentile = getFeaturePercentile(node, nearestAxis);

                // If pushing toward a weakness (low percentile on the axis we're pointing to)
                // or pushing away from a strength (high percentile means we're pushing opposite)
                // In both cases, percentile far from 0.5 means semantically problematic
                if (Math.abs(percentile - 0.5) > 0.2) {
                  // Try rotating 90° to find a more neutral direction
                  return angle + Math.PI / 2;
                }

                return angle;
              };

              // Adjust push angle for both nodes
              // Item2 is being pushed away from item1, so use pushAngle as-is
              const adjustedPushAngle2 = adjustPushForNode(item2, pushAngle);
              // Item1 is being pushed opposite direction
              const adjustedPushAngle1 = adjustPushForNode(item1, pushAngle + Math.PI);

              // Use adjusted angles for pushing
              const pushDistance = (minDistance - distance) * pushStrength / 2;

              item1.x -= Math.cos(adjustedPushAngle1) * pushDistance;
              item1.y -= Math.sin(adjustedPushAngle1) * pushDistance;
              item2.x += Math.cos(adjustedPushAngle2) * pushDistance;
              item2.y += Math.sin(adjustedPushAngle2) * pushDistance;
            }
          }
        }
      }

      if (!hadCollision) break; // Early exit if no collisions found
    }
    } // End skipSecondPass check

    // FINAL CLAMPING: Ensure collision detection didn't push nodes outside boundary
    const MAX_DISTANCE = 190; // Same as used in position clamping above
    items.forEach(item => {
      const distance = Math.sqrt(item.x * item.x + item.y * item.y);
      if (distance > MAX_DISTANCE) {
        const scale = MAX_DISTANCE / distance;
        item.x *= scale;
        item.y *= scale;
      }
    });

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

          // Use averaged features for root-level parent genres (more accurate)
          const effectiveData = averagedParentFeatures[child.key]
            ? { ...childData, features: averagedParentFeatures[child.key] }
            : childData;

          items.push({
            key: child.key,
            label: child.key,
            x: pos.x,
            y: pos.y,
            type: child.type,
            data: effectiveData, // Include data with averaged features for collision
            hasSubgenres,
            hasSeeds,
            onClick: () => {
              // If has actual subgenres, drill down
              if (hasSubgenresData) {
                handleGenreClick(child.key);
              } else if (hasSeeds) {
                // If node has only seeds (no subgenres), drill down to show track selection view
                handleGenreClick(child.key);
              }
            }
          });
        });

        // Add Song of the Day node at root level
        items.push({
          key: 'song-of-the-day',
          label: 'song of the day',
          x: songOfTheDayPosition.x,
          y: songOfTheDayPosition.y,
          type: 'songOfTheDay',
          data: { features: SONG_OF_THE_DAY.features }, // Include features for collision
          hasSubgenres: false,
          hasSeeds: true,
          isSongOfTheDay: true,
          onClick: () => {
            // Launch the song of the day
            onLaunch([SONG_OF_THE_DAY], difficulty);
          }
        });
      } else {
        // NESTED LEVEL: Center parent and show children at local attribute positions
        const parentKey = `parent-${viewStack[viewStack.length - 1]}`;
        const parentData = getCurrentNode();

        const parentHasSeeds = (parentData?.seeds || parentData?._seeds)?.length > 0;

        items.push({
          key: parentKey,
          label: viewStack[viewStack.length - 1],
          x: 0, // Center parent at origin (UX choice, not attribute-based)
          y: 0,
          type: 'parent',
          data: parentData, // Include data for feature-aware collision
          isParent: true,
          hasSubgenres: false,
          hasSeeds: parentHasSeeds,
          onClick: () => {
            // Parent nodes can be clicked to launch with random seed
            if (parentHasSeeds) {
              const seeds = parentData.seeds || parentData._seeds;
              const hasValidSeeds = seeds && seeds.length > 0 && seeds[0]?.filename;
              if (hasValidSeeds) {
                const randomSeed = seeds[Math.floor(Math.random() * seeds.length)];
                onLaunch([randomSeed], difficulty);
              } else {
                console.warn(`Cannot launch parent: missing profile files`);
              }
            }
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
            data: childData, // Include data for feature-aware collision
            hasSubgenres,
            hasSeeds,
            onClick: () => {
              // If has actual subgenres, drill down
              if (hasSubgenresData) {
                handleGenreClick(child.key);
              } else if (hasSeeds) {
                // If node has only seeds (no subgenres), drill down to show track selection view
                handleGenreClick(child.key);
              }
            }
          });
        });
      }
    } else if (loadedTracks.length > 0) {
      // For tracks: show parent node at center + tracks in circle
      const parentKey = `parent-${viewStack[viewStack.length - 1]}`;
      const parentData = getCurrentNode();

      const parentHasSeeds = (parentData?.seeds || parentData?._seeds)?.length > 0;

      // Add parent node at center
      items.push({
        key: parentKey,
        label: viewStack[viewStack.length - 1],
        x: 0, // Center at origin
        y: 0,
        type: 'parent',
        data: parentData, // Include data for feature-aware collision
        isParent: true,
        hasSubgenres: false,
        hasSeeds: parentHasSeeds,
        onClick: () => {
          // Parent in track view can be clicked to launch with random seed
          if (parentHasSeeds) {
            const seeds = parentData.seeds || parentData._seeds;
            const randomSeed = seeds[Math.floor(Math.random() * seeds.length)];
            onLaunch([randomSeed], difficulty);
          }
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
          data: { features: track.features }, // Include features for collision
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

  // Get selected node position for connection lines and LAUNCH overlay
  const selectedNode = items.find(item => item.key === selectedNodeKey);
  const selectedNodePos = selectedNode ? { x: selectedNode.x, y: selectedNode.y } : { x: 0, y: 0 };

  // ============================================================================
  // ANGLE CALCULATION SYSTEM - IMPORTANT FOR FUTURE ATTRIBUTE CHANGES
  // ============================================================================
  // Two different angle systems are used throughout this component:
  //
  // 1. POSITIONING ANGLES (7 axes, ~51.4° apart)
  //    - Used for: node positioning, axis labels, disco floor shape
  //    - Calculation: i * (2π / numFeatures) where numFeatures = displayFeatures.length
  //    - Each feature gets ONE axis pointing in a direction (0°, 51°, 103°, etc.)
  //    - Example: "Energy" axis points at 51°, high energy = towards 51°, low = towards 231°
  //
  // 2. RING SEGMENT ANGLES (14 segments, ~25.7° apart)
  //    - Used for: ring rectangles, floor triangle WIDTH
  //    - Calculation: i * (2π / numSegments) where numSegments = displayFeatures.length * 2
  //    - Each feature gets TWO segments (high + low), half as wide as positioning angles
  //    - Example: "Energy High" rectangle centered at 51° but only ~25.7° wide
  //
  // If you add/remove attributes, both systems will auto-adjust based on displayFeatures.length
  // ============================================================================

  // Axis configuration (bidirectional labels) - segments based on feature count
  const axisConfig = useMemo(() => {
    if (!manifest?.global) return [];

    // POSITIONING ANGLES: One angle per feature spanning full circle
    const numFeatures = displayFeatures.length;
    const featureAngleStep = (Math.PI * 2) / numFeatures;
    const axisRadius = 340; // Distance from center to axis label (outside octagon ring, further out)

    const labels = [];

    displayFeatures.forEach((feature, i) => {
      const config = FEATURE_CONFIG[feature];
      const enabled = activeFeatures[feature] !== false;

      if (!config) return;

      // High end at angle that matches positioning calculation
      const highAngle = i * featureAngleStep;
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

      // Low end 180° opposite
      const lowAngle = highAngle + Math.PI;
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
  }, [manifest, activeFeatures, displayFeatures]);

  // Compute feature weights for focused node (for disco floor effect)
  const focusedNodeFeatureWeights = useMemo(() => {
    const focusedNode = hoveredItem || selectedNode;
    if (!focusedNode || !manifest?.global) return null;

    // Determine path: parent/track use viewStack, regular node adds its key
    const pathArray = (focusedNode.isParent || focusedNode.track)
      ? viewStack
      : [...viewStack, focusedNode.key];

    const node = getManifestNode(pathArray);

    // For root-level parent genres, use averaged features for disco floor
    const isRootGenre = viewStack.length === 0 && !focusedNode.track && !focusedNode.isSongOfTheDay;
    const genreKey = focusedNode.key;
    const nodeFeatures = (isRootGenre && averagedParentFeatures[genreKey])
      ? averagedParentFeatures[genreKey]
      : node?.features;

    if (!nodeFeatures) return null;

    const { quantiles } = manifest.global;

    // Normalize each feature to 0-1 using quantiles
    const weights = {};
    displayFeatures.forEach(feature => {
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
  }, [hoveredItem, selectedNode, manifest, viewStack, displayFeatures, averagedParentFeatures]);

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
                Pick a genre, sub-genre, or a song, hit ▶ Play, then try to guess which songs would be recommended for a playlist.
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

                // Hide hint when mouse moves
                setShowBackHint(false);

                // Clear existing timeout
                if (backHintTimeout) clearTimeout(backHintTimeout);

                // Show hint after mouse stops for 5 seconds
                const timeout = setTimeout(() => {
                  setShowBackHint(true);
                }, 5000);
                setBackHintTimeout(timeout);
              }}
              onMouseLeave={() => {
                if (backHintTimeout) clearTimeout(backHintTimeout);
                setShowBackHint(false);
              }}
            />
          )}

          {/* Subtle background floor coloring - segments based on feature count */}
          {displayFeatures.map((feature, i) => {
            // HYBRID: Use POSITIONING ANGLES for center, RING SEGMENT width for triangles
            // (See "ANGLE CALCULATION SYSTEM" comment above for details)
            const numSegments = displayFeatures.length * 2;
            const segmentAngleStep = (Math.PI * 2) / numSegments;
            const featureColor = FEATURE_CONFIG[feature]?.color || '#1DB954';
            const radius = 250;

            // Check if this feature is hovered (either high or low end)
            const isFeatureHovered = hoveredAxisLabel && hoveredAxisLabel.startsWith(feature + '-');
            const isFeatureEnabled = activeFeatures[feature];

            // Three states: not in use (off), in use (on), on hover
            const floorOpacity = isFeatureHovered ? 0.35 : (isFeatureEnabled ? 0.12 : 0.05);

            // High end segment: use positioning angle but narrow segment width
            const highAngle = i * (Math.PI * 2) / displayFeatures.length; // Positioning angle
            const highStartAngle = highAngle - segmentAngleStep / 2;
            const highEndAngle = highAngle + segmentAngleStep / 2;

            // Low end segment: 180° opposite with same narrow width
            const lowAngle = highAngle + Math.PI;
            const lowStartAngle = lowAngle - segmentAngleStep / 2;
            const lowEndAngle = lowAngle + segmentAngleStep / 2;

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
                  opacity={floorOpacity}
                  style={{
                    pointerEvents: 'none',
                    transition: 'opacity 0.2s ease-out'
                  }}
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
                  opacity={floorOpacity}
                  style={{
                    pointerEvents: 'none',
                    transition: 'opacity 0.2s ease-out'
                  }}
                />
              </g>
            );
          })}

          {/* Disco floor - connected polygon based on feature weights */}
          {focusedNodeFeatureWeights && (() => {
            if (displayFeatures.length === 0) return null;

            // POSITIONING ANGLES: Used for disco floor shape to match node positioning
            // (See "ANGLE CALCULATION SYSTEM" comment above for details)
            const numFeatures = displayFeatures.length;
            const featureAngleStep = (Math.PI * 2) / numFeatures;
            // Disco floor radius extended to better fill visual space to ring (230px)
            // Ring is at 245px, nodes clamped at 190px, so 230px gives good visual balance
            const maxRadius = 230;
            const minRadius = 50;

            // Create points at evenly-spaced angles (one for each feature's high and low)
            const points = [];

            displayFeatures.forEach((feature, i) => {
              const weight = focusedNodeFeatureWeights[feature];

              // High end point matches positioning angle
              const highAngle = i * featureAngleStep;
              const highRadius = minRadius + (weight * (maxRadius - minRadius));
              points.push({
                angle: highAngle,
                x: CENTER_X + Math.cos(highAngle) * highRadius,
                y: CENTER_Y + Math.sin(highAngle) * highRadius,
                weight,
                strength: weight
              });

              // Low end point 180° opposite (normalize to [0, 2π) range)
              const lowAngle = (highAngle + Math.PI) % (Math.PI * 2);
              const lowRadius = minRadius + ((1 - weight) * (maxRadius - minRadius));
              points.push({
                angle: lowAngle,
                x: CENTER_X + Math.cos(highAngle + Math.PI) * lowRadius, // Use unnormalized for trig
                y: CENTER_Y + Math.sin(highAngle + Math.PI) * lowRadius,
                weight: 1 - weight,
                strength: 1 - weight
              });
            });

            // Sort points by angle to connect them in circular order (prevents crossing lines)
            points.sort((a, b) => a.angle - b.angle);

            // Create path connecting all points in circular order
            const pathData = points.map((p, i) =>
              `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
            ).join(' ') + ' Z';

            // Use neutral white color for disco floor
            const color = '#ffffff';
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

          {/* Circular ring with embedded axis label segments (Trivial Pursuit style) */}
          <g
            style={{
              transformOrigin: `${CENTER_X}px ${CENTER_Y}px`,
              animation: viewStack.length > 0 ? 'breathe 4.5s ease-in-out infinite' : 'none'
            }}
          >
          {axisConfig.map((label, idx) => {
            const isHovered = hoveredAxisLabel === `${label.feature}-${label.end}`;
            // Also light up and extrude if the opposite end is hovered
            const oppositeEnd = label.end === 'high' ? 'low' : 'high';
            const isOppositeHovered = hoveredAxisLabel === `${label.feature}-${oppositeEnd}`;

            // Hover or opposite hover pushes segment outward by 30px
            const outerRadius = (isHovered || isOppositeHovered) ? 315 : 285;
            const innerRadius = 245;

            // RING SEGMENT ANGLES: Calculate rectangle width (narrower than positioning axes)
            // (See "ANGLE CALCULATION SYSTEM" comment above for details)
            const numSegments = displayFeatures.length * 2;
            const angleStep = (Math.PI * 2) / numSegments;
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
                  fillOpacity={label.enabled ? (isHovered || isOppositeHovered ? 0.6 : 0.4) : 0.15}
                  stroke={featureColor}
                  strokeWidth="2"
                  strokeOpacity={label.enabled ? 1.0 : 0.3}
                  className="cursor-pointer"
                  style={{ transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Always toggle feature when clicking ring segments (don't trigger back)
                    toggleFeature(label.feature);
                  }}
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
                  fillOpacity={label.enabled ? 1.0 : 0.4}
                  fontSize={isHovered ? FONT_STYLES.large.fontSize + 1 : FONT_STYLES.large.fontSize}
                  fontWeight="400"
                  letterSpacing="1px"
                  dominantBaseline="middle"
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

          {/* Axis lines - one to each ring segment */}
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
              strokeWidth={hoveredItem?.key === item.key ? "4" : "2"}
              opacity={hoveredItem?.key === item.key ? 0.8 : 0.2}
              strokeDasharray={hoveredItem?.key === item.key ? "0" : "2 2"}
              style={{
                transition: 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)'
              }}
            />
          ))}

          {/* Items (genres/subgenres/tracks) - render hovered item last for z-index on top */}
          {items
            .sort((a, b) => {
              // Hovered item goes last (appears on top in SVG)
              const aIsHovered = hoveredItem?.key === a.key;
              const bIsHovered = hoveredItem?.key === b.key;
              if (aIsHovered) return 1;
              if (bIsHovered) return -1;
              return 0;
            })
            .map(item => {
            const isSelected = item.key === selectedNodeKey;
            const isHovered = hoveredItem?.key === item.key;
            const nodeRadius = 27; // Same size for all nodes
            const focusRingRadius = 75; // Green ring radius

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
                    {/* Fill circle - white for song of the day, green for others */}
                    <circle
                      r={focusRingRadius}
                      fill={item.isSongOfTheDay ? "#FFFFFF" : "#1DB954"}
                      opacity="0.15"
                      style={{
                        pointerEvents: 'none',
                        transition: 'opacity 0.2s ease-in'
                      }}
                    />
                    {/* Stroke ring - white for song of the day, green for others */}
                    <circle
                      r={focusRingRadius}
                      fill="none"
                      stroke={item.isSongOfTheDay ? "#FFFFFF" : "#1DB954"}
                      strokeWidth="2"
                      opacity="0.6"
                      style={{
                        pointerEvents: 'none',
                        transition: 'opacity 0.2s ease-in'
                      }}
                    />
                  </>
                )}

                {/* Main node circle */}
                <circle
                  r={nodeRadius}
                  fill={isSelected ? (item.isSongOfTheDay ? '#FFFFFF' : '#1DB954') : isHovered ? '#27272a' : '#18181b'}
                  fillOpacity={isSelected || isHovered ? 1.0 : 0.6}
                  stroke={item.isSongOfTheDay ? '#FFFFFF' : (isSelected ? '#1DB954' : item.isSelected ? '#eab308' : isHovered ? '#1DB954' : '#1DB954')}
                  strokeWidth={isSelected ? '4' : item.isSelected ? '4' : isHovered ? '3' : '2'}
                  strokeOpacity={isSelected || isHovered ? 1.0 : 0.6}
                  style={{
                    transition: 'fill 0.2s ease-in, fill-opacity 0.2s ease-in, stroke-opacity 0.2s ease-in'
                  }}
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
                    {item.label.length > 20 ? item.label.toLowerCase().slice(0, 20) + '…' : item.label.toLowerCase()}
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

          {/* Orbiting description text (follows hover, shows genre descriptions) */}
          {(hoveredItem || selectedNode) && (
            <g
              key={`orbit-${hoveredItem?.key || selectedNode?.key || 'default'}`}
              style={{
                transformOrigin: `${CENTER_X + (hoveredItem?.x || selectedNodePos.x)}px ${CENTER_Y + (hoveredItem?.y || selectedNodePos.y)}px`,
                animation: `orbit 10000ms linear infinite`, // Increased speed by 10% (was 11000ms)
                pointerEvents: 'none'
              }}
            >
              <text fontSize={FONT_STYLES.large.fontSize} fill={hoveredItem?.isSongOfTheDay || selectedNode?.isSongOfTheDay ? "#FFFFFF" : "#b7f7cf"} fontWeight={FONT_STYLES.large.fontWeight} letterSpacing={FONT_STYLES.large.letterSpacing}>
                <textPath href="#descPath" startOffset="0%">
                  {hoveredItem
                    ? (hoveredItem.isSongOfTheDay
                        ? "test your knowledge with the song of the day!"
                        : hoveredItem.type === 'track' && hoveredItem.track
                          ? `${hoveredItem.track.artist} - ${hoveredItem.track.name}`
                          : getGenreDescription(hoveredItem.label))
                    : (selectedNode?.isSongOfTheDay
                        ? "test your knowledge with the song of the day!"
                        : selectedNode?.type === 'track' && selectedNode.track
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
                  animation: `orbit 24380ms linear infinite`, // Decreased by another 15% (21200ms * 1.15)
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
                  animation: `orbit 24380ms linear infinite`, // Decreased by another 15% (21200ms * 1.15)
                  pointerEvents: 'none'
                }}
              >
                <text fontSize={FONT_STYLES.largest.fontSize} fill="#b7f7cf" fontWeight={FONT_STYLES.largest.fontWeight} letterSpacing={FONT_STYLES.largest.letterSpacing}>
                  <textPath href="#backPath" startOffset="0%">
                    You're in {viewStack.join(' > ')} • click anywhere inside the ring to zoom out a level
                  </textPath>
                </text>
                <text fontSize={FONT_STYLES.largest.fontSize} fill="#b7f7cf" fontWeight={FONT_STYLES.largest.fontWeight} letterSpacing={FONT_STYLES.largest.letterSpacing}>
                  <textPath href="#backPath" startOffset="50%">
                    You're in {viewStack.join(' > ')} • click anywhere inside the ring to zoom out a level
                  </textPath>
                </text>
              </g>
            </>
          )}


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

      {/* Hidden audio preview iframe for UK garage tracks on hover */}
      {/* {hoveredItem?.type === 'track' &&
       hoveredItem?.track?.uri &&
       viewStack.some(path => path.toLowerCase().includes('uk garage')) && (
        <iframe
          key={hoveredItem.track.uri}
          src={`https://open.spotify.com/embed/track/${hoveredItem.track.uri.split(':')[2]}?utm_source=generator`}
          style={{
            position: 'absolute',
            left: '-9999px',
            top: '-9999px',
            width: '300px',
            height: '80px'
          }}
          frameBorder="0"
          allow="autoplay; encrypted-media"
          title="Audio Preview"
        />
      )} */}

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
    rock: 'Guitars, live drums, verse-chorus lift. Riffs and grit.',
    electronic: 'Synths, drum machines, grid rhythm. Texture drives form.',
    'hip hop': 'Drums and vocal rhythm. Kicks, snares, flow in pocket.',
    'r&b': 'Smooth vocals over pocketed drums. Melody glides, bass sings.',
    soul: 'Powerful vocals, rich harmony, groove-led rhythm sections.',
    funk: 'Syncopated bass, clipped guitars, tight drums. The pocket.',
    jazz: 'Improv, extended harmony, acoustic/electric, swing/straight.',
    country: 'Story-first songs, steady beat, twang. Choruses land clean.',
    folk: 'Acoustic instruments, intimate vocals, lyric-focused.',
    latin: 'Percussive rhythms, clave patterns, dance forms, hooks.',
    reggae: 'Off-beat skank guitar, deep bass, laid-back groove, spacious mix.',
    afrobeat: 'Polyrhythms, long vamps, horn punches, call and response.',
    classical: 'Orchestral/chamber instruments, formal structures, dynamics.',
    experimental: 'Form and timbre as a playground. Expect rule-bending structures.',
    metal: 'High-gain guitars, aggressive drums, extended techniques.',
    punk: 'Fast, raw, direct. Power chords, shouted hooks, minimal ornament.',
    house: 'Four-on-the-floor, warm bass, looped chords, long builds.',
    techno: 'Machine pulse, evolving timbre. Functional rhythm.',
    trance: 'Big melodic leads, saw stacks, euphoric drops, long phrases.',
    dubstep: 'Half-time lurch, wobble bass, stark space between hits.',
    rap: 'Bars over drums, cadence and rhyme carry the hook.',
    trap: 'Fast hats, 808 subs, sparse melodies, minor-key pads.',
    // Jazz subgenres
    'cool jazz': 'Relaxed tempos, lighter tone, contrapuntal. West Coast.',
    'nu jazz': 'Electronic textures meet jazz. Broken beats, ambient drift.',
    bebop: 'Fast tempos, complex changes, virtuosic solos. Head-solo.',
    'hard bop': 'Gospel and blues inflections in bebop. Groovier, earthier.',
    'smooth jazz': 'Radio-friendly melodies, steady grooves, polished production.',
    'jazz fusion': 'Electric instruments, rock/funk energy, extended solos.',
    swing: 'Big band arrangements, danceable pulse, riff-based melodies.',
    'bossa nova': 'Samba slowed, whisper vocals, jazz chords, gentle movement.',
    // Rock subgenres and parent categories
    heavy: 'Downtuned power, aggressive delivery, extended techniques.',
    modern: 'Post-2000 sensibilities, indie-influenced, textural depth.',
    retro: 'Blues roots, analog warmth, classic songwriting structures.',
    'alternative rock': 'Indie spirit, wider palette than classic rock. Hooks with bite.',
    'indie rock': 'DIY ethos, melodic focus, jangly guitars, earnest delivery.',
    'post-rock': 'Instrumental crescendos, texture over riffs, cinematic arcs.',
    shoegaze: 'Wall-of-sound guitars, buried vocals, texture over clarity.',
    'classic rock': 'Blues-based riffs, anthem choruses, guitar solos. Stadium-ready.',
    'garage rock': 'Raw, lo-fi, energetic. Three chords and attitude.',
    'psychedelic rock': 'Effects-heavy, extended jams, modal harmony, expansion.',
    'hard rock': 'Louder, heavier blues rock. Big riffs, powerful vocals.',
    'roots rock': 'Back to basics, Americana influence, organic feel, honest lyrics.',
    'southern rock': 'Blues and country blend, dual guitars, regional pride.',
    // Metal subgenres
    'stoner metal': 'Downtuned, fuzzy, groove-heavy. Desert rock meets Black Sabbath.',
    'death metal': 'Extreme vocals, blast beats, complex riffing, dark themes.',
    'nu metal': 'Hip-hop rhythms, downtuned guitars, angst-driven vocals.',
    // Punk subgenres
    emo: 'Emotional lyrics, dynamic shifts, melodic hardcore roots.',
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
    'k-pop': 'Korean pop, choreographed performance, mix of genres, global reach.',
    // Hip Hop subgenres and parent categories
    'alternative hip hop': 'Jazz/funk fusion, experimental, conscious. Tribe/Roots vibe.',
    'regional hip hop': 'Coast-specific sounds, local slang, geographical identity.',
    'trap & bass': 'Fast hats, 808 subs, dark energy, modern street sound.',
    drill: 'Dark, aggressive, sliding 808s, street narratives, ominous.',
    'gangsta rap': 'Hard beats, street stories, G-funk or boom-bap, raw energy.',
    'east coast hip hop': 'Sample-heavy, boom-bap drums, lyrical focus, NYC swagger.',
    'west coast rap': 'G-funk synths, laid-back grooves, melodic bass, California sun.',
    'southern hip hop': 'Crunk energy or chopped & screwed, regional slang, 808 bass.',
    'conscious hip hop': 'Socially aware lyrics, jazz/soul samples, message-driven.',
    'underground hip hop': 'Independent, experimental, lyrical depth, anti-commercial.',
    phonk: 'Memphis rap samples, dark aesthetic, cowbell hits, lo-fi crunch.',
    'cloud rap': 'Ethereal beats, Auto-Tuned flows, spacious mix, dreamy.',
    // Soul/R&B subgenres
    disco: 'Four-on-the-floor, string sections, funk bass, dance floor.',
    motown: 'Polished pop-soul, tambourine backbeat, call-response, Detroit.',
    'neo soul': 'Vintage soul modernized, live instruments, introspective lyrics.',
    'quiet storm': 'Late-night smooth R&B, mellow grooves, romantic themes.',
    // Reggae subgenres
    reggaeton: 'Dembow rhythm, Spanish vocals, reggae/dancehall, Latin fusion.',
    dancehall: 'Digital riddims, DJ toasts, upbeat energy, Jamaican patois.',
    ska: 'Upstroke guitars, walking bass, horn sections, reggae precursor.',
    dub: 'Remix culture, heavy reverb/delay, bass emphasis, stripped.',
    // Latin subgenres and parent categories
    'classic dance': 'Salsa, mambo, cumbia. Vintage Latin ballroom and social dance.',
    'modern latin': 'Reggaeton, Latin trap, urban beats with Spanish vocals.',
    salsa: 'Clave-driven, horn sections, piano montunos, Afro-Cuban roots.',
    cumbia: 'Colombian rhythms, accordion/synths, dancing groove, infectious.',
    mambo: 'Big band Latin jazz, syncopated brass, dance-floor energy.',
    merengue: 'Fast 2/4 rhythm, accordion, tambora drums, Dominican dance music.',
    'latin pop': 'Pop with Latin rhythms, crossover appeal, Spanish/bilingual.',
    tropical: 'Caribbean & Latin dance rhythms, bright production, summer vibes.',
    afropop: 'African rhythms meet pop, joyful energy, pan-African fusion.',
    amapiano: 'South African house, log drum bass, jazzy keys, laid-back groove.',
    // Classical subgenres
    'modern classical': 'Contemporary composition, extended techniques, film score style.',
    romantic: 'Emotional expression, rich orchestration, 19th century European.',
    // Country subgenres
    'classic country': 'Honky-tonk piano, steel guitar, traditional songwriting, Nashville.',
    'country rock': 'Electric guitars, rock energy, country storytelling, SoCal vibe.',
    'outlaw country': 'Anti-Nashville, rough edges, rebellious spirit, Willie & Waylon.',
    // Blues
    blues: 'Twelve-bar form, call and response, bent notes, catharsis.',
    bluegrass: 'Acoustic strings, high lonesome vocals, virtuosic picking, Appalachian.',
    'indie folk': 'Acoustic intimacy, poetic lyrics, folk traditions modernized.',
  };
  const key = String(genreName || '').toLowerCase();
  return map[key] || 'Choose a genre, subgenre, or track to explore its hidden patterns';
}
