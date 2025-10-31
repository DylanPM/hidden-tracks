import React, { useState, useEffect } from 'react';
import { useGameState } from './hooks/useGameState';
import { GenreConstellationSelect } from './components/game/GenreConstellationSelect';
import { DraftPhase } from './components/game/DraftPhase';
import { GuessPhase } from './components/game/GuessPhase';
import { ScorePhase } from './components/game/ScorePhase';
import { generateSeedHints } from './utils/gameUtils';
import { CHALLENGES } from './constants/gameConfig';

const DEMO_MODE = true;
const DEBUG_MODE = true; // Set to false to disable debug view

function RadioPuzzleGame() {
  const [phase, setPhase] = useState('constellation');

  // Constellation/Draft state
  const [selectedTracks, setSelectedTracks] = useState([]);
  const [difficulty, setDifficulty] = useState('medium');
  const [loadedProfile, setLoadedProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Game settings
  const [maxGuesses, setMaxGuesses] = useState(6);

  // UI state
  const [currentChoice, setCurrentChoice] = useState(null);
  const [removeMode, setRemoveMode] = useState(false);
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


// NEW: Handle constellation launch
const handleConstellationLaunch = (tracks, selectedDifficulty) => {
  console.log('Constellation launch:', { tracks, selectedDifficulty });

  // Convert constellation format to game format - profiles are source of truth
  const convertedTracks = tracks.map(track => ({
    track_id: track.uri,
    track_name: track.name,
    artists: track.artist, // Use as-is from constellation
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
    
    // Profile already contains ALL candidate tracks for this seed
    // Each track has a 'correct' flag - no need to filter by pools or calculate anything

    const allTracks = profile.tracks;
    const correctTracks = allTracks.filter(t => t.correct === true);
    const incorrectTracks = allTracks.filter(t => t.correct === false);

    console.log('✅ Profile loaded:', {
      totalTracks: allTracks.length,
      correct: correctTracks.length,
      incorrect: incorrectTracks.length
    });

    // VALIDATION: Check we have enough tracks
    if (correctTracks.length < 10) {
      throw new Error(`Not enough correct tracks (found ${correctTracks.length}, need 10+)`);
    }
    if (incorrectTracks.length < 10) {
      throw new Error(`Not enough incorrect tracks (found ${incorrectTracks.length}, need 10+)`);
    }

    // Store the profile - generateMultipleChoice will use profile.tracks directly
    setLoadedProfile(profile);

    // Use the profile's seed data (has full audio features) - use as-is
    const fullSeed = {
      track_id: profile.seed.id,
      artists: profile.seed.artists, // Already clean from profile
      track_name: profile.seed.name,
      ...profile.seed // includes all audio features
    };

    gameState.setSeed(fullSeed);

    // Generate seed hints
    const hints = generateSeedHints(fullSeed);
    gameState.setSeedHints(hints);

    // NOTE: We don't need radioPlaylist anymore - generateMultipleChoice uses profile.tracks directly
    gameState.setRadioPlaylist([]); // Keep for backwards compatibility but unused
    
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

  const generateMultipleChoice = () => {
    if (!loadedProfile || !loadedProfile.tracks) {
      console.error('No profile loaded');
      return;
    }

    // Helper to create track key from artists array
    const makeTrackKey = (artists, name) => {
      const artistStr = Array.isArray(artists) ? artists.join(', ') : artists;
      return `${artistStr}-${name}`;
    };

    // Use ALL tracks from profile - they're already curated for this seed
    const allTracks = loadedProfile.tracks;

    // Filter out already guessed tracks and the seed
    const availableTracks = allTracks.filter(t =>
      t.id !== gameState.state.seed.track_id &&
      !gameState.state.guessedTracks.has(makeTrackKey(t.artists, t.name))
    );

    // Split into correct and incorrect based on profile's pre-computed flags
    const correctTracks = availableTracks.filter(t => t.correct === true);
    const incorrectTracks = availableTracks.filter(t => t.correct === false);

    console.log('🔍 Generating options from profile tracks:', {
      totalAvailable: availableTracks.length,
      correct: correctTracks.length,
      incorrect: incorrectTracks.length
    });

    // Determine mix based on difficulty
    let correctCount;
    const roll = Math.random() * 100;
    if (difficulty === 'easy') {
      correctCount = roll < 75 ? 3 : 2;
    } else if (difficulty === 'medium') {
      correctCount = roll < 50 ? 2 : (roll < 85 ? 3 : 1);
    } else { // hard
      correctCount = roll < 60 ? 1 : 2;
    }

    const incorrectCount = 4 - correctCount;

    // Shuffle and pick
    const shuffledCorrect = [...correctTracks].sort(() => Math.random() - 0.5);
    const shuffledIncorrect = [...incorrectTracks].sort(() => Math.random() - 0.5);

    const options = [
      ...shuffledCorrect.slice(0, correctCount).map(t => ({
        track_id: t.id,
        track_name: t.name,
        artists: t.artists,
        ...t // Includes correct flag and all audio features
      })),
      ...shuffledIncorrect.slice(0, incorrectCount).map(t => ({
        track_id: t.id,
        track_name: t.name,
        artists: t.artists,
        ...t // Includes correct flag and all audio features
      }))
    ];

    // Final shuffle so correct/incorrect aren't grouped
    gameState.setMultipleChoice(options.sort(() => Math.random() - 0.5));
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

    // Create track key handling both array and string artists
    const artistStr = Array.isArray(song.artists) ? song.artists.join(', ') : song.artists;
    const trackKey = `${artistStr}-${song.track_name}`;

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
        artist: artistStr, // Already clean from profile
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
        artist: artistStr, // Already clean from profile
        song: song.track_name,
        basePoints,
        challengeScores,
        incorrect: false,
      };

      gameState.addGuess(newGuess, trackKey);
      autoAssignChallenges([...gameState.state.guesses, newGuess]);
    }

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
    if (!challenge || !gameState.state.seed || !loadedProfile) return;

    // Use correct tracks from profile to find examples
    const correctTracks = loadedProfile.tracks.filter(t => t.correct === true);
    const matches = correctTracks
      .filter(song => challenge.check(song, gameState.state.seed))
      .slice(0, 3);

    if (matches.length === 0) {
      alert(`No examples found for "${challenge.name}"`);
      return;
    }

    const hint = matches.map(s => {
      const artistStr = Array.isArray(s.artists) ? s.artists.join(', ') : s.artists;
      return `${artistStr} - ${s.name || s.track_name}`;
    }).join('\n');
    alert(`Examples for "${challenge.name}":\n\n${hint}`);

    gameState.useHint(challengeIndex);
  };

  // OLD: TasteBuilder not used in DEMO_MODE
  // const handleTasteBuilderPick = (genre) => { ... }

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

  // OLD: Profile select/TasteBuilder phases not used in DEMO_MODE
  // if (phase === 'profile-select') { ... }
  // if (phase === 'taste-builder') { ... }
  // if (phase === 'profile-summary') { ... }

  if (phase === 'loading') {
    const seedName = gameState.state.seed?.track_name || 'profile';
    const seedArtists = gameState.state.seed?.artists || '';
    const seedArtist = Array.isArray(seedArtists) ? seedArtists.join(', ') : seedArtists;

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

  // OLD: Setup phase not used in DEMO_MODE
  // if (phase === 'setup') { ... }

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