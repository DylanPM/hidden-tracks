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
  const [launchAnimation, setLaunchAnimation] = useState(false); // For button animation
  
  /**
   * Generate a brief description for a genre
   */
  const getGenreDescription = (genreName) => {
    const descriptions = {
      // Top level
      'rock': 'High-energy anthems and guitar-driven classics',
      'electronic': 'Synthesized beats and digital soundscapes',
      'hip hop': 'Rhythmic vocals and urban storytelling',
      'pop': 'Catchy melodies and mainstream appeal',
      'jazz': 'Improvisational artistry and swing rhythms',
      'country': 'Heartfelt stories with acoustic roots',
      'r&b': 'Soulful vocals and smooth grooves',
      'latin': 'Vibrant rhythms from Latin America',
      'classical': 'Orchestral masterpieces and timeless compositions',
      'indie': 'Independent spirit and alternative sounds',
      'folk': 'Acoustic storytelling and traditional melodies',
      'blues': 'Emotional depth and twelve-bar progressions',
      
      // Common subgenres
      'metal': 'Heavy riffs and intense energy',
      'punk': 'Raw power and rebellious attitude',
      'alternative': 'Non-mainstream rock experimentation',
      'house': 'Four-on-the-floor beats and club energy',
      'techno': 'Hypnotic rhythms and futuristic sounds',
      'trap': 'Hard-hitting 808s and hi-hats',
      'funk': 'Groovy bass lines and rhythmic emphasis',
      'soul': 'Emotional vocals and gospel influences',
      'reggae': 'Laid-back rhythms from Jamaica',
      'bossa nova': 'Smooth Brazilian jazz fusion',
      'bluegrass': 'Fast-paced acoustic picking',
      'indie rock': 'Guitar-driven independent music',
      'singer-songwriter': 'Personal lyrics and intimate performances',
    };
    
    // Return specific description or generate generic one
    const lowerGenre = genreName.toLowerCase();
    if (descriptions[lowerGenre]) {
      return descriptions[lowerGenre];
    }
    
    // Generic fallback
    return `Explore the sounds of ${genreName}`;
  };
  
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
    
    // Trigger launch animation if new node is launchable
    setTimeout(() => {
      setLaunchAnimation(true);
      setTimeout(() => setLaunchAnimation(false), 600);
    }, 100);
  };
  
  /**
   * Handle clicking on a track (leaf node)
   */
  const handleTrackClick = (track) => {
    setSelectedTrack(track);
    
    // Trigger launch animation
    setLaunchAnimation(true);
    setTimeout(() => setLaunchAnimation(false), 600);
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
      console.log('[CONSTELLATION launch] if selected track', difficulty);

      onLaunch([selectedTrack], difficulty);
      return;
    }
    
    // Otherwise use all seeds from current node
    if (seeds.length > 0) {
      console.log('[CONSTELLATION launch] seeds.length', difficulty);

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
  const currentGenre = navigationPath.length > 0 
    ? navigationPath[navigationPath.length - 1] 
    : 'a genre';
  
  // Calculate circle positions to avoid overlap
  const numCircles = children.length > 0 ? children.length : seeds.length;
  const baseRadius = Math.min(220, 160 + numCircles * 5); // Expand radius with more items
  
  // Make circles bigger for tracks (need room for artist + song)
  const circleRadius = children.length > 0 
    ? Math.max(45, 85 - numCircles * 2)  // Genre circles
    : Math.max(55, 95 - numCircles * 2); // Track circles (bigger)
  
  return (
    <div className="min-h-screen bg-zinc-950 text-white relative">
      {/* Giant back button - left half of screen */}
      {navigationPath.length > 0 && (
        <button
          onClick={handleBack}
          className="fixed left-0 top-0 h-full w-32 bg-gradient-to-r from-green-900/40 to-transparent 
                     flex items-center justify-start pl-6 hover:from-green-800/60 transition-all z-10
                     group"
        >
          <div className="flex flex-col items-center gap-3">
            <ChevronLeft size={64} className="text-green-500 group-hover:text-green-400 transition-colors" />
            <span className="text-green-500 group-hover:text-green-400 text-sm font-bold rotate-[-90deg] whitespace-nowrap">
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
            <g className={launchAnimation ? 'animate-bounce-subtle' : ''}>
              <circle
                cx="400"
                cy="300"
                r="100"
                fill={canLaunch() ? "#22c55e" : "#27272a"}
                stroke={canLaunch() ? "#16a34a" : "#3f3f46"}
                strokeWidth="4"
                className={canLaunch() ? "cursor-pointer transition-all" : "cursor-not-allowed transition-all"}
                onClick={canLaunch() ? handleLaunch : undefined}
                style={{
                  transform: launchAnimation ? 'scale(1.1)' : 'scale(1)',
                  transformOrigin: '400px 300px',
                  transition: 'transform 0.3s ease-out'
                }}
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
                
                // Smarter text truncation
                const maxArtistLen = 16;
                const maxSongLen = 18;
                const artistText = track.artist.length > maxArtistLen 
                  ? track.artist.substring(0, maxArtistLen) + '...' 
                  : track.artist;
                const songText = track.name.length > maxSongLen 
                  ? track.name.substring(0, maxSongLen) + '...' 
                  : track.name;
                
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
                      y={cy - 14}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="13"
                      fontWeight="600"
                      className="pointer-events-none"
                    >
                      {artistText}
                    </text>
                    <text
                      x={cx}
                      y={cy + 10}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#a1a1aa"
                      fontSize="11"
                      className="pointer-events-none"
                    >
                      {songText}
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
            <div className="text-zinc-300 text-lg mb-3 italic">
              {getGenreDescription(currentGenre)}
            </div>
            <div className="text-zinc-400 mb-6">
              {seeds.length} track{seeds.length !== 1 ? 's' : ''} available
              {selectedTrack && ` • ${selectedTrack.name} selected`}
            </div>

            {/* Intro banner */}
            <div className="max-w-2xl mx-auto mb-8 text-center animate-fadeIn">

              <h2 className="text-2xl font-bold text-white mb-3">Welcome to Hidden Tracks</h2>
              <p className="text-zinc-300 mb-2">
                See how recommendation systems “think.” This game lets you explore the logic behind
                algorithmic playlists—guess the other songs the machine would queue up next.
              </p>
              <p className="text-zinc-400 mb-2">
                Pick a genre, sub-genre, or song you love, set a difficulty, and launch your mix.
              </p>
              <p className="text-zinc-500 text-sm">
                Built with the help of Anthropic’s Claude.
              </p>
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
