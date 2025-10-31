import React, { useState, useEffect } from 'react';
import { useGameState } from './hooks/useGameState';
import { ProfileSelect } from './components/profile/ProfileSelect';
import { TasteBuilder, buildProfileFromPath } from './components/profile/TasteBuilder';
import { ProfileSummary } from './components/profile/ProfileSummary';
import { GenreConstellationSelect } from './components/game/GenreConstellationSelect';
import { DraftPhase } from './components/game/DraftPhase';
import { GuessPhase } from './components/game/GuessPhase';
import { ScorePhase } from './components/game/ScorePhase';
import { generateSeedHints } from './utils/gameUtils';
import { CHALLENGES } from './constants/gameConfig';

const DEMO_MODE = true;
const DEBUG_MODE = true; // Set to false to disable debug view

function RadioPuzzleGame() {
  const [phase, setPhase] = useState('constellation'); // NEW: Start with constellation
  const [spotifyToken, setSpotifyToken] = useState(null);
  const [allSongs, setAllSongs] = useState([]);
  const [tasteProfile, setTasteProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  
  // NEW: Constellation selection state
  const [selectedTracks, setSelectedTracks] = useState([]);
  const [difficulty, setDifficulty] = useState('medium');
  const [loadedProfile, setLoadedProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  
  // Taste builder state
  const [tasteBuilderRound, setTasteBuilderRound] = useState(1);
  const [tasteBuilderPath, setTasteBuilderPath] = useState([]);
  
  // Game settings
  const [maxGuesses, setMaxGuesses] = useState(6);
  const [difficultyLevel, setDifficultyLevel] = useState(5);
  
  // UI state
  const [currentChoice, setCurrentChoice] = useState(null);
  const [removeMode, setRemoveMode] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textMatchedSong, setTextMatchedSong] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [profileLoadError, setProfileLoadError] = useState(null);
  
  const gameState = useGameState();
  const guessesLeft = maxGuesses - gameState.state.guesses.length;
  
  
// Resize iframe dynamically
useEffect(() => {
  const resize = () => {
    const height = document.documentElement.scrollHeight;
    window.parent?.postMessage({ type: 'resize', height }, '*');
  };
  resize();
  window.addEventListener('resize', resize);
  const observer = new MutationObserver(resize);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => {
    window.removeEventListener('resize', resize);
    observer.disconnect();
  };
}, [phase]);
  
// Automatically go to score when no guesses remain
useEffect(() => {
  if (phase === 'guess' && guessesLeft <= 0) {
    setPhase('score');
  }
}, [phase, guessesLeft]);

// Skip OAuth path entirely for demo builds, otherwise run normal auth check
useEffect(() => {
  if (DEMO_MODE) return;

  const checkAuth = async () => {
    const token = localStorage.getItem('spotify_token');
    if (token) {
      setSpotifyToken(token);
      await fetchSpotifyProfile(token);
    } else {
      setPhase('profile-select');
    }
  };

  if (phase === 'auth-check') {
    checkAuth();
  }
}, [phase]);


  const fetchSpotifyProfile = async (token) => {
    try {
      setLoading(true);
      
      const tracksResponse = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=50', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      
      if (!tracksResponse.ok) throw new Error('Failed to fetch tracks');
      
      const tracksData = await tracksResponse.json();
      
      if (!tracksData.items || tracksData.items.length === 0) {
        throw new Error('No tracks found');
      }
      
      const trackIds = tracksData.items.map(t => t.id).join(',');
      
      const featuresResponse = await fetch(`https://api.spotify.com/v1/audio-features?ids=${trackIds}`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      
      const featuresData = await featuresResponse.json();

      //building profile here
      // const profile = buildSpotifyProfile(tracksData.items, featuresData.audio_features);
      
      if (!profile) {
        throw new Error('Failed to build profile');
      }
      
      setTasteProfile(profile);
      setPhase('profile-summary');
    } catch (error) {
      console.error('Spotify profile fetch error:', error);
      setAuthError('Failed to load your Spotify data. You can still play with a preset profile.');
      setPhase('profile-select');
    } finally {
      setLoading(false);
    }
  };

  // // Load dataset when entering loading phase
  // useEffect(() => {
  //   if (phase === 'loading' && allSongs.length === 0) {
  //     loadSpotifyDataset().then(songs => {
  //       setAllSongs(songs);
  //       setPhase('setup');
  //     });
  //   }
  // }, [phase, allSongs.length]);

  // OLD loading code removed - now using loadProfileForSeed() instead

// NEW: Handle constellation launch
const handleConstellationLaunch = (tracks, selectedDifficulty) => {
  console.log('Constellation launch:', { tracks, selectedDifficulty });
  
  // Convert constellation format to game format, keeping artists as array
  const convertedTracks = tracks.map(track => ({
    track_id: track.uri,
    track_name: track.name,
    artists: Array.isArray(track.artist) ? track.artist : [track.artist],
    filename: track.filename,
    // Store original for reference
    _constellation: track
  }));
  
  setSelectedTracks(convertedTracks);
  setDifficulty(selectedDifficulty);
  
  // Mark if this is a single-track launch (seed is locked)
  if (tracks.length === 1) {
    localStorage.setItem('seedIsLocked', 'true');
  } else {
    localStorage.removeItem('seedIsLocked');
  }
  
  // Go to draft phase - user will pick seed + challenges
  setPhase('draft');
};

// NEW: Load profile when draft is complete
const loadProfileForSeed = async (seed) => {
  if (!seed || !seed.filename) {
    console.error('No filename on seed:', seed);
    return;
  }
  
  if (profileLoading) {
    console.log('Profile already loading, ignoring duplicate request');
    return;
  }
  
  try {
    setProfileLoading(true);
    setPhase('loading');
    console.log('Loading profile:', seed.filename);
    
    const response = await fetch(`/profiles/${seed.filename}`);
    if (!response.ok) {
      throw new Error(`Failed to load profile: ${response.status}`);
    }
    
    const profile = await response.json();
    console.log('Profile loaded:', profile);
    console.log('Profile keys:', Object.keys(profile));
    console.log('Has seed?', !!profile?.seed);
    console.log('Has tracks?', !!profile?.tracks);
    console.log('Track count:', profile?.tracks?.length);
    
    // VALIDATION: Check profile has required data
    if (!profile?.seed) {
      throw new Error('Profile missing seed data');
    }
    
    if (!profile?.tracks || profile.tracks.length === 0) {
      throw new Error('Profile missing tracks data');
    }
    
    // Build pools from tracks by filtering on their pools array
    console.log('Building difficulty pools from tracks...');
    
    const allTracks = profile.tracks;
    
    // Filter tracks by which pools they belong to
    const easyPool = allTracks.filter(t => t.pools?.includes('easy'));
    const mediumPool = allTracks.filter(t => t.pools?.includes('medium'));
    const hardPool = allTracks.filter(t => t.pools?.includes('hard'));
    
    console.log('Pool sizes:', {
      easy: easyPool.length,
      medium: mediumPool.length,
      hard: hardPool.length
    });
    
    // Store pools in profile object for easy access
    profile.pools = {
      easy: easyPool,
      medium: mediumPool,
      hard: hardPool
    };
    
    // Validate we have enough tracks in selected difficulty
    const selectedPool = profile.pools[difficulty] || profile.pools.medium;
    if (!selectedPool || selectedPool.length === 0) {
      throw new Error(`No tracks in ${difficulty} pool`);
    }
    
    // Store the profile
    setLoadedProfile(profile);
    
    // Use the profile's seed data (has full audio features)
    const fullSeed = {
      track_id: profile.seed.id,
      artists: profile.seed.artists, // Keep as array
      track_name: profile.seed.name,
      ...profile.seed // includes all audio features
    };
    
    gameState.setSeed(fullSeed);
    
    // Generate seed hints
    const hints = generateSeedHints(fullSeed);
    gameState.setSeedHints(hints);
    
    // Set radio playlist from profile's correct tracks in the selected difficulty pool
    const pool = profile.pools[difficulty] || profile.pools.medium || [];
    const correctTracks = pool.filter(t => t.correct === true);
    
    // VALIDATION: Check we have enough tracks
    if (correctTracks.length < 10) {
      throw new Error(`Not enough correct tracks in ${difficulty} pool (found ${correctTracks.length}, need 10+)`);
    }
    
    console.log(`Using ${difficulty} pool:`, correctTracks.length, 'correct tracks');
    
    // Convert to game format, keeping artists as arrays
    const radioPlaylist = correctTracks.map(t => ({
      track_id: t.id,
      artists: t.artists, // Keep as array
      track_name: t.name,
      ...t // includes all audio features and correct flag
    }));
    
    gameState.setRadioPlaylist(radioPlaylist);
    
    // Move to guess phase
    setProfileLoading(false);
    setPhase('guess');
    
  } catch (error) {
    console.error('Error loading profile:', error);
    setProfileLoading(false);
    setProfileLoadError(error.message || 'Failed to load profile');
    setPhase('error');
  }
};

//new function to load and decode profile ends here

  // Generate choice when in draft phase
  useEffect(() => {
    if (phase === 'draft') {
      // If only 1 track selected, auto-set as seed and skip straight to challenges
      if (selectedTracks.length === 1 && !gameState.state.seed) {
        const track = selectedTracks[0];
        // Track is already in game format from handleConstellationLaunch
        gameState.setSeed(track);
        // Don't generate choice yet - will trigger after seed is set
      }
      
      if (!currentChoice && !removeMode) {
        generateChoice();
      }
    } else if (phase === 'guess' && gameState.state.multipleChoiceOptions.length === 0 && gameState.state.radioPlaylist.length > 0) {
      generateMultipleChoice();
    }
  }, [phase, currentChoice, removeMode, gameState.state.radioPlaylist.length, gameState.state.multipleChoiceOptions.length, selectedTracks]);

  const generateRadioPlaylist = (seedSong) => {
    if (!seedSong) return [];
    
    const songsToUse = allSongs.filter(s => 
      s && Array.isArray(s.artists) && s.artists.length > 0 && s.track_name && typeof s.track_name === 'string'
    );
    
    const similarities = songsToUse
      .filter(song => song.track_id !== seedSong.track_id)
      .map(song => ({ song, similarity: calculateSimilarity(seedSong, song) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 25);
    
    return similarities.map(s => s.song);
  };

  const generateChoice = () => {
    const needsSeed = !gameState.state.seed;
    const needsChallenges = gameState.state.challenges.filter(c => c !== null).length < 3;

    if (!needsSeed && !needsChallenges) {
      // Draft complete! Load the profile for the selected seed
      loadProfileForSeed(gameState.state.seed);
      return;
    }

    const cardTypes = [];
    
    // CRITICAL: If we only have 1 track and it's the seed, DON'T offer song cards
    const canOfferSongCards = selectedTracks.length > 1 || !gameState.state.seed;
    
    // CRITICAL: If seed was auto-locked from single track, don't allow removing it
    const seedIsLocked = selectedTracks.length === 1 && gameState.state.seed;
    
    if (needsSeed && canOfferSongCards) {
      cardTypes.push('song', 'song');
    }
    if (needsChallenges) {
      cardTypes.push('challenge', 'challenge');
    }
    // Only offer remove if seed is not locked
    if (!seedIsLocked && (gameState.state.seed || gameState.state.challenges.some(c => c !== null))) {
      cardTypes.push('remove');
    }
    
    // If no valid card types (shouldn't happen), default to challenges
    if (cardTypes.length === 0) {
      cardTypes.push('challenge', 'challenge');
    }

    const typeA = cardTypes[Math.floor(Math.random() * cardTypes.length)];
    let typeB = cardTypes[Math.floor(Math.random() * cardTypes.length)];
    while (typeA === 'remove' && typeB === 'remove') {
      typeB = cardTypes[Math.floor(Math.random() * cardTypes.length)];
    }

    const usedChallengeIds = gameState.state.challenges.filter(c => c !== null).map(c => c.id);
    const availableChallenges = CHALLENGES.filter(c => !usedChallengeIds.includes(c.id));

    const createCard = (type) => {
      if (type === 'song') {
        // Use selectedTracks for song cards
        const songsToUse = selectedTracks.filter(s => 
          s && s.artists && s.track_name &&
          // CRITICAL: Don't offer the seed as a card option
          s.track_id !== gameState.state.seed?.track_id
        );
        
        if (songsToUse.length === 0) {
          // Fallback to challenge if no valid songs
          if (availableChallenges.length === 0) return { type: 'remove', data: null };
          return { type: 'challenge', data: availableChallenges[Math.floor(Math.random() * availableChallenges.length)] };
        }
        
        const song = songsToUse[Math.floor(Math.random() * songsToUse.length)];
        return { type: 'song', data: song };
      } else if (type === 'challenge') {
        if (availableChallenges.length === 0) return { type: 'remove', data: null };
        return { type: 'challenge', data: availableChallenges[Math.floor(Math.random() * availableChallenges.length)] };
      } else {
        return { type: 'remove', data: null };
      }
    };

    setCurrentChoice({ optionA: createCard(typeA), optionB: createCard(typeB) });
  };

  const selectCard = (option) => {
    console.log('selectCard called with:', option);
    
    if (option.type === 'song' && !gameState.state.seed) {
      if (!option.data || !option.data.artists || !option.data.track_name) {
        console.error('Invalid song data in option:', option);
        setCurrentChoice(null);
        return;
      }
      
      console.log('Setting seed:', option.data);
      gameState.setSeed(option.data);
      setCurrentChoice(null);
    } else if (option.type === 'challenge') {
      const emptySlot = gameState.state.challenges.findIndex(c => c === null);
      if (emptySlot !== -1) {
        console.log('Setting challenge in slot', emptySlot, ':', option.data.name);
        gameState.setChallenge(emptySlot, option.data);
        setCurrentChoice(null);
      }
    } else if (option.type === 'remove') {
      setRemoveMode(true);
      setCurrentChoice(null);
    }
  };

  const removeSlot = (slotType, index = null) => {
    if (slotType === 'seed') gameState.removeSeed();
    else if (slotType === 'challenge' && index !== null) {
      gameState.removeChallenge(index);
    }
    setRemoveMode(false);
  };

  // const generateFeedback = (song, seed) => {
  //   const feedback = [];
    
  //   // Use profile's similarity scores for precise feedback
  //   if (song.radio_fit !== undefined && song.radio_fit < 0.5) {
  //     feedback.push(`Low radio fit score (${(song.radio_fit * 100).toFixed(0)}%)`);
  //   }
    
  //   if (song.audio_sim !== undefined && song.audio_sim < 0.6) {
  //     feedback.push(`Audio features don't match closely (${(song.audio_sim * 100).toFixed(0)}% similar)`);
  //   }
    
  //   if (song.genre_sim !== undefined && song.genre_sim < 0.3) {
  //     feedback.push(`Different genre (${(song.genre_sim * 100).toFixed(0)}% overlap)`);
  //   }
    
  //   if (song.era_dist !== undefined && song.era_dist > 15) {
  //     feedback.push(`Different era (${song.era_dist} years apart)`);
  //   }
    
  //   // Fallback to basic comparison if similarity scores aren't available
  //   if (feedback.length === 0) {
  //     if (song.energy !== undefined && seed.energy !== undefined) {
  //       const energyDiff = Math.abs(song.energy - seed.energy);
  //       if (energyDiff > 0.2) {
  //         feedback.push(song.energy > seed.energy ? 'Much higher energy' : 'Much lower energy');
  //       }
  //     }
      
  //     if (song.valence !== undefined && seed.valence !== undefined) {
  //       const valenceDiff = Math.abs(song.valence - seed.valence);
  //       if (valenceDiff > 0.2) {
  //         feedback.push(song.valence > seed.valence ? 'Much more positive vibe' : 'Much more negative vibe');
  //       }
  //     }
      
  //     if (feedback.length === 0) {
  //       feedback.push('Not similar enough to belong on this radio station');
  //     }
  //   }
    
  //   return feedback;
  // };

  const generateMultipleChoice = () => {
    // Use difficulty setting to determine mix
    let correctCount;
    const roll = Math.random() * 100;
    
    // Simplified difficulty: easy = more correct, hard = fewer correct
    if (difficulty === 'easy') {
      correctCount = roll < 75 ? 3 : 2;
    } else if (difficulty === 'medium') {
      correctCount = roll < 50 ? 2 : (roll < 85 ? 3 : 1);
    } else { // hard
      correctCount = roll < 60 ? 1 : 2;
    }
    
    const options = [];
    const usedSongs = new Set();
    
    // Get correct answers from radioPlaylist (pre-filtered from profile)
    const availableCorrect = gameState.state.radioPlaylist.filter(s => 
      !gameState.state.guessedTracks.has(`${s.artists.join(', ')}-${s.track_name}`) && 
      s.track_id !== gameState.state.seed.track_id
    );
    const shuffledCorrect = [...availableCorrect].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < Math.min(correctCount, shuffledCorrect.length); i++) {
      const track = shuffledCorrect[i];
      options.push({ ...track, isCorrect: true });
      usedSongs.add(track.track_id);
    }
    
    // Get wrong answers from profile pool
    const wrongCount = 4 - options.length;
    if (wrongCount > 0 && loadedProfile) {
      const pool = loadedProfile.pools[difficulty] || loadedProfile.pools.medium || [];
      const wrongTracks = pool.filter(t => 
        t.correct === false &&
        !usedSongs.has(t.id) &&
        t.id !== gameState.state.seed.track_id &&
        !gameState.state.guessedTracks.has(`${t.artists.join(', ')}-${t.name}`)
      );
      
      const shuffledWrong = wrongTracks.sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < Math.min(wrongCount, shuffledWrong.length); i++) {
        const track = shuffledWrong[i];
        options.push({
          track_id: track.id,
          artists: track.artists,
          track_name: track.name,
          ...track,
          isCorrect: false
        });
      }
    }
    
    gameState.setMultipleChoice(options.sort(() => Math.random() - 0.5));
  };

  const handleTextInput = (e) => {
    // TEXT SEARCH DISABLED - needs to be updated to use loadedProfile.pools instead of allSongs
    // const value = e.target.value;
    // setTextInput(value);
    // ... rest of search logic
    return;
  };

  const generateFeedback = (song, seed) => {
    // Use the profile's pre-computed similarity scores for rich feedback
    const feedback = [];
    
    // Check audio similarity
    if (song.audio_sim !== undefined && song.audio_sim < 0.7) {
      feedback.push(`Low audio similarity (${(song.audio_sim * 100).toFixed(0)}% vs seed)`);
    }
    
    // Check genre similarity  
    if (song.genre_sim !== undefined && song.genre_sim < 0.5) {
      feedback.push(`Different genres (${(song.genre_sim * 100).toFixed(0)}% overlap)`);
    }
    
    // Check era distance
    if (song.era_dist !== undefined && song.era_dist > 10) {
      feedback.push(`Different era (${song.era_dist} years apart)`);
    }
    
    // Check tier - higher tiers are less similar
    if (song.tier !== undefined && song.tier >= 4) {
      feedback.push(`Very different vibe (tier ${song.tier})`);
    }
    
    // If no specific feedback, use generic message
    if (feedback.length === 0) {
      feedback.push('Doesn\'t fit the radio station\'s vibe');
    }
    
    return feedback;
  };

  const handleGuess = (song) => {
    console.log('handleGuess called with:', song);
    
    if (!song || !song.artists || !song.track_name) {
      setErrorMessage('Invalid song data.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    
    const trackKey = `${song.artists.join(', ')}-${song.track_name}`;
    
    if (gameState.state.guessedTracks.has(trackKey)) {
      setErrorMessage('You already guessed this song.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    
    if (song.track_id === gameState.state.seed.track_id) {
      setErrorMessage('You can\'t guess the seed song!');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    
    // Use profile's correct flag - this is pre-computed and definitive
    const isCorrect = song.correct === true || song.isCorrect === true;
    
    console.log('Is correct?', isCorrect, '(correct:', song.correct, 'isCorrect:', song.isCorrect, ')');
    
    if (!isCorrect) {
      // Wrong answer - use profile similarity data for feedback
      const feedback = generateFeedback(song, gameState.state.seed);
      
      gameState.addGuess({
        id: Date.now(),
        artist: song.artists.join(', '),
        song: song.track_name,
        incorrect: true,
        feedback,
      }, trackKey);
    } else {
      // Correct answer - calculate points
      const basePoints = 10; // Base points for correct guess
      const challengeScores = gameState.state.challenges.map(c => 
        c && c.check(song, gameState.state.seed) ? Math.random() * 100 : 0
      );
      
      const newGuess = {
        id: Date.now(),
        artist: song.artists.join(', '),
        song: song.track_name,
        basePoints,
        challengeScores,
        incorrect: false,
      };
      
      gameState.addGuess(newGuess, trackKey);
      autoAssignChallenges([...gameState.state.guesses, newGuess]);
    }
    
    setTextInput('');
    setTextMatchedSong(null);
    generateMultipleChoice();
  };

  const autoAssignChallenges = (currentGuesses) => {
    const newPlacements = [null, null, null];
    const assignedGuesses = new Set();
    
    const candidatePairs = [];
    gameState.state.challenges.forEach((challenge, challengeIdx) => {
      if (!challenge) return;
      currentGuesses.forEach(guess => {
        if (guess.incorrect) return;
        const score = guess.challengeScores[challengeIdx];
        if (score >= 25) {
          candidatePairs.push({ challengeIdx, guessId: guess.id, score });
        }
      });
    });
    
    candidatePairs.sort((a, b) => b.score - a.score);
    candidatePairs.forEach(pair => {
      if (newPlacements[pair.challengeIdx] === null && !assignedGuesses.has(pair.guessId)) {
        newPlacements[pair.challengeIdx] = pair.guessId;
        assignedGuesses.add(pair.guessId);
      }
    });
    
    gameState.setChallengePlacements(newPlacements);
  };

  const getHint = (challengeIndex) => {
    const challenge = gameState.state.challenges[challengeIndex];
    if (!challenge || !gameState.state.seed) return;

    const matches = gameState.state.radioPlaylist
      .filter(song => challenge.check(song, gameState.state.seed))
      .slice(0, 3);
    
    if (matches.length === 0) {
      alert(`No examples found in the playlist for "${challenge.name}"`);
      return;
    }
    
    const hint = matches.map(s => `${s.artists.join(', ')} - ${s.track_name}`).join('\n');
    alert(`Examples for "${challenge.name}":\n\n${hint}`);
    
    gameState.useHint(challengeIndex);
  };

  const handleTasteBuilderPick = (genre) => {
    const newPath = [...tasteBuilderPath, genre];
    setTasteBuilderPath(newPath);
    
    if (tasteBuilderRound >= 5) {
      const profile = buildProfileFromPath(newPath);
      setTasteProfile(profile);
      setPhase('profile-summary');
    } else {
      setTasteBuilderRound(tasteBuilderRound + 1);
    }
  };

  // Phase rendering
  if (phase === 'constellation') {
    return <GenreConstellationSelect onLaunch={handleConstellationLaunch} />;
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-4">Oops! Something Went Wrong</h1>
          <p className="text-zinc-400 mb-2">{profileLoadError}</p>
          <p className="text-zinc-500 text-sm mb-8">
            This profile might be corrupted or missing required data.
          </p>
          <button
            onClick={() => {
              setProfileLoadError(null);
              setPhase('constellation');
            }}
            className="px-8 py-3 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400 transition"
          >
            Back to Genre Select
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'profile-select') {
    return (
      <ProfileSelect
        onSelectProfile={(profile) => {
          setTasteProfile(profile);
          setPhase('loading');
        }}
        onStartTasteBuilder={() => setPhase('taste-builder')}
        authError={authError}
        spotifyToken={spotifyToken}
      />
    );
  }

  if (phase === 'taste-builder') {
    return (
      <TasteBuilder
        round={tasteBuilderRound}
        path={tasteBuilderPath}
        onPick={handleTasteBuilderPick}
      />
    );
  }

  if (phase === 'profile-summary') {
    return (
      <ProfileSummary
        profile={tasteProfile}
        onStart={() => setPhase('loading')}
      />
    );
  }

  if (phase === 'loading') {
    const seedName = gameState.state.seed?.track_name || 'profile';
    const seedArtist = gameState.state.seed?.artists?.join(', ') || '';
    
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-green-500 mx-auto mb-6"></div>
          <p className="text-white text-xl font-bold mb-2">Loading {seedName}</p>
          {seedArtist && <p className="text-zinc-400">by {seedArtist}</p>}
        </div>
      </div>
    );
  }

  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-black p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-4 text-center">Radio Puzzle</h1>
          {tasteProfile?.descriptor && (
            <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 mb-6">
              <p className="text-green-300 text-sm text-center">
                ✓ Playing as: {tasteProfile.descriptor}
              </p>
            </div>
          )}
          <button
            onClick={() => setPhase('draft')}
            className="w-full bg-green-500 text-black py-4 rounded-full font-bold text-lg hover:bg-green-400 transition mb-6"
          >
            Start New Puzzle
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'draft') {
    const seedIsLocked = localStorage.getItem('seedIsLocked') === 'true';
    
    return (
      <DraftPhase
        seed={gameState.state.seed}
        challenges={gameState.state.challenges}
        currentChoice={currentChoice}
        removeMode={removeMode}
        seedIsLocked={seedIsLocked}
        onSelectCard={selectCard}
        onRemoveSlot={removeSlot}
      />
    );
  }

  if (phase === 'guess') {
    return (
      <GuessPhase
        seed={gameState.state.seed}
        seedHints={gameState.state.seedHints}
        revealedHints={gameState.state.revealedHints}
        challenges={gameState.state.challenges}
        challengePlacements={gameState.state.challengePlacements}
        multipleChoiceOptions={gameState.state.multipleChoiceOptions}
        textInput=""
        textMatchedSong={null}
        errorMessage={errorMessage}
        guesses={gameState.state.guesses}
        guessesLeft={guessesLeft}
        debugMode={DEBUG_MODE}
        onRevealHint={(idx) => gameState.revealHint(idx)}
        onGetHint={getHint}
        onGuess={handleGuess}
        onRefreshCandidates={generateMultipleChoice}
        onTextInput={() => {}} // TEXT SEARCH DISABLED
        onSeeScore={() => setPhase('score')}
      />
    );
  }

  if (phase === 'score') {
    return (
      <ScorePhase
        guesses={gameState.state.guesses}
        challengePlacements={gameState.state.challengePlacements}
        challenges={gameState.state.challenges}
        onPlayAgain={() => {
          // Clear all game state
          gameState.resetGame();
          setSelectedTracks([]);
          setLoadedProfile(null);
          setDifficulty('medium');
          setCurrentChoice(null);
          setRemoveMode(false);
          setErrorMessage('');
          setProfileLoadError(null);
          
          // Clear localStorage flags
          localStorage.removeItem('seedIsLocked');
          
          // Return to constellation
          setPhase('constellation');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black p-8 flex items-center justify-center text-white">
      Loading...
    </div>
  );
}


export default RadioPuzzleGame;