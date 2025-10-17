import React, { useState, useEffect } from 'react';
import { useGameState } from './hooks/useGameState';
import { ProfileSelect } from './components/profile/ProfileSelect';
import { TasteBuilder, buildProfileFromPath } from './components/profile/TasteBuilder';
import { ProfileSummary } from './components/profile/ProfileSummary';
//there used to be draft phase guess phase and scaore phase here with { } but moved when cluade added new handlers i tihnk
import { calculateSimilarity, fuzzyMatch, generateSeedHints, loadSpotifyDataset } from './utils/gameUtils';
import { buildSpotifyProfile } from './utils/trackUtils';
import { CHALLENGES } from './constants/gameConfig';
import DraftPhase from './components/game/DraftPhase';
import GuessPhase from './components/game/GuessPhase';
import ScorePhase from './components/game/ScorePhase';

function RadioPuzzleGame() {
  const [phase, setPhase] = useState('auth-check');
  const [spotifyToken, setSpotifyToken] = useState(null);
  const [allSongs, setAllSongs] = useState([]);
  const [tasteProfile, setTasteProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  
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

  const handleRevealHint = (index) => {
  const newRevealed = [...revealedHints];
  newRevealed[index] = true;
  setRevealedHints(newRevealed);
};

const handleRefreshCandidates = () => {
  setGuessesLeft(prev => Math.max(0, prev - 1));
  generateMultipleChoice();
};

const handleSeeScore = () => {
  setPhase('score');
};

const handleRemoveSlot = (slotId) => {
  if (slotId === null) {
    setRemoveMode(!removeMode);
  } else if (slotId === 'seed') {
    removeSeed();
    setRemoveMode(false);
  } else if (slotId?.startsWith('challenge')) {
    const idx = parseInt(slotId.split('-')[1]);
    removeChallenge(idx);
    if (challenges.filter(c => c !== null).length === 0) setRemoveMode(false);
  }
};
  
  
  //todo: hints are too simple now, get more variety pre-baked

  // Seed Hints
const generateSeedHints = (seedSong) => {
  // Hint 1: Emotional descriptor based on valence
  let mood = '';
  if (seedSong.valence > 0.7) {
    mood = 'upbeat, feel-good energy';
  } else if (seedSong.valence > 0.4) {
    mood = 'balanced emotional tone';
  } else {
    mood = 'introspective, moody atmosphere';
  }
  const hint1 = `Vibes: ${mood}`;

  // Hint 2: Genre and energy mix
  const intensity = seedSong.energy > 0.7 ? 'high-intensity' : seedSong.energy > 0.4 ? 'moderate' : 'laid-back';
  const hint2 = `${seedSong.track_genre} - ${intensity}`;

  // Hint 3: Descriptive mix
  let descriptor = '';
  if (seedSong.acousticness > 0.5) descriptor = 'organic, acoustic-leaning';
  else if (seedSong.danceability > 0.7) descriptor = 'highly danceable rhythms';
  else if (seedSong.instrumentalness > 0.3) descriptor = 'instrumental-focused';
  else descriptor = 'vocal-driven production';
  const hint3 = `Character: ${descriptor}`;

  return [hint1, hint2, hint3];
};

  // Check for Spotify auth on load
  useEffect(() => {
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

  // Load dataset when entering loading phase
  useEffect(() => {
    if (phase === 'loading' && allSongs.length === 0) {
      loadSpotifyDataset().then(songs => {
        setAllSongs(songs);
        setPhase('setup');
      });
    }
  }, [phase, allSongs.length]);

  // Generate choice when in draft phase
  useEffect(() => {
    if (phase === 'draft' && !currentChoice && !removeMode) {
      generateChoice();
    } else if (phase === 'guess' && gameState.state.multipleChoiceOptions.length === 0 && gameState.state.radioPlaylist.length > 0) {
      generateMultipleChoice();
    }
  }, [phase, currentChoice, removeMode, gameState.state.radioPlaylist.length, gameState.state.multipleChoiceOptions.length]);

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
      const playlist = generateRadioPlaylist(gameState.state.seed);
      gameState.setRadioPlaylist(playlist);
      const hints = generateSeedHints(gameState.state.seed);
      gameState.setSeedHints(hints);
      setPhase('guess');
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
      const songsToUse = allSongs.filter(s => 
        s && s.artists && typeof s.artists === 'string' && s.artists.trim() &&
        s.track_name && typeof s.track_name === 'string' && s.track_name.trim()
      );
      
      if (songsToUse.length === 0) {
        return { type: 'remove', data: null };
      }
      
      let filteredSongs = songsToUse;
      if (tasteProfile?.preferences) {
        const filtered = songsToUse.filter(s => {
          if (!s) return false;
          const prefs = tasteProfile.preferences;
          if (prefs.energy && (s.energy < prefs.energy[0] || s.energy > prefs.energy[1])) return false;
          if (prefs.valence && (s.valence < prefs.valence[0] || s.valence > prefs.valence[1])) return false;
          if (prefs.genres && prefs.genres.length > 0 && !prefs.genres.includes(s.track_genre)) return false;
          return true;
        });
        
        if (filtered.length >= 10) filteredSongs = filtered;
      }
      
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
    let correctCount;
    const roll = Math.random() * 100;
    
    if (difficultyLevel <= 3) {
      correctCount = roll < 85 ? (roll < 50 ? 4 : 3) : 2;
    } else if (difficultyLevel <= 7) {
      if (roll < 40) correctCount = 2;
      else if (roll < 75) correctCount = 3;
      else if (roll < 90) correctCount = 4;
      else correctCount = 1;
    } else {
      if (roll < 5) correctCount = 0;
      else if (roll < 50) correctCount = 1;
      else if (roll < 80) correctCount = 2;
      else correctCount = 3;
    }
    
    const options = [];
    const usedSongs = new Set();
    
    const availableCorrect = gameState.state.radioPlaylist.filter(s => 
      !gameState.state.guessedTracks.has(`${s.artists}-${s.track_name}`) && 
      s.track_id !== gameState.state.seed.track_id
    );
    const shuffledCorrect = [...availableCorrect].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < Math.min(correctCount, shuffledCorrect.length); i++) {
      options.push({ ...shuffledCorrect[i], isCorrect: true });
      usedSongs.add(shuffledCorrect[i].track_id);
    }
    
    const wrongCount = 4 - options.length;
    if (wrongCount > 0) {
      const songsToUse = allSongs.filter(s => 
        s && s.artists && typeof s.artists === 'string' && 
        s.track_name && typeof s.track_name === 'string'
      );
      
      const allAvailableSongs = songsToUse.filter(s => 
        !usedSongs.has(s.track_id) && 
        s.track_id !== gameState.state.seed.track_id &&
        !gameState.state.guessedTracks.has(`${s.artists}-${s.track_name}`)
      );
      
      const similarities = allAvailableSongs.map(song => ({
        song,
        similarity: calculateSimilarity(gameState.state.seed, song)
      })).sort((a, b) => b.similarity - a.similarity);
      
      const plausibleWrong = similarities.filter(s => s.similarity > 0.4 && s.similarity < 0.75);
      const shuffledWrong = plausibleWrong.sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < Math.min(wrongCount, shuffledWrong.length); i++) {
        options.push({ ...shuffledWrong[i].song, isCorrect: false });
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
      seed={seed}
      challenges={challenges}
      currentChoice={currentChoice}
      removeMode={removeMode}
      onSelectCard={selectCard}
      onRemoveSlot={handleRemoveSlot}
    />
  );
}

if (phase === 'guess') {
  return (
    <GuessPhase
      seed={seed}
      seedHints={seedHints}
      revealedHints={revealedHints}
      challenges={challenges}
      challengePlacements={challengePlacements}
      multipleChoiceOptions={multipleChoiceOptions}
      textInput={textInput}
      textMatchedSong={textMatchedSong}
      errorMessage={errorMessage}
      guesses={guesses}
      guessesLeft={guessesLeft}
      onRevealHint={handleRevealHint}
      onGetHint={handleGetHint}
      onGuess={handleGuess}
      onRefreshCandidates={handleRefreshCandidates}
      onTextInput={handleTextInput}
      onSeeScore={handleSeeScore}
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