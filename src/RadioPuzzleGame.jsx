import React, { useState, useEffect } from 'react';
import { useGameState } from './hooks/useGameState';
import { ProfileSelect } from './components/profile/ProfileSelect';
import { TasteBuilder, buildProfileFromPath } from './components/profile/TasteBuilder';
import { ProfileSummary } from './components/profile/ProfileSummary';
import { GenreConstellationSelect } from './components/game/GenreConstellationSelect';
import { DraftPhase } from './components/game/DraftPhase';
import { GuessPhase } from './components/game/GuessPhase';
import { ScorePhase } from './components/game/ScorePhase';
import { calculateSimilarity, fuzzyMatch, generateSeedHints, loadSpotifyDataset } from './utils/gameUtils';
import { buildSpotifyProfile } from './utils/trackUtils';
import { CHALLENGES } from './constants/gameConfig';
import { mapRows } from './utils/slimProfile';
import { profileTracksToGameTracks } from './utils/trackUtils';

const DEMO_MODE = true;

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
      const profile = buildSpotifyProfile(tracksData.items, featuresData.audio_features);
      
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

  // Load dataset when entering loading phase
useEffect(() => {
  if (phase === 'loading') {
    // For now, hardcode loading Stevie Wonder profile
    loadAndDecodeProfile('stevie-wonder');
  }
}, [phase]);

  //new function to load and decode profile starts here

  const loadAndDecodeProfile = async (profileFileName) => {
  try {
    setPhase('loading');
    
    // Fetch the profile JSON
    const response = await fetch(`/profiles/${profileFileName}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load profile: ${response.status}`);
    }
    
    const slimProfile = await response.json();
    
    // Decode all rows using slimProfile.js helper
    const decodedTracks = mapRows(slimProfile);
    
    // Convert to game format
    const gameTracks = profileTracksToGameTracks(decodedTracks);
    
    // First track is always the seed
    const seedSong = gameTracks[0];
    
    // Rest are the radio playlist (similar songs)
    const radioPlaylist = gameTracks.slice(1);
    
    // Set game state
    // setSeed(seedSong);
    // setRadioPlaylist(radioPlaylist);
    gameState.setSeed(seedSong);
    gameState.setRadioPlaylist(radioPlaylist);
    
    // Store all tracks for potential text search
    setAllSongs(gameTracks);
    
    console.log('Profile loaded:', {
      seed: seedSong.track_name,
      playlistSize: radioPlaylist.length,
      sampleTrack: radioPlaylist[0]
    });
    
    // Move to guess phase (skip draft since seed is pre-chosen)
    setPhase('guess');
    
  } catch (error) {
    console.error('Error loading profile:', error);
    setPhase('setup'); // Fallback to setup if load fails
  }
};

// NEW: Handle constellation launch
const handleConstellationLaunch = (tracks, selectedDifficulty) => {
  console.log('Constellation launch:', { tracks, selectedDifficulty });
  setSelectedTracks(tracks);
  setDifficulty(selectedDifficulty);
  
  // Go to draft phase - user will pick seed + challenges
  setPhase('draft');
};

// NEW: Load profile when draft is complete
const loadProfileForSeed = async (seed) => {
  if (!seed || !seed.filename) {
    console.error('No filename on seed:', seed);
    return;
  }
  
  try {
    setPhase('loading');
    console.log('Loading profile:', seed.filename);
    
    const response = await fetch(`/profiles/${seed.filename}`);
    if (!response.ok) {
      throw new Error(`Failed to load profile: ${response.status}`);
    }
    
    const profile = await response.json();
    console.log('Profile loaded:', profile);
    
    // Store the profile
    setLoadedProfile(profile);
    
    // Use the profile's seed data (has full audio features)
    const fullSeed = {
      track_id: profile.seed.id,
      artists: Array.isArray(profile.seed.artists) ? profile.seed.artists.join(', ') : profile.seed.artists,
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
    
    console.log(`Using ${difficulty} pool:`, correctTracks.length, 'correct tracks');
    
    // Convert to game format
    const radioPlaylist = correctTracks.map(t => ({
      track_id: t.id,
      artists: Array.isArray(t.artists) ? t.artists.join(', ') : t.artists,
      track_name: t.name,
      ...t // includes all audio features and correct flag
    }));
    
    gameState.setRadioPlaylist(radioPlaylist);
    
    // Move to guess phase
    setPhase('guess');
    
  } catch (error) {
    console.error('Error loading profile:', error);
    alert('Failed to load profile. Please try again.');
    setPhase('draft');
  }
};

//new function to load and decode profile ends here

  // Generate choice when in draft phase
  useEffect(() => {
    if (phase === 'draft') {
      // If only 1 track selected, auto-set as seed
      if (selectedTracks.length === 1 && !gameState.state.seed) {
        const track = selectedTracks[0];
        gameState.setSeed({
          track_id: track.uri, // Use URI as temporary ID
          artists: track.artist,
          track_name: track.name,
          filename: track.filename,
          ...track
        });
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
      s && s.artists && typeof s.artists === 'string' && s.track_name && typeof s.track_name === 'string'
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
    if (needsSeed) cardTypes.push('song', 'song');
    if (needsChallenges) cardTypes.push('challenge', 'challenge');
    if (gameState.state.seed || gameState.state.challenges.some(c => c !== null)) cardTypes.push('remove');

    const typeA = cardTypes[Math.floor(Math.random() * cardTypes.length)];
    let typeB = cardTypes[Math.floor(Math.random() * cardTypes.length)];
    while (typeA === 'remove' && typeB === 'remove') {
      typeB = cardTypes[Math.floor(Math.random() * cardTypes.length)];
    }

    const usedChallengeIds = gameState.state.challenges.filter(c => c !== null).map(c => c.id);
    const availableChallenges = CHALLENGES.filter(c => !usedChallengeIds.includes(c.id));

    const createCard = (type) => {
      // Use selectedTracks for song cards if available
      const songsToUse = selectedTracks.length > 0 
        ? selectedTracks 
        : allSongs.filter(s => 
            s && s.artists && typeof s.artists === 'string' && s.artists.trim() &&
            s.track_name && typeof s.track_name === 'string' && s.track_name.trim()
          );
      
      if (songsToUse.length === 0) {
        return { type: 'remove', data: null };
      }
      
      // For constellation mode, no filtering - just use the selected tracks
      const filteredSongs = songsToUse;
      
      if (type === 'song') {
        const song = filteredSongs[Math.floor(Math.random() * filteredSongs.length)];
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
    if (option.type === 'song' && !gameState.state.seed) {
      if (!option.data || !option.data.artists || !option.data.track_name) {
        console.error('Invalid song data in option:', option);
        setCurrentChoice(null);
        return;
      }
      gameState.setSeed(option.data);
      setCurrentChoice(null);
    } else if (option.type === 'challenge') {
      const emptySlot = gameState.state.challenges.findIndex(c => c === null);
      if (emptySlot !== -1) {
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
      !gameState.state.guessedTracks.has(`${s.artists}-${s.track_name}`) && 
      s.track_id !== gameState.state.seed.track_id
    );
    const shuffledCorrect = [...availableCorrect].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < Math.min(correctCount, shuffledCorrect.length); i++) {
      options.push({ ...shuffledCorrect[i], isCorrect: true });
      usedSongs.add(shuffledCorrect[i].track_id);
    }
    
    // Get wrong answers from profile pool
    const wrongCount = 4 - options.length;
    if (wrongCount > 0 && loadedProfile) {
      const pool = loadedProfile.pools[difficulty] || loadedProfile.pools.medium || [];
      const wrongTracks = pool.filter(t => 
        t.correct === false &&
        !usedSongs.has(t.id) &&
        t.id !== gameState.state.seed.track_id &&
        !gameState.state.guessedTracks.has(`${t.artists.join ? t.artists.join(', ') : t.artists}-${t.name}`)
      );
      
      const shuffledWrong = wrongTracks.sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < Math.min(wrongCount, shuffledWrong.length); i++) {
        const track = shuffledWrong[i];
        options.push({
          track_id: track.id,
          artists: Array.isArray(track.artists) ? track.artists.join(', ') : track.artists,
          track_name: track.name,
          ...track,
          isCorrect: false
        });
      }
    }
    
    gameState.setMultipleChoice(options.sort(() => Math.random() - 0.5));
  };

  const handleTextInput = (e) => {
    const value = e.target.value;
    setTextInput(value);
    
    if (value.length < 3) {
      setTextMatchedSong(null);
      return;
    }
    
    const songsToUse = allSongs.filter(s => 
      s && s.artists && typeof s.artists === 'string' && 
      s.track_name && typeof s.track_name === 'string'
    );
    
    const matched = songsToUse.find(s => 
      fuzzyMatch(value, s.artists) || fuzzyMatch(value, s.track_name)
    );
    
    setTextMatchedSong(matched || null);
  };

  const handleGuess = (song) => {
    if (!song || !song.artists || !song.track_name) {
      setErrorMessage('Invalid song data.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    
    const trackKey = `${song.artists}-${song.track_name}`;
    
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
    
    const onPlaylist = song.isCorrect !== undefined ? song.isCorrect : 
      gameState.state.radioPlaylist.some(s => s.track_id === song.track_id);
    
    if (!onPlaylist) {
      let feedback = [];
      if (song.track_genre !== gameState.state.seed.track_genre) {
        feedback.push(`Different genre (${song.track_genre} vs ${gameState.state.seed.track_genre})`);
      }
      const energyDiff = Math.abs(song.energy - gameState.state.seed.energy);
      if (energyDiff > 0.2) {
        feedback.push(song.energy > gameState.state.seed.energy ? 'Much higher energy' : 'Much lower energy');
      }
      if (feedback.length === 0) {
        feedback.push('Attributes don\'t align closely enough');
      }
      
      gameState.addGuess({
        id: Date.now(),
        artist: song.artists,
        song: song.track_name,
        incorrect: true,
        feedback,
      }, trackKey);
    } else {
      const isSameArtist = fuzzyMatch(song.artists, gameState.state.seed.artists);
      const basePoints = isSameArtist ? 0 : 2;
      const challengeScores = gameState.state.challenges.map(c => 
        c && c.check(song, gameState.state.seed) ? Math.random() * 100 : 0
      );
      
      const newGuess = {
        id: Date.now(),
        artist: song.artists,
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
    
    const hint = matches.map(s => `${s.artists} - ${s.track_name}`).join('\n');
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
    return (
      <div className="min-h-screen bg-black p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-white text-xl font-bold">Loading music library...</p>
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
    return (
      <DraftPhase
        seed={gameState.state.seed}
        challenges={gameState.state.challenges}
        currentChoice={currentChoice}
        removeMode={removeMode}
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
        textInput={textInput}
        textMatchedSong={textMatchedSong}
        errorMessage={errorMessage}
        guesses={gameState.state.guesses}
        guessesLeft={guessesLeft}
        onRevealHint={(idx) => gameState.revealHint(idx)}
        onGetHint={getHint}
        onGuess={handleGuess}
        onRefreshCandidates={generateMultipleChoice}
        onTextInput={handleTextInput}
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
          gameState.resetGame();
          setPhase('setup');
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