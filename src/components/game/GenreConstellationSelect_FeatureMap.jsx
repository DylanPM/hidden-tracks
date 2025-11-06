import React, { useState, useEffect, useMemo } from 'react';
import { useFeatureMap } from '../../hooks/useFeatureMap';

// Human-friendly feature labels
const FEATURE_CONFIG = {
  danceability: { emoji: '💃', name: 'Dance', desc: 'How suitable for dancing' },
  energy: { emoji: '⚡', name: 'Energy', desc: 'Intensity and activity level' },
  speechiness: { emoji: '🗣️', name: 'Words', desc: 'How much talking/rapping' },
  acousticness: { emoji: '🎸', name: 'Acoustic', desc: 'Live instruments vs electronic' },
  valence: { emoji: '😊', name: 'Mood', desc: 'Happy vs sad feeling' },
  tempo_norm: { emoji: '🥁', name: 'Speed', desc: 'Fast vs slow tempo' },
  popularity: { emoji: '🔥', name: 'Popular', desc: 'How mainstream/well-known' },
  instrumentalness: { emoji: '🎹', name: 'Instrumental', desc: 'Music without vocals' }
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
  const [zoomLevel, setZoomLevel] = useState(1.0);

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

  // Get current node in the tree
  const getCurrentNode = () => {
    if (!manifest || viewStack.length === 0) return null;
    let node = manifest;
    for (const key of viewStack) {
      if (node[key]) node = node[key];
      else if (node.subgenres?.[key]) node = node.subgenres[key];
      else return null;
    }
    return node;
  };

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
    setSelectedNodeKey(key); // Set LAUNCH overlay on clicked node
    setZoomLevel(1.3); // Slight zoom when focusing
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

    // Clear LAUNCH overlay when going back to root
    if (newStack.length === 0) {
      setSelectedNodeKey(null);
      setZoomLevel(1.0);
    } else {
      // Keep LAUNCH on the parent node
      setSelectedNodeKey(newStack[newStack.length - 1]);
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
      // For tracks: arrange in circle around parent position
      const parentPath = viewStack.join('.');
      const parentPos = positions[parentPath] || { x: 0, y: 0 };
      const circleRadius = 120;
      const angleStep = (Math.PI * 2) / loadedTracks.length;

      loadedTracks.forEach((track, i) => {
        const angle = i * angleStep;
        const x = parentPos.x + Math.cos(angle) * circleRadius;
        const y = parentPos.y + Math.sin(angle) * circleRadius;

        items.push({
          key: track.uri || i,
          label: `${track.artist} - ${track.name}`,
          x,
          y,
          type: 'track',
          track: track, // Store full track data for orbiting text
          onClick: () => handleTrackClick(track),
          isSelected: selectedTrack?.uri === track.uri
        });
      });
    }

    return items;
  };

  const items = renderItems();

  // Get selected node position for connection lines and LAUNCH overlay
  const selectedNode = items.find(item => item.key === selectedNodeKey);
  const selectedNodePos = selectedNode ? { x: selectedNode.x, y: selectedNode.y } : { x: 0, y: 0 };

  // Axis configuration
  const axisConfig = useMemo(() => {
    if (!manifest?.global) return [];

    const { feature_angles } = manifest.global.display;
    const angleStep = (Math.PI * 2) / feature_angles.length;
    const axisRadius = 250; // Distance from center to axis label

    return feature_angles.map((feature, i) => {
      const angle = i * angleStep;
      const config = FEATURE_CONFIG[feature] || { emoji: '?', name: feature, desc: '' };
      return {
        feature,
        angle,
        x: Math.cos(angle) * axisRadius,
        y: Math.sin(angle) * axisRadius,
        ...config,
        enabled: activeFeatures[feature] !== false
      };
    });
  }, [manifest, activeFeatures]);

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
          {axisConfig.map(axis => (
            <div key={axis.feature} className="flex items-center gap-2 group">
              <input
                type="checkbox"
                checked={axis.enabled}
                onChange={() => toggleFeature(axis.feature)}
                className="w-3 h-3"
              />
              <span className="text-sm cursor-pointer flex-1" title={axis.desc} onClick={() => toggleFeature(axis.feature)}>
                <span className="mr-1">{axis.emoji}</span>
                <span className={axis.enabled ? 'text-white' : 'text-zinc-600'}>{axis.name}</span>
              </span>
              <button
                onClick={() => enableOnly(axis.feature)}
                className="text-xs px-1 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 opacity-0 group-hover:opacity-100 transition"
                title="Only this one"
              >
                only
              </button>
            </div>
          ))}
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
            transform: `scale(${zoomLevel})`,
            transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <defs>
            {/* Circular path for orbiting text (positioned at selected node) */}
            <path
              id="descPath"
              d={`
                M ${CENTER_X + selectedNodePos.x} ${CENTER_Y + selectedNodePos.y}
                m -120, 0
                a 120,120 0 1,1 240,0
                a 120,120 0 1,1 -240,0
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
          </defs>

          {/* Octagon back button (outer ring) */}
          {viewStack.length > 0 && (
            <polygon
              points={(() => {
                const outerRadius = 280;
                const innerRadius = 260;
                const angles = axisConfig.map(a => a.angle);

                // Create octagon ring with inner and outer vertices
                const outerPoints = angles.map(angle =>
                  `${CENTER_X + Math.cos(angle) * outerRadius},${CENTER_Y + Math.sin(angle) * outerRadius}`
                ).join(' ');
                const innerPoints = angles.map(angle =>
                  `${CENTER_X + Math.cos(angle) * innerRadius},${CENTER_Y + Math.sin(angle) * innerRadius}`
                ).reverse().join(' ');

                return `${outerPoints} ${innerPoints}`;
              })()}
              fill="#3f3f46"
              fillOpacity="0.15"
              stroke="#52525b"
              strokeWidth="2"
              className="cursor-pointer hover:fill-opacity-30 transition-all"
              onClick={handleBack}
            />
          )}

          {/* Axis lines and labels */}
          {axisConfig.map(axis => (
            <g key={axis.feature} opacity={axis.enabled ? 1 : 0.2}>
              <line
                x1={CENTER_X}
                y1={CENTER_Y}
                x2={CENTER_X + axis.x}
                y2={CENTER_Y + axis.y}
                stroke="#3f3f46"
                strokeWidth="1"
                opacity="0.3"
              />
              <g transform={`translate(${CENTER_X + axis.x}, ${CENTER_Y + axis.y})`}>
                <rect
                  x="-32"
                  y="-16"
                  width="64"
                  height="32"
                  fill="#18181b"
                  stroke={axis.enabled ? '#22c55e' : '#3f3f46'}
                  strokeWidth="1.5"
                  rx="6"
                />
                <text
                  textAnchor="middle"
                  fill={axis.enabled ? 'white' : '#71717a'}
                  fontSize="16"
                  fontWeight="600"
                >
                  <tspan x="0" dy="-3">{axis.emoji}</tspan>
                </text>
                <text
                  textAnchor="middle"
                  fill={axis.enabled ? '#a1a1aa' : '#52525b'}
                  fontSize="9"
                  fontWeight="600"
                  y="14"
                >
                  {axis.name}
                </text>
              </g>
            </g>
          ))}

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
            const nodeRadius = item.type === 'track' ? 40 : 50;
            const launchRingRadius = 75; // Outer ring for LAUNCH overlay

            return (
              <g
                key={item.key}
                onMouseEnter={() => setHoveredItem(item)}
                onMouseLeave={() => setHoveredItem(null)}
                className="cursor-pointer"
                transform={`translate(${CENTER_X + item.x}, ${CENTER_Y + item.y})`}
              >
                {/* LAUNCH overlay ring (if selected) */}
                {isSelected && canLaunch() && (
                  <>
                    {/* Fill between node and text ring */}
                    <circle
                      r={launchRingRadius}
                      fill="#22c55e"
                      opacity="0.15"
                      style={{
                        animation: 'pulse 2s ease-in-out infinite'
                      }}
                    />
                    {/* Outer stroke for text ring */}
                    <circle
                      r={launchRingRadius}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="2"
                      opacity="0.6"
                    />
                    {/* LAUNCH text centered */}
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
                      LAUNCH
                    </text>
                  </>
                )}

                {/* Main node circle */}
                <circle
                  r={nodeRadius}
                  fill="#18181b"
                  stroke={isSelected ? '#22c55e' : item.isSelected ? '#eab308' : hoveredItem?.key === item.key ? '#16a34a' : '#22c55e'}
                  strokeWidth={isSelected ? '4' : item.isSelected ? '4' : hoveredItem?.key === item.key ? '3' : '2'}
                  className="hover:fill-zinc-800 transition-all"
                  filter={hoveredItem?.key === item.key ? 'url(#glow)' : undefined}
                  onClick={isSelected && canLaunch() ? handleLaunch : item.onClick}
                />

                {/* Node label */}
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={item.type === 'track' ? 10 : 12}
                  fontWeight="700"
                  style={{ pointerEvents: 'none' }}
                >
                  {item.label.length > 20 ? item.label.slice(0, 20) + '…' : item.label}
                </text>
              </g>
            );
          })}

          {/* Orbiting description text (around selected node) */}
          {selectedNode && (
            <g
              style={{
                transformOrigin: `${CENTER_X + selectedNodePos.x}px ${CENTER_Y + selectedNodePos.y}px`,
                animation: `orbit 11000ms linear infinite`,
                pointerEvents: 'none'
              }}
            >
              <text fontSize="14" fill="#b7f7cf" fontWeight="700" letterSpacing="0.5px">
                <textPath href="#descPath" startOffset="0%">
                  {selectedNode.type === 'track' && selectedNode.track
                    ? `${selectedNode.track.artist} - ${selectedNode.track.name}`
                    : genreDescription
                  }
                </textPath>
              </text>
            </g>
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
  };
  const key = String(genreName || '').toLowerCase();
  return map[key] || 'Choose a genre, subgenre, or track to explore its hidden patterns';
}
