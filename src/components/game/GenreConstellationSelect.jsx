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
  git 
  const children = getChildren();
  const seeds = getSeeds();
  const currentGenre = navigationPath.length > 0 
    ? navigationPath[navigationPath.length - 1] 
    : 'a genre';
  
  // Calculate circle positions to avoid overlap
  const numCircles = children.length > 0 ? children.length : seeds.length;
  const baseRadius = Math.min(200, 150 + numCircles * 5); // Expand radius with more items
  const circleRadius = Math.max(40, 80 - numCircles * 2); // Shrink circles with more items
  
  return (
    <div className="min-h-screen bg-zinc-950 text-white relative">
      {/* Giant back button - left half of screen */}
      {navigationPath.length > 0 && (
        <button
          onClick={handleBack}
          className="fixed left-0 top-0 h-full w-24 bg-gradient-to-r from-zinc-900 to-transparent 
                     flex items-center justify-start pl-4 hover:from-zinc-800 transition-all z-10
                     group"
        >
          <div className="flex flex-col items-center gap-2">
            <ChevronLeft size={48} className="text-zinc-600 group-hover:text-white transition-colors" />
            <span className="text-zinc-600 group-hover:text-white text-xs font-medium rotate-[-90deg] whitespace-nowrap">
              BACK
            </span>
          </div>
        </button>
      )}
      
      {/* Main content */}
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        {/* SVG Canvas */}
        <div className="relative w-full max-w-4xl">
          <svg width="100%" height="600" viewBox="0 0 800 600" className="overflow-visible">
            {/* Center launch button */}
            <g>
              <circle
                cx="400"
                cy="300"
                r="100"
                fill={canLaunch() ? "#22c55e" : "#27272a"}
                stroke={canLaunch() ? "#16a34a" : "#3f3f46"}
                strokeWidth="4"
                className={canLaunch() ? "cursor-pointer" : "cursor-not-allowed"}
                onClick={canLaunch() ? handleLaunch : undefined}
              />
              <text
                x="400"
                y="290"
                textAnchor="middle"
                dominantBaseline="middle"
                fill={canLaunch() ? "white" : "#52525b"}
                fontSize="24"
                fontWeight="bold"
                className="pointer-events-none uppercase"
              >
                Launch
              </text>
              <text
                x="400"
                y="315"
                textAnchor="middle"
                dominantBaseline="middle"
                fill={canLaunch() ? "white" : "#52525b"}
                fontSize="16"
                className="pointer-events-none capitalize"
              >
                {currentGenre}
              </text>
            </g>
            
            {/* Render genre children as circles orbiting center */}
            {children.map((child, index) => {
              const angle = (index / children.length) * 2 * Math.PI - Math.PI / 2;
              const cx = 400 + Math.cos(angle) * baseRadius;
              const cy = 300 + Math.sin(angle) * baseRadius;
              
              // Word wrap for long genre names
              const words = child.key.split(' ');
              const lines = [];
              let currentLine = '';
              
              words.forEach(word => {
                if ((currentLine + ' ' + word).length > 12) {
                  if (currentLine) lines.push(currentLine);
                  currentLine = word;
                } else {
                  currentLine = currentLine ? currentLine + ' ' + word : word;
                }
              });
              if (currentLine) lines.push(currentLine);
              
              return (
                <g
                  key={child.key}
                  onClick={() => handleGenreClick(child.key)}
                  className="cursor-pointer transition-all"
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={circleRadius}
                    fill="#18181b"
                    stroke="#22c55e"
                    strokeWidth="3"
                    className="hover:fill-zinc-800 hover:stroke-green-400 transition-all"
                  />
                  {lines.map((line, i) => (
                    <text
                      key={i}
                      x={cx}
                      y={cy - (lines.length - 1) * 7 + i * 14}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="13"
                      fontWeight="500"
                      className="pointer-events-none"
                    >
                      {line}
                    </text>
                  ))}
                </g>
              );
            })}
            
            {/* Render tracks if at leaf node */}
            {seeds.length > 0 && children.length === 0 && (
              seeds.map((track, index) => {
                const angle = (index / seeds.length) * 2 * Math.PI - Math.PI / 2;
                const cx = 400 + Math.cos(angle) * baseRadius;
                const cy = 300 + Math.sin(angle) * baseRadius;
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
                      fill={isSelected ? "#22c55e" : "#18181b"}
                      stroke="#22c55e"
                      strokeWidth={isSelected ? "4" : "3"}
                      className="hover:fill-zinc-800 transition-all"
                    />
                    <text
                      x={cx}
                      y={cy - 12}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="12"
                      fontWeight="600"
                      className="pointer-events-none"
                    >
                      {track.artist.length > 18 ? track.artist.substring(0, 18) + '...' : track.artist}
                    </text>
                    <text
                      x={cx}
                      y={cy + 8}
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
        
        {/* Info below canvas */}
        {canLaunch() && (
          <div className="mt-8 text-center animate-fade-in">
            <div className="text-2xl font-bold mb-2">
              Launch {currentGenre.charAt(0).toUpperCase() + currentGenre.slice(1)} Puzzle
            </div>
            <div className="text-zinc-400 mb-6">
              {seeds.length} track{seeds.length !== 1 ? 's' : ''} available
              {selectedTrack && ` • ${selectedTrack.name} selected`}
            </div>
            
            {/* Difficulty selector */}
            <div className="flex items-center justify-center gap-3">
              {['easy', 'medium', 'hard'].map(level => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={`px-8 py-3 rounded-lg font-bold transition-all ${
                    difficulty === level
                      ? 'bg-green-500 text-black scale-110'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:scale-105'
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
