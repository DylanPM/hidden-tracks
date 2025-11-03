import React, { useState, useEffect, useRef } from 'react';
import { useGameState } from './hooks/useGameState';
import { GenreConstellationSelect } from './components/game/GenreConstellationSelect';
import { DraftPhase } from './components/game/DraftPhase';
import { GuessPhase } from './components/game/GuessPhase';
import { ScorePhase } from './components/game/ScorePhase';
import { generateSeedHints } from './utils/gameUtils';
import { CHALLENGES } from './constants/gameConfig';

const DEMO_MODE = true;
const DEBUG_MODE = false;

// ============================================================================
// HELPER FUNCTIONS - Single source of truth for track handling
// ============================================================================

const makeTrackKey = (track) => {
  if (!track) return '';
  const artistStr = Array.isArray(track.artists)
    ? track.artists.join(', ')
    : track.artists || 'Unknown';
  const name = track.name || 'Unknown';
  return `${artistStr}-${name}`;
};

const getArtistString = (track) => {
  if (!track || !track.artists) return 'Unknown Artist';
  return Array.isArray(track.artists)
    ? track.artists.join(', ')
    : track.artists;
};

const transformSeed = (profileSeed) => ({
  id: profileSeed.id,
  name: profileSeed.name,
  artists: profileSeed.artists,
  year: profileSeed.year,
  popularity: profileSeed.popularity,
  genres: profileSeed.genres || [],
  danceability: profileSeed.danceability,
  energy: profileSeed.energy,
  valence: profileSeed.valence,
  acousticness: profileSeed.acousticness,
  instrumentalness: profileSeed.instrumentalness,
  liveness: profileSeed.liveness,
  speechiness: profileSeed.speechiness,
  tempo: profileSeed.tempo,
  loudness: profileSeed.loudness,
  mode: profileSeed.mode,
  key: profileSeed.key,
  time_signature: profileSeed.time_signature
});

const transformTrack = (profileTrack) => ({
  id: profileTrack.id,
  name: profileTrack.name,
  artists: profileTrack.artists,
  correct: profileTrack.correct === true,
  year: profileTrack.year,
  popularity: profileTrack.popularity,
  genres: profileTrack.genres || [],
  danceability: profileTrack.danceability,
  energy: profileTrack.energy,
  valence: profileTrack.valence,
  acousticness: profileTrack.acousticness,
  instrumentalness: profileTrack.instrumentalness,
  liveness: profileTrack.liveness,
  speechiness: profileTrack.speechiness,
  tempo: profileTrack.tempo,
  loudness: profileTrack.loudness,
  mode: profileTrack.mode,
  key: profileTrack.key,
  time_signature: profileTrack.time_signature,
  audio_sim: profileTrack.audio_sim,
  genre_sim: profileTrack.genre_sim,
  era_dist: profileTrack.era_dist,
  era_sim: profileTrack.era_sim,
  pop_dist: profileTrack.pop_dist,
  pop_sim: profileTrack.pop_sim,
  genre_factor: profileTrack.genre_factor,
  composite_raw: profileTrack.composite_raw,
  radio_fit: profileTrack.radio_fit,
  tier: profileTrack.tier
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function RadioPuzzleGame() {
  const [phase, setPhase] = useState('constellation');

  // Constellation/Draft state
  const [selectedTracks, setSelectedTracks] = useState([]);
  const [difficulty, setDifficulty] = useState('medium');
  const [loadedProfile, setLoadedProfile] = useState(null);
  const profileLoadingRef = useRef(false);

  // Game settings
  const [maxGuesses, setMaxGuesses] = useState(6);
  
  // Game over state
  const [gameOver, setGameOver] = useState(false);

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

  // Generate choices during draft, generate options during guess
  useEffect(() => {
    if (phase === 'draft') {
      if (selectedTracks.length === 1 && !gameState.state.seed) {
        const track = selectedTracks[0];
        gameState.setSeed(track);
      }
      
      if (!currentChoice && !removeMode) {
        generateChoice();
      }
    }
    
    if (phase === 'guess' && 
        gameState.state.multipleChoiceOptions.length === 0 && 
        loadedProfile) {
      generateMultipleChoice();
    }
  }, [phase, currentChoice, removeMode, selectedTracks.length]);

  // ============================================================================
  // CONSTELLATION PHASE
  // ============================================================================

  const handleConstellationLaunch = (tracks, selectedDifficulty) => {
    console.log('🎨 Constellation launch');

    const convertedTracks = tracks.map(track => ({
      id: track.uri,
      name: track.name,
      artists: Array.isArray(track.artist) ? track.artist : [track.artist],
      filename: track.filename
    }));

    setDifficulty(selectedDifficulty);

    // Auto-assign seed and challenges
    const randomSeed = convertedTracks[Math.floor(Math.random() * convertedTracks.length)];
    const randomChallenges = [...CHALLENGES]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    gameState.setSeed(randomSeed);
    randomChallenges.forEach((challenge, idx) => {
      gameState.setChallenge(idx, challenge);
    });

    // Go straight to loading
    loadProfileForSeed(randomSeed);
  };

  // ============================================================================
  // PROFILE LOADING
  // ============================================================================

  const loadProfileForSeed = async (seed) => {
    if (!seed || !seed.filename) {
      console.error('❌ No filename on seed:', seed);
      return;
    }
    
    if (profileLoadingRef.current) {
      console.log('⏭️ Profile already loading, ignoring duplicate request');
      return;
    }
    
    try {
      profileLoadingRef.current = true;
      setPhase('loading');
      
      console.log('📂 Loading profile:', seed.filename);
      
      const response = await fetch(`/profiles/${seed.filename}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const rawProfile = await response.json();
      console.log('✅ Profile JSON loaded');
      
      if (!rawProfile?.seed || !rawProfile?.tracks?.length) {
        throw new Error('Invalid profile structure');
      }

      // Transform once into game format
      const gameSeed = transformSeed(rawProfile.seed);
      const gameTracks = rawProfile.tracks.map(transformTrack);

      const correctCount = gameTracks.filter(t => t.correct).length;
      const incorrectCount = gameTracks.filter(t => !t.correct).length;

      console.log('🎯 Profile ready:', {
        seed: `${gameSeed.name} by ${gameSeed.artists.join(', ')}`,
        tracks: gameTracks.length,
        correct: correctCount,
        incorrect: incorrectCount
      });

      if (correctCount < 10 || incorrectCount < 10) {
        throw new Error('Not enough tracks in profile');
      }

      setLoadedProfile({
        seed: gameSeed,
        tracks: gameTracks
      });
      
      gameState.setSeed(gameSeed);

      const hints = generateSeedHints(gameSeed);
      gameState.setSeedHints(hints);

      profileLoadingRef.current = false;
      setPhase('guess');
      
    } catch (error) {
      console.error('❌ Error loading profile:', error);
      profileLoadingRef.current = false;
      setProfileLoadError(error.message);
      setPhase('error');
    }
  };

  // ============================================================================
  // DRAFT PHASE
  // ============================================================================

  const generateChoice = () => {
    const needsSeed = !gameState.state.seed;
    const needsChallenges = gameState.state.challenges.filter(c => c !== null).length < 3;

    if (!needsSeed && !needsChallenges) {
      loadProfileForSeed(gameState.state.seed);
      return;
    }

    const cardTypes = [];
    const canOfferSongCards = selectedTracks.length > 1 || !gameState.state.seed;
    const seedIsLocked = selectedTracks.length === 1 && gameState.state.seed;
    
    if (needsSeed && canOfferSongCards) {
      cardTypes.push('song', 'song');
    }
    if (needsChallenges) {
      cardTypes.push('challenge', 'challenge');
    }
    if (!seedIsLocked && (gameState.state.seed || gameState.state.challenges.some(c => c !== null))) {
      cardTypes.push('remove');
    }
    
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
        const songsToUse = selectedTracks.filter(s => 
          s && s.artists && s.name && s.id !== gameState.state.seed?.id
        );
        
        if (songsToUse.length === 0) {
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
    if (option.type === 'song' && !gameState.state.seed) {
      if (!option.data || !option.data.artists || !option.data.name) {
        console.error('❌ Invalid song data in option:', option);
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

  // ============================================================================
  // GUESS PHASE
  // ============================================================================

  const generateMultipleChoice = () => {
    if (!loadedProfile?.tracks) {
      console.error('❌ No profile loaded');
      return;
    }

    const seed = gameState.state.seed;
    if (!seed) {
      console.error('❌ No seed set');
      return;
    }

    const availableTracks = loadedProfile.tracks.filter(track => {
      if (track.id === seed.id) return false;
      if (gameState.state.guessedTracks.has(makeTrackKey(track))) return false;
      return true;
    });

    const difficulty = gameState.state.tier || "medium";

// small helpers
const fyShuffle = (a) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const sampleN = (arr, n) => fyShuffle(arr).slice(0, Math.min(n, arr.length));

// tier based count of correct answers among 3
const pickK = (tier) => {
  const r = Math.random();
  if (tier === "easy")   return r < 0.70 ? 1 : r < 0.90 ? 2 : 0;
  if (tier === "hard")   return r < 0.40 ? 1 : r < 0.90 ? 2 : 0;
  return r < 0.60 ? 1 : r < 0.85 ? 2 : 0; // medium
};

// 1) limit to this difficulty pool
const pool = loadedProfile.tracks.filter(t => {
  if (!t?.id) return false;
  if (t.id === seed.id) return false;
  if (gameState.state.guessedTracks.has(makeTrackKey(t))) return false;
  return Array.isArray(t.pools) && t.pools.includes(difficulty);
});

if (pool.length === 0) {
  console.error("❌ Empty pool for difficulty");
  return;
}

// 2) correctness and decoy buckets by tier
const isCorrect = (t) => t.correct === true || t.tier === 1;

const correctPool = pool.filter(isCorrect);

let wrongPool;
if (difficulty === "easy") {
  // obvious wrongs: tiers 4 or 5, prefer low radio_fit
  wrongPool = pool
    .filter(t => !isCorrect(t) && (t.tier === 4 || t.tier === 5))
    .sort((a, b) => (a.radio_fit ?? 0) - (b.radio_fit ?? 0));
} else if (difficulty === "hard") {
  // near misses: tier 2, fill with 5, prefer high radio_fit
  const near = pool.filter(t => !isCorrect(t) && t.tier === 2);
  const filler = pool.filter(t => !isCorrect(t) && t.tier === 5);
  wrongPool = near.concat(filler).sort((a, b) => (b.radio_fit ?? 0) - (a.radio_fit ?? 0));
} else {
  // medium mixes 2, 3, 5
  wrongPool = pool.filter(t => !isCorrect(t) && (t.tier === 2 || t.tier === 3 || t.tier === 5));
}

// 3) choose k correct and fill to 3
let k = Math.min(pickK(difficulty), 3, correctPool.length);
let needWrong = 3 - k;
if (wrongPool.length < needWrong) {
  const short = needWrong - wrongPool.length;
  k = Math.min(k + short, correctPool.length, 3);
  needWrong = 3 - k;
}

let picks = [
  ...sampleN(correctPool, k),
  ...sampleN(wrongPool, needWrong)
];

if (picks.length < 3) {
  const remaining = pool.filter(t => !picks.includes(t));
  picks = picks.concat(sampleN(remaining, 3 - picks.length));
}

// 4) set the three choices
gameState.setMultipleChoice(fyShuffle(picks));
  };

  //   const correctTracks = availableTracks.filter(t => t.correct);
  //   const incorrectTracks = availableTracks.filter(t => !t.correct);

  //   // Weighted random: target 33% correct on average
  //   // More correct tracks in pool = higher chance of picking them
  //   const totalTracks = correctTracks.length + incorrectTracks.length;
  //   const correctRatio = correctTracks.length / totalTracks;
    
  //   // Pick 3 tracks with ~33% chance each is correct
  //   const picked = [];
  //   const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
    
  //   for (let i = 0; i < 3; i++) {
  //     const useCorrect = Math.random() < correctRatio * 0.33 / (1 - correctRatio);
  //     if (useCorrect && correctTracks.length > 0) {
  //       const track = shuffle(correctTracks)[0];
  //       picked.push(track);
  //       correctTracks.splice(correctTracks.indexOf(track), 1);
  //     } else if (incorrectTracks.length > 0) {
  //       const track = shuffle(incorrectTracks)[0];
  //       picked.push(track);
  //       incorrectTracks.splice(incorrectTracks.indexOf(track), 1);
  //     }
  //   }

  //   gameState.setMultipleChoice(shuffle(picked));
  // };

  // const generateFeedback = (song, seed) => {
  //   const feedback = [];
    
  //   // Check audio similarity
  //   if (song.audio_sim !== undefined && song.audio_sim < 0.7) {
  //     feedback.push(`Low audio similarity (${(song.audio_sim * 100).toFixed(0)}% vs seed)`);
  //   }
    
  //   // Genre similarity - commented out 0% issue
  //   // if (song.genre_sim !== undefined && song.genre_sim < 0.5) {
  //   //   feedback.push(`Different genres (${(song.genre_sim * 100).toFixed(0)}% overlap)`);
  //   // }
    
  //   // Check era distance
  //   if (song.era_dist !== undefined && song.era_dist > 10) {
  //     feedback.push(`Different era (${song.era_dist} years apart)`);
  //   }
    
  //   // Tier feedback - commented out (not about vibe, just difficulty sorting)
  //   // if (song.tier !== undefined && song.tier >= 4) {
  //   //   feedback.push(`Very different vibe (tier ${song.tier})`);
  //   // }
    
  //   // If no specific feedback, use generic message
  //   if (feedback.length === 0) {
  //     feedback.push('Doesn\'t fit the radio station\'s vibe');
  //   }
    
  //   return feedback;
  // };

  const handleGuess = (song) => {
    if (!song?.artists || !song?.name) {
      setErrorMessage('Invalid song data');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    const seed = gameState.state.seed;
    if (!seed) {
      setErrorMessage('Game not initialized');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    const trackKey = makeTrackKey(song);
    const artistStr = getArtistString(song);

    if (gameState.state.guessedTracks.has(trackKey)) {
      setErrorMessage('You already guessed this song');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    if (song.id === seed.id) {
      setErrorMessage("You can't guess the seed song!");
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    const isCorrect = song.correct === true;

    if (!isCorrect) {
      const feedback = generateFeedback(song, seed);

      gameState.addGuess({
        id: Date.now(),
        artist: artistStr,
        song: song.name,
        incorrect: true,
        feedback,
        trackData: song // Store full track for clue generation
      }, trackKey);

    } else {
      const challengeScores = gameState.state.challenges.map(c =>
        c && c.check(song, seed) ? Math.random() * 100 : 0
      );

      const newGuess = {
        id: Date.now(),
        artist: artistStr,
        song: song.name,
        basePoints: 10,
        challengeScores,
        incorrect: false,
        trackData: song // Store full track for clue generation
      };

      gameState.addGuess(newGuess, trackKey);
      autoAssignChallenges([...gameState.state.guesses, newGuess]);
    }

    generateMultipleChoice();
    
    // Scroll to playlist to show result, then back to top
    setTimeout(() => {
      const playlistSection = document.querySelector('[data-playlist-section]');
      if (playlistSection) {
        playlistSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 2000);
      }
    }, 100);
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

    const correctTracks = loadedProfile.tracks.filter(t => t.correct === true);
    const matches = correctTracks
      .filter(song => challenge.check(song, gameState.state.seed))
      .slice(0, 3);

    if (matches.length === 0) {
      alert(`No examples found for "${challenge.name}"`);
      return;
    }

    const hint = matches.map(s => 
      `${getArtistString(s)} - ${s.name}`
    ).join('\n');
    
    alert(`Examples for "${challenge.name}":\n\n${hint}`);
    gameState.useHint(challengeIndex);
  };

  // ============================================================================
  // PHASE RENDERING
  // ============================================================================

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

  if (phase === 'loading') {
    const seedName = gameState.state.seed?.name || 'profile';
    const seedArtist = getArtistString(gameState.state.seed);

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-green-500 mx-auto mb-6"></div>
          <p className="text-white text-xl font-bold mb-2">Loading {seedName}</p>
          <p className="text-zinc-400">by {seedArtist}</p>
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
        maxGuesses={maxGuesses}
        debugMode={DEBUG_MODE}
        onRevealHint={(idx) => gameState.revealHint(idx)}
        onGetHint={getHint}
        onGuess={handleGuess}
        onRefreshCandidates={generateMultipleChoice}
        onTextInput={() => {}}
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
          gameState.setMultipleChoice([]);
          setSelectedTracks([]);
          setLoadedProfile(null);
          setDifficulty('medium');
          setCurrentChoice(null);
          setRemoveMode(false);
          setErrorMessage('');
          setProfileLoadError(null);
          localStorage.removeItem('seedIsLocked');
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
