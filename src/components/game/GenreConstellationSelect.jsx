import React, { useState, useEffect } from 'react';
import { Music, ChevronLeft } from 'lucide-react';

/**
 * GenreConstellationSelect
 * 
 * Interactive genre tree for profile selection.
 * Users navigate through genres → subgenres → tracks, then launch with difficulty.
 */
export function GenreConstellationSelect({ onLaunch }) {
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Navigation state
  const [navigationPath, setNavigationPath] = useState([]); // ['rock', 'metal']
  const [activeNode, setActiveNode] = useState(null); // Current genre data
  
  // Selection state
  const [difficulty, setDifficulty] = useState('medium');
  const [selectedTrack, setSelectedTrack] = useState(null); // For leaf nodes only
  
  // Load manifest on mount
  useEffect(() => {
    fetch('/genre_constellation_manifest.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load genre manifest');
        return res.json();
      })
      .then(data => {
        setManifest(data);
        setActiveNode(data); // Start at root (top-level genres)
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);
  
  /**
   * Get the current node's data based on navigation path
   */
  const getCurrentNode = () => {
    if (navigationPath.length === 0) return manifest;
    
    let node = manifest;
    for (const key of navigationPath) {
      if (node[key]) {
        node = node[key];
      } else if (node.subgenres && node.subgenres[key]) {
        node = node.subgenres[key];
      }
    }
    return node;
  };
  
  /**
   * Get children of current node (sub-genres or tracks)
   */
  const getChildren = () => {
    const node = getCurrentNode();
    if (!node) return [];
    
    const children = [];
    
    // Check for direct genre children (top level)
    Object.keys(node).forEach(key => {
      if (key !== 'seeds' && key !== 'subgenres' && typeof node[key] === 'object') {
        children.push({ key, type: 'genre', data: node[key] });
      }
    });
    
    // Check for subgenres
    if (node.subgenres) {
      Object.keys(node.subgenres).forEach(key => {
        children.push({ key, type: 'subgenre', data: node.subgenres[key] });
      });
    }
    
    return children;
  };
  
  /**
   * Get seeds from current node
   */
  const getSeeds = () => {
    const node = getCurrentNode();
    return node?.seeds || [];
  };
  
  /**
   * Handle clicking on a genre/subgenre
   */
  const handleGenreClick = (key) => {
    setNavigationPath([...navigationPath, key]);
    setSelectedTrack(null); // Clear track selection when navigating
  };
  
  /**
   * Handle clicking on a track (leaf node)
   */
  const handleTrackClick = (track) => {
    setSelectedTrack(track);
  };
  
  /**
   * Navigate back one level
   */
  const handleBack = () => {
    if (navigationPath.length === 0) return;
    
    setNavigationPath(navigationPath.slice(0, -1));
    setSelectedTrack(null);
  };
  
  /**
   * Launch the game with selected tracks + difficulty
   */
  const handleLaunch = () => {
    const seeds = getSeeds();
    
    // If specific track selected (leaf node), use only that one
    if (selectedTrack) {
      onLaunch([selectedTrack], difficulty);
      return;
    }
    
    // Otherwise use all seeds from current node
    if (seeds.length > 0) {
      onLaunch(seeds, difficulty);
    }
  };
  
  /**
   * Check if launch button should be enabled
   */
  const canLaunch = () => {
    const seeds = getSeeds();
    return seeds.length > 0; // Can launch if current node has seeds
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Loading genres...</div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }
  
  const children = getChildren();
  const seeds = getSeeds();
  const currentPath = navigationPath.join(' → ') || 'Select a Genre';
  
  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      {/* Header with back button */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            {navigationPath.length > 0 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-2"
              >
                <ChevronLeft size={20} />
                Back
              </button>
            )}
            <h1 className="text-3xl font-bold">{currentPath}</h1>
          </div>
          
          <Music className="text-green-500" size={32} />
        </div>
      </div>
      
      {/* Main content area */}
      <div className="max-w-6xl mx-auto">
        {/* SVG Canvas for circles */}
        <div className="bg-zinc-900 rounded-lg p-8 mb-8 min-h-[500px] flex items-center justify-center">
          <svg width="100%" height="500" viewBox="0 0 800 500">
            {/* Render children as circles */}
            {children.map((child, index) => {
              const angle = (index / children.length) * 2 * Math.PI;
              const radius = 150;
              const cx = 400 + Math.cos(angle) * radius;
              const cy = 250 + Math.sin(angle) * radius;
              const circleRadius = 60;
              
              return (
                <g
                  key={child.key}
                  onClick={() => handleGenreClick(child.key)}
                  className="cursor-pointer"
                  style={{ transition: 'all 0.2s' }}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={circleRadius}
                    fill="#27272a"
                    stroke="#22c55e"
                    strokeWidth="2"
                    className="hover:fill-zinc-800"
                  />
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="14"
                    className="pointer-events-none"
                  >
                    {child.key}
                  </text>
                </g>
              );
            })}
            
            {/* Render tracks if at leaf node */}
            {seeds.length > 0 && children.length === 0 && (
              seeds.map((track, index) => {
                const angle = (index / seeds.length) * 2 * Math.PI;
                const radius = 150;
                const cx = 400 + Math.cos(angle) * radius;
                const cy = 250 + Math.sin(angle) * radius;
                const circleRadius = 50;
                const isSelected = selectedTrack?.uri === track.uri;
                
                return (
                  <g
                    key={track.uri}
                    onClick={() => handleTrackClick(track)}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={circleRadius}
                      fill={isSelected ? "#22c55e" : "#27272a"}
                      stroke="#22c55e"
                      strokeWidth={isSelected ? "3" : "2"}
                      className="hover:fill-zinc-800"
                    />
                    <text
                      x={cx}
                      y={cy - 10}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="12"
                      className="pointer-events-none"
                    >
                      {track.artist}
                    </text>
                    <text
                      x={cx}
                      y={cy + 10}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#a1a1aa"
                      fontSize="10"
                      className="pointer-events-none"
                    >
                      {track.name.length > 20 ? track.name.substring(0, 20) + '...' : track.name}
                    </text>
                  </g>
                );
              })
            )}
          </svg>
        </div>
        
        {/* Difficulty selector */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <span className="text-zinc-400">Difficulty:</span>
          {['easy', 'medium', 'hard'].map(level => (
            <button
              key={level}
              onClick={() => setDifficulty(level)}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                difficulty === level
                  ? 'bg-green-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
        
        {/* Launch button */}
        <div className="flex justify-center">
          <button
            onClick={handleLaunch}
            disabled={!canLaunch()}
            className={`px-12 py-4 rounded-lg text-xl font-bold transition-all ${
              canLaunch()
                ? 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/50'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            }`}
          >
            Launch Puzzle
          </button>
        </div>
        
        {/* Debug info */}
        {seeds.length > 0 && (
          <div className="mt-6 text-center text-sm text-zinc-500">
            {seeds.length} track{seeds.length !== 1 ? 's' : ''} available
            {selectedTrack && ` • Selected: ${selectedTrack.name}`}
          </div>
        )}
      </div>
    </div>
  );
}
