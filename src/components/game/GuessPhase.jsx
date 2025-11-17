import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search } from 'lucide-react';
import { HINT_POINTS, CHALLENGE_POINTS } from '../../constants/gameConfig';
import { TrackAttributes } from './TrackAttributes';
import { GuessFlair } from './GuessFlair';

// Version tracking
// GuessPhase v3.0 - Random attributes, improved scroll, intel fixes, challenge updates

// Grammar system for attribute reveal clues
const ATTRIBUTE_DESCRIPTIONS = {
  danceability: {
    low: {
      adjective: "laid-back",
      guidance: "have a relaxed groove, focus on feel over rhythm, or keep listeners seated"
    },
    mid: {
      adjective: "moderately danceable",
      guidance: "balance rhythm with melody, offer a comfortable groove, or let you sway along"
    },
    high: {
      adjective: "danceable",
      guidance: "make people move, have infectious rhythms, or get you out of your seat"
    }
  },
  energy: {
    low: {
      adjective: "calm",
      guidance: "create a mellow atmosphere, take it slow, or let you breathe"
    },
    mid: {
      adjective: "moderate energy",
      guidance: "maintain steady momentum, balance intensity with restraint, or keep things moving"
    },
    high: {
      adjective: "energetic",
      guidance: "go hard, bring intensity, or keep the adrenaline pumping"
    }
  },
  acousticness: {
    low: {
      adjective: "electronic",
      guidance: "lean on production, embrace synthetic textures, or prioritize the mix"
    },
    mid: {
      adjective: "balanced production",
      guidance: "blend organic and electronic elements, or mix live instruments with studio polish"
    },
    high: {
      adjective: "acoustic",
      guidance: "feature live instruments, embrace raw performance, or highlight organic sound"
    }
  },
  valence: {
    low: {
      adjective: "melancholy",
      guidance: "embrace darker moods, explore introspective themes, or sit in the shadows"
    },
    mid: {
      adjective: "bittersweet",
      guidance: "balance light and dark, blend hope with reflection, or walk the emotional middle"
    },
    high: {
      adjective: "upbeat",
      guidance: "radiate positivity, bring feel-good vibes, or lift the mood"
    }
  },
  tempo: {
    low: {
      adjective: "slow-tempo",
      guidance: "take their time, let moments breathe, or keep the pace relaxed"
    },
    mid: {
      adjective: "moderate tempo",
      guidance: "maintain a comfortable pace, balance urgency with ease, or keep a steady rhythm"
    },
    high: {
      adjective: "fast-tempo",
      guidance: "pick up the pace, bring urgency, or keep the energy high with quick rhythms"
    }
  },
  popularity: {
    low: {
      adjective: "niche",
      guidance: "explore deep cuts, feature lesser-known artists, or dig into the underground"
    },
    mid: {
      adjective: "moderately popular",
      guidance: "mix familiar and fresh, balance hits with discoveries, or span the mainstream-to-indie spectrum"
    },
    high: {
      adjective: "popular",
      guidance: "feature well-known tracks, lean toward mainstream appeal, or include familiar favorites"
    }
  }
};

export function GuessPhase({
  seed,
  seedHints,
  revealedHints,
  challenges,
  challengePlacements,
  multipleChoiceOptions,
  errorMessage,
  guesses,
  guessesLeft,
  maxGuesses,
  debugMode,
  onRevealHint,
  onGetHint,
  onGuess,
  onRefreshCandidates,
  onSeeScore
}) {
  // First-visit popup
  const [showInstructions, setShowInstructions] = useState(true);
  useEffect(() => {
    if (sessionStorage.getItem('ht_seen_guess_instructions') === '1') {
      setShowInstructions(false);
    }
  }, []);
  const dismissInstructions = () => {
    sessionStorage.setItem('ht_seen_guess_instructions', '1');
    setShowInstructions(false);
  };

  // Attribute hint system
  const [revealedAttributes, setRevealedAttributes] = useState({});
  const [revealClues, setRevealClues] = useState([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [pendingHintUse, setPendingHintUse] = useState(false);
  const maxHints = 3;

  // Flash animation for guess counter
  const [flashGuessCounter, setFlashGuessCounter] = useState(false);
  useEffect(() => {
    if (guesses.length > 0) {
      setFlashGuessCounter(true);
      const timer = setTimeout(() => setFlashGuessCounter(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [guesses.length]);

  // Refs for scroll targets
  const correctGuessesRef = useRef(null);
  const incorrectGuessesRef = useRef(null);
  const whatWeKnowRef = useRef(null);
  const guessOptionsRef = useRef(null);
  const [highlightClues, setHighlightClues] = useState(false);
  const [isAnimatingScroll, setIsAnimatingScroll] = useState(false);
  const scrollCancelRef = useRef(false);

  // Debug: Animation timing controls
  const [guessDwellTime, setGuessDwellTime] = useState(2500); // milliseconds
  const [intelDwellTime, setIntelDwellTime] = useState(2500); // milliseconds
  const [returnSpeed, setReturnSpeed] = useState(1200); // milliseconds for return to guess options
  const [showDebugControls, setShowDebugControls] = useState(false);

  // Manual scroll cancellation - detect user scrolling during animation
  useEffect(() => {
    const handleManualScroll = () => {
      if (isAnimatingScroll) {
        scrollCancelRef.current = true;
        setIsAnimatingScroll(false);
        setHighlightClues(false);
      }
    };

    window.addEventListener('wheel', handleManualScroll, { passive: true });
    window.addEventListener('touchmove', handleManualScroll, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleManualScroll);
      window.removeEventListener('touchmove', handleManualScroll);
    };
  }, [isAnimatingScroll]);

  // Scroll animation sequence after a guess
  useEffect(() => {
    if (guesses.length === 0 || isAnimatingScroll) return;

    const latestGuess = guesses[guesses.length - 1];
    const isCorrect = !latestGuess.incorrect;

    const runScrollSequence = async () => {
      setIsAnimatingScroll(true);
      scrollCancelRef.current = false;

      // Step 1: Scroll to where the guess landed - embed at top, all flair visible
      const targetRef = isCorrect ? correctGuessesRef : incorrectGuessesRef;
      if (targetRef.current && !scrollCancelRef.current) {
        targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        await new Promise(resolve => setTimeout(resolve, 600)); // Scroll animation time
        if (scrollCancelRef.current) {
          setIsAnimatingScroll(false);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, guessDwellTime)); // Dwell on guess
      }
      if (scrollCancelRef.current) {
        setIsAnimatingScroll(false);
        return;
      }

      // Step 2: Scroll to "Playlist Intel" heading (1/3 from top of viewport)
      if (whatWeKnowRef.current && !scrollCancelRef.current) {
        const elementRect = whatWeKnowRef.current.getBoundingClientRect();
        const absoluteElementTop = elementRect.top + window.pageYOffset;
        const targetPosition = absoluteElementTop - (window.innerHeight / 3);
        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
        await new Promise(resolve => setTimeout(resolve, 600)); // Scroll animation time
      }
      if (scrollCancelRef.current) {
        setIsAnimatingScroll(false);
        return;
      }

      // Step 3: Highlight intel section and linger
      setHighlightClues(true);
      await new Promise(resolve => setTimeout(resolve, intelDwellTime)); // Dwell on intel
      if (scrollCancelRef.current) {
        setHighlightClues(false);
        setIsAnimatingScroll(false);
        return;
      }
      setHighlightClues(false);

      // Step 4: COMMENTED OUT - let players scroll back up themselves
      // if (guessOptionsRef.current && !scrollCancelRef.current) {
      //   guessOptionsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      //   await new Promise(resolve => setTimeout(resolve, returnSpeed));
      // }

      setIsAnimatingScroll(false);
    };

    runScrollSequence();
  }, [guesses.length, guessDwellTime, intelDwellTime]);

  const handleHintClick = () => {
    if (hintsUsed >= maxHints) return;
    setPendingHintUse(true);
  };

  const handleCancelReveal = () => {
    setPendingHintUse(false);
  };

  const handleAttributeReveal = (attribute) => {
    if (!pendingHintUse || hintsUsed >= maxHints || !seed) return;

    // Get attribute value from seed
    let value;
    if (attribute === 'tempo') {
      // Try tempo_norm first, fallback to tempo and normalize it
      if (seed.tempo_norm !== undefined && seed.tempo_norm !== null) {
        value = seed.tempo_norm;
      } else if (seed.tempo !== undefined && seed.tempo !== null) {
        // Normalize raw tempo (assume range 0-200 BPM)
        value = Math.min(Math.max(seed.tempo / 200, 0), 1);
      } else {
        console.error('Tempo is undefined or null', { seed });
        return;
      }
    } else if (attribute === 'popularity') {
      // Popularity is 0-100, normalize to 0-1
      if (seed.popularity !== undefined && seed.popularity !== null) {
        value = seed.popularity / 100;
      } else {
        console.error('Popularity is undefined or null', { seed });
        return;
      }
    } else {
      // Other attributes are already 0-1
      value = seed[attribute];
    }

    if (value === undefined || value === null) {
      console.error(`Attribute ${attribute} is undefined or null`, { value, seed });
      return;
    }
    if (typeof value === 'number' && isNaN(value)) {
      console.error(`Attribute ${attribute} is NaN`, { value });
      return;
    }

    // Determine range (low < 0.35, high > 0.65, else mid)
    let range;
    if (value < 0.35) range = 'low';
    else if (value > 0.65) range = 'high';
    else range = 'mid';

    // Get description
    const description = ATTRIBUTE_DESCRIPTIONS[attribute];
    if (!description) {
      console.error(`No description for attribute: ${attribute}`);
      return;
    }

    const { adjective, guidance } = description[range];

    // Format the value for display
    let displayValue;
    if (attribute === 'tempo') {
      // Tempo: map 0-1 range to 70-140 BPM
      displayValue = Math.round(70 + (value * 70));
    } else if (attribute === 'popularity') {
      // Popularity: value is 0-1 normalized, convert to 0-100
      displayValue = Math.round(value * 100);
    } else {
      // Other attributes: 0-1 scale, convert to 0-100
      displayValue = Math.round(value * 100);
    }

    // Create clue text
    const clue = `🔍 Starting track's ${attribute} is ${displayValue}, a ${adjective} track. Look for songs that ${guidance}.`;

    // Update state
    setRevealedAttributes(prev => ({ ...prev, [attribute]: true }));
    setRevealClues(prev => [...prev, clue]);
    setHintsUsed(prev => prev + 1);
    setPendingHintUse(false);
  };
  // Extract Spotify track ID from URI or return as-is if already just an ID
  const getSpotifyId = (track) => {
    if (!track || !track.id) return '';
    const id = track.id;
    // If it's a URI (spotify:track:abc123), extract the ID
    if (id.startsWith('spotify:track:')) {
      return id.split(':')[2];
    }
    // If it's already just the ID (abc123), return as-is
    return id;
  };

  const getArtistString = (track) => {
    if (!track?.artists) return 'Unknown';
    return Array.isArray(track.artists) ? track.artists.join(', ') : track.artists;
  };

  // Check if a challenge is satisfied
  const isChallengeActive = (index) => {
    return challengePlacements[index] !== null;
  };

  // Count unused hints for points
  const unusedHintCount = revealedHints.filter(r => !r).length;
  const hintPointsAvailable = unusedHintCount * HINT_POINTS;

  // Helper: Generate attribute intel using ATTRIBUTE_DESCRIPTIONS pattern
  const generateAttributeIntel = (attributeName, trackData) => {
    if (!trackData) return null;

    // Get value and determine tier (low/mid/high)
    const getValue = (attr) => {
      if (attr === 'tempo') {
        return trackData.tempo_norm !== undefined ? trackData.tempo_norm :
               trackData.tempo !== undefined ? Math.min(Math.max((trackData.tempo - 70) / 70, 0), 1) : null;
      }
      if (attr === 'popularity') return trackData[attr] !== undefined ? trackData[attr] / 100 : null;
      return trackData[attr];
    };

    const value = getValue(attributeName);
    if (value === null) return null;

    const tier = value < 0.33 ? 'low' : value > 0.66 ? 'high' : 'mid';
    const desc = ATTRIBUTE_DESCRIPTIONS[attributeName];
    if (!desc || !desc[tier]) return null;

    // Format display value
    let displayValue;
    if (attributeName === 'tempo') {
      displayValue = Math.round(70 + (value * 70));
    } else if (attributeName === 'popularity') {
      displayValue = Math.round(value * 100);
    } else {
      displayValue = Math.round(value * 100);
    }

    return `Playlist features a track with ${attributeName} ${displayValue}. Look for songs that ${desc[tier].guidance}`;
  };

  // Helper: Select which attributes are displayed for a guess (matches GuessFlair logic)
  const getDisplayedAttributes = (guess) => {
    const allAttributes = ['danceability', 'energy', 'acousticness', 'valence', 'tempo', 'popularity'];

    // Use same deterministic randomness as GuessFlair
    const seedValue = guess.id ? String(guess.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : Math.random();
    const shuffled = [...allAttributes];

    // Fisher-Yates shuffle with deterministic seed
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(((seedValue + i) * 9301 + 49297) % 233280 / 233280 * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, 2);
  };

  // Generate clues from guesses
  const generateClues = () => {
    if (!seed || guesses.length === 0) return [];

    const clues = [];
    // Removed 'genre' to avoid redundant "playlist includes [genre]" intel when player already selected that genre
    const attributes = ['year', 'valence', 'popularity', 'danceability',
                        'energy', 'acousticness', 'instrumentalness', 'speechiness'];

    guesses.forEach((guess, guessIndex) => {
      if (!guess.trackData) return;

      const guessTrack = guess.trackData;

      // Generate all possible clues for this guess
      const possibleClues = [];

      if (guess.incorrect) {
        // Wrong guess - describe what the playlist IS (based on seed track)
        // Generate clues for all attributes and pick one randomly
        attributes.forEach(attr => {
          let clue = '';
          if (attr === 'year' && seed.year) {
            const decade = Math.floor(seed.year / 10) * 10;
            clue = `Playlist draws from the ${decade}s era`;
          } else if (attr === 'popularity') {
            if (seed.popularity < 30) {
              clue = `Playlist favors underground and niche selections`;
            } else if (seed.popularity > 70) {
              clue = `Playlist features well-known, popular hits`;
            } else {
              clue = `Playlist balances mainstream and indie tracks`;
            }
          } else if (attr === 'valence') {
            if (seed.valence < 0.4) {
              clue = `Playlist embraces darker, introspective moods`;
            } else if (seed.valence > 0.6) {
              clue = `Playlist brings upbeat, feel-good energy`;
            } else {
              clue = `Playlist walks the line between light and shadow`;
            }
          } else if (attr === 'danceability') {
            if (seed.danceability < 0.4) {
              clue = `Playlist prioritizes musical depth over groove`;
            } else if (seed.danceability > 0.7) {
              clue = `Playlist is built for movement and rhythm`;
            } else {
              clue = `Playlist has a moderate, groovy feel`;
            }
          } else if (attr === 'energy') {
            if (seed.energy < 0.4) {
              clue = `Playlist maintains a calm, relaxed vibe`;
            } else if (seed.energy > 0.7) {
              clue = `Playlist delivers high-octane intensity`;
            } else {
              clue = `Playlist keeps a steady, moderate energy`;
            }
          } else if (attr === 'acousticness') {
            if (seed.acousticness > 0.6) {
              clue = `Playlist highlights organic, acoustic sounds`;
            } else if (seed.acousticness < 0.3) {
              clue = `Playlist leans into electronic production`;
            } else {
              clue = `Playlist blends acoustic and electronic elements`;
            }
          } else if (attr === 'instrumentalness') {
            if (seed.instrumentalness > 0.5) {
              clue = `Playlist leans toward instrumental tracks`;
            } else {
              clue = `Playlist features vocal-driven tracks`;
            }
          } else if (attr === 'speechiness') {
            if (seed.speechiness > 0.33) {
              clue = `Playlist includes spoken word or rap elements`;
            } else {
              clue = `Playlist focuses on melodic, sung vocals`;
            }
          }
          if (clue) possibleClues.push(clue);
        });
      } else {
        // Correct guess - generate attribute intel for displayed attributes
        const displayedAttrs = getDisplayedAttributes(guess);
        displayedAttrs.forEach(attr => {
          const intel = generateAttributeIntel(attr, guessTrack);
          if (intel) possibleClues.push(intel);
        });
      }

      // Pick one random clue from all possibilities
      if (possibleClues.length > 0) {
        const randomClue = possibleClues[Math.floor(Math.random() * possibleClues.length)];
        clues.push(randomClue);
      }
    });
    
    return clues;
  };

  // Memoize clues so they don't regenerate on every render
  const clues = useMemo(() => generateClues(), [guesses, seed]);

  return (
    <div
      className="min-h-screen bg-zinc-950 p-3 md:p-6"
      onClick={() => pendingHintUse && handleCancelReveal()}
    >
      <div className="max-w-7xl mx-auto">
        
        {/* Linear Layout: All sections in proper order */}
        <div className="space-y-3 mb-6">

          {/* 1. Starting Track */}
          {seed && (
            <div className="bg-zinc-900 rounded-lg p-3 border-2 border-green-500 relative">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-green-400 font-bold text-base">Starting Track</h2>
                <button
                  onClick={() => window.location.reload()}
                  className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded border border-zinc-600 hover:border-zinc-500 transition-all cursor-pointer"
                >
                  Want a different track? Return to map.
                </button>
              </div>
              <div className="relative">
                <iframe
                  title={`Spotify player for ${seed.name}`}
                  src={`https://open.spotify.com/embed/track/${getSpotifyId(seed)}?utm_source=generator`}
                  width="100%"
                  height="152"
                  frameBorder="0"
                  allowtransparency="true"
                  allow="encrypted-media"
                  className="rounded-lg"
                />
              </div>
            </div>
          )}

          {/* 2. Make Your Guess + Guess Options */}
          <div ref={guessOptionsRef}>
            <div className={`bg-zinc-900 rounded-lg p-4 mb-2 transition-all ${
              flashGuessCounter ? 'ring-4 ring-green-500 ring-opacity-75 scale-105' : ''
            }`}>
              {/* Heading and subheading */}
              <div className="mb-4">
                <h1 className="text-2xl font-bold text-white tracking-tight mb-1">What's on the playlist?</h1>
                <p className="text-sm font-normal text-[#b3b3b3]">Pick 1 of 3 songs, or refresh for new choices. 6 picks per round.</p>
              </div>

              {/* Guesses Remaining - Number line (6 to 1, left to right) */}
              <div className="relative flex items-center justify-between">
                {[...Array(maxGuesses || 6)].map((_, idx) => {
                  // Start at 6, count down to 1 (left to right)
                  const guessNum = (maxGuesses || 6) - idx;
                  const guessesRemaining = (maxGuesses || 6) - guesses.length;
                  const isCurrent = guessesRemaining === guessNum;
                  const isPast = guessesRemaining < guessNum;
                  const isFirst = idx === 0;
                  const isLast = idx === (maxGuesses || 6) - 1;

                  return (
                    <React.Fragment key={idx}>
                      {/* Connecting line before (except for first) */}
                      {!isFirst && (
                        <div className="flex-1 h-0.5 bg-zinc-600" />
                      )}

                      {/* Number circle */}
                      <div className="relative flex items-center justify-center">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all z-10 ${
                          isCurrent
                            ? 'bg-green-500 border-green-400 text-white scale-110 shadow-lg'
                            : isPast
                            ? 'bg-zinc-800 border-zinc-600 text-zinc-400'
                            : 'bg-zinc-700 border-zinc-600 text-zinc-500'
                        } ${flashGuessCounter && isCurrent ? 'ring-4 ring-green-400' : ''}`}>
                          <span className="text-2xl font-bold">{guessNum}</span>
                        </div>
                      </div>

                      {/* No line after last */}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {errorMessage && (
              <div className="bg-red-900 border border-red-600 text-white px-3 py-2 rounded mb-2 text-sm">
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2">
              {multipleChoiceOptions.length > 0 ? (
                multipleChoiceOptions.map((track) => (
                  <div
                    key={track.id}
                    className="relative"
                  >
                    <iframe
                      title={`Spotify player for ${track.name || 'track'}`}
                      src={`https://open.spotify.com/embed/track/${getSpotifyId(track)}?utm_source=generator`}
                      width="100%"
                      height="152"
                      frameBorder="0"
                      allowtransparency="true"
                      allow="encrypted-media"
                      className="rounded-lg"
                    />
                    <div
                      onClick={() => onGuess(track)}
                      className="absolute top-0 left-0 right-0 cursor-pointer rounded-t-lg"
                      style={{ height: '70%' }}
                      title="Click to select this track"
                    />
                    {debugMode && track.correct && (
                      <div className="absolute top-2 right-2 bg-green-500 text-black px-2 py-1 rounded text-xs font-bold z-20 pointer-events-none">
                        CORRECT
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-zinc-500">
                  Loading options...
                </div>
              )}
            </div>

            {multipleChoiceOptions.length > 0 && (
              <button
                onClick={onRefreshCandidates}
                className="w-full mt-3 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-lg transition-all text-base shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="flex items-center justify-center gap-2">
                  <span className="text-xl">↻</span>
                  <span>Refresh Options</span>
                </span>
              </button>
            )}
          </div>

          {/* 3. Track Attributes - COMMENTED OUT (keeping code for potential future use) */}
          {/* {seed && (
            <div onClick={(e) => e.stopPropagation()}>
              <TrackAttributes
                track={seed}
                revealedAttributes={revealedAttributes}
                onAttributeClick={handleAttributeReveal}
                clickableAttributes={pendingHintUse}
                pulseUnrevealed={pendingHintUse}
              />
            </div>
          )} */}

          {/* 4. Reveal Starting Track Attributes - COMMENTED OUT (keeping code for potential future use) */}
          {/* <div
            onClick={() => {
              if (hintsUsed >= maxHints) return;
              if (pendingHintUse) {
                handleCancelReveal();
              } else {
                handleHintClick();
              }
            }}
            className={`bg-blue-900/20 border border-blue-800/50 rounded-lg p-4 ${
              hintsUsed < maxHints ? 'cursor-pointer hover:bg-blue-900/30 transition' : ''
            }`}
          >
            <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
              Reveal starting track's attributes
            </h1>
            {hintsUsed < maxHints && (
              <p className="text-sm font-normal text-[#b3b3b3] mb-4">
                {pendingHintUse
                  ? 'Select an attribute above to reveal it!'
                  : 'Select here, then pick an attribute to reveal'}
              </p>
            )}

            <div className="flex items-center justify-center gap-4 my-4">
              {[0, 1, 2].map((idx) => {
                const isUsed = idx < hintsUsed;

                return (
                  <Search
                    key={idx}
                    className={`w-12 h-12 transition ${
                      isUsed ? 'text-zinc-700' : 'text-green-500'
                    }`}
                  />
                );
              })}
            </div>

            <p className="text-base font-normal text-white leading-relaxed text-center">
              Unused reveals bonus: <span className="text-green-400 font-bold">+{(maxHints - hintsUsed) * HINT_POINTS} pts</span>
            </p>
          </div> */}

          {/* 5. What We Know So Far - Spotify-style Discovery Feed */}
          <div
            ref={whatWeKnowRef}
            className={`bg-gradient-to-br from-zinc-900 to-zinc-900/50 rounded-xl p-5 border border-zinc-800 transition-all ${
              highlightClues ? 'ring-4 ring-green-500 ring-opacity-75 scale-102 border-green-500/50' : ''
            } mx-1`}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <span className="text-xl">💡</span>
              </div>
              <div>
                <h3 className="text-white font-bold text-xl">Playlist Intel</h3>
                <p className="text-zinc-400 text-sm">
                  What you've discovered
                </p>
              </div>
            </div>
            {(revealClues.length > 0 || clues.length > 0) ? (
              <div className="space-y-3">
                {/* Reveal clues - styled as insight cards (newest first) */}
                {revealClues.slice().reverse().map((clue, idx) => (
                  <div
                    key={`reveal-${idx}`}
                    className="bg-green-900/20 border border-green-700/40 rounded-lg p-3 flex items-center gap-3 hover:bg-green-900/30 transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-green-400 font-bold text-sm">{idx + 1}</span>
                    </div>
                    <p className="text-zinc-200 text-base leading-relaxed flex-1">
                      {clue}
                    </p>
                  </div>
                ))}
                {/* Guess-based clues - styled as insight cards (newest first) */}
                {clues.slice().reverse().map((clue, idx) => (
                  <div
                    key={`guess-${idx}`}
                    className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3 flex items-center gap-3 hover:bg-blue-900/30 transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-400 font-bold text-sm">{revealClues.length + idx + 1}</span>
                    </div>
                    <p className="text-zinc-200 text-base leading-relaxed flex-1">
                      {clue}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 text-center">
                <p className="text-zinc-400 text-base">
                  🎯 Make a guess or reveal an attribute to start discovering clues
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bonus Challenges */}
        <div className="bg-zinc-900 rounded-lg p-4" data-playlist-section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-white text-lg font-bold">Bonus Challenges</h2>
          </div>

          <p className="text-zinc-400 text-base mb-3">
            For extra points, pick songs with these qualities
          </p>

          {/* Challenge Slots (2 challenges) - Color coded by attribute, displayed side by side */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {challenges.slice(0, 2).map((challenge, idx) => {
              const isActive = isChallengeActive(idx);
              const placedGuessId = challengePlacements[idx];
              const placedGuess = placedGuessId
                ? guesses.find(g => g.id === placedGuessId)
                : null;

              // Grey out when attached to a guess (lasting imprint - sticker moved to track)
              const isAttached = placedGuess !== null;

              // Get attribute color based on challenge type
              const getAttributeColor = () => {
                const colorMap = {
                  'mega-hit': '#EC4899',        // popularity - pink
                  'deep-cut': '#EC4899',         // popularity - pink
                  'cult-classic': '#EC4899',     // popularity - pink
                  'high-energy': '#DC2626',      // energy - red
                  'chill-vibes': '#DC2626',      // energy - red
                  'dance-floor': '#9333EA',      // danceability - purple
                  'anti-dance': '#9333EA',       // danceability - purple
                  'feel-good': '#2563EB',        // valence - blue
                  'melancholy': '#2563EB',       // valence - blue
                  'unplugged': '#16A34A',        // acousticness - green
                  'electronic': '#16A34A',       // acousticness - green
                  'fast-and-furious': '#EAB308', // tempo - yellow/gold
                  'slow-burn': '#EAB308',        // tempo - yellow/gold
                  'time-traveler': '#F59E0B',    // era variant - orange
                  'genre-bender': '#8B5CF6',     // genre variant - violet
                };
                return colorMap[challenge?.id] || '#3B82F6';
              };

              const attributeColor = challenge ? getAttributeColor() : '#3B82F6';

              return challenge ? (
                <div
                  key={idx}
                  className={`rounded-lg p-3 border-2 transition ${
                    isAttached
                      ? 'bg-zinc-800/50 border-zinc-700/50 opacity-60'
                      : 'bg-opacity-20'
                  }`}
                  style={{
                    backgroundColor: isAttached ? undefined : `${attributeColor}20`,
                    borderColor: isAttached ? undefined : attributeColor,
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className={`font-bold ${
                      isAttached ? 'text-zinc-600' : 'text-white'
                    }`}>
                      {challenge.name}
                    </h3>
                    {!isAttached && (
                      <span className="text-white text-sm font-bold">
                        +{CHALLENGE_POINTS}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm mb-2 ${
                    isAttached ? 'text-zinc-700' : 'text-zinc-300'
                  }`}>
                    {challenge.description}
                  </p>
                  {isAttached && (
                    <p className="text-zinc-600 text-xs italic mt-2">
                      Sticker moved to {placedGuess.song}
                    </p>
                  )}
                </div>
              ) : (
                <div key={idx} className="rounded-lg p-4 bg-zinc-800 border-2 border-zinc-700">
                  <p className="text-zinc-600 text-center">Empty slot</p>
                </div>
              );
            })}
          </div>

          {/* Guessed Tracks with Flair */}
          {guesses.length > 0 && (() => {
            const correctGuesses = guesses.filter(g => !g.incorrect);
            const incorrectGuesses = guesses.filter(g => g.incorrect);

            return (
              <div className="space-y-6">
                {/* Correct Guesses */}
                {correctGuesses.length > 0 && (
                  <div ref={correctGuessesRef} className="bg-green-900/10 rounded-lg p-4">
                    <h3 className="text-green-400 font-bold mb-4 text-2xl flex items-center gap-2">
                      <span>✓</span> Correct Guesses ({correctGuesses.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {correctGuesses.slice().reverse().map((guess, idx) => {
                        // Find if this guess has a challenge
                        const challengeIdx = challengePlacements.findIndex(
                          placement => placement === guess.id
                        );
                        const assignedChallenge = challengeIdx >= 0 ? challenges[challengeIdx] : null;

                        return (
                          <div key={guess.id} className="space-y-2">
                            {/* Spotify Embed */}
                            <div className="relative">
                              <iframe
                                title={`Spotify player for ${guess.trackData?.name || 'track'}`}
                                src={`https://open.spotify.com/embed/track/${getSpotifyId(guess.trackData)}?utm_source=generator`}
                                width="100%"
                                height="152"
                                frameBorder="0"
                                allowtransparency="true"
                                allow="encrypted-media"
                                className="rounded-lg"
                              />
                            </div>

                            {/* Flair System */}
                            <GuessFlair
                              guess={guess}
                              seed={seed}
                              challenge={assignedChallenge}
                              revealedSeedAttributes={revealedAttributes}
                              isCorrect={true}
                              animationDelay={idx * 150}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Incorrect Guesses */}
                {incorrectGuesses.length > 0 && (
                  <div ref={incorrectGuessesRef} className="bg-red-900/10 rounded-lg p-4">
                    <h3 className="text-red-400 font-bold mb-4 text-2xl flex items-center gap-2">
                      <span>✗</span> Not on Playlist ({incorrectGuesses.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {incorrectGuesses.slice().reverse().map((guess, idx) => (
                        <div key={guess.id} className="space-y-2">
                          {/* Spotify Embed */}
                          <div className="relative opacity-60">
                            <iframe
                              title={`Spotify player for ${guess.trackData?.name || 'track'}`}
                              src={`https://open.spotify.com/embed/track/${getSpotifyId(guess.trackData)}?utm_source=generator`}
                              width="100%"
                              height="152"
                              frameBorder="0"
                              allowtransparency="true"
                              allow="encrypted-media"
                              className="rounded-lg"
                            />
                          </div>

                          {/* Flair for Incorrect (shows attributes only) */}
                          <GuessFlair
                            guess={guess}
                            seed={seed}
                            challenge={null}
                            revealedSeedAttributes={revealedAttributes}
                            isCorrect={false}
                            animationDelay={idx * 150}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {guessesLeft === 0 && (
            <button
              onClick={onSeeScore}
              className="w-full mt-4 px-6 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg transition"
            >
              See Final Score →
            </button>
          )}
        </div>

        {/* First-visit instructions overlay */}
        {showInstructions && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 rounded-lg p-6 max-w-md border-2 border-green-500">
              <h2 className="text-2xl font-bold text-white mb-4">Guess the Playlist</h2>
              <p className="text-zinc-300 mb-4">
                Can you predict which songs would appear on an algorithmic playlist for your track?
                You have {maxGuesses || 6} guesses to find the right songs.
              </p>
              <p className="text-zinc-300 mb-4">
                Each correct answer is worth {10} points. Match the challenge attributes for bonus points worth {CHALLENGE_POINTS} each!
              </p>
              <button
                onClick={dismissInstructions}
                className="w-full px-4 py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded transition"
              >
                Got it!
              </button>
            </div>
          </div>
        )}

        {/* REMOVED - Animation debug controls
        <button
          onClick={() => setShowDebugControls(!showDebugControls)}
          className="fixed bottom-4 right-4 z-40 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded border border-zinc-600 transition"
        >
          {showDebugControls ? '✕' : '⚙️'} Animation Debug
        </button>

        {showDebugControls && (
          <div className="fixed bottom-16 right-4 z-40 bg-zinc-900 border-2 border-zinc-700 rounded-lg p-4 shadow-xl w-64 max-h-[80vh] overflow-y-auto">
            ...debug panel content...
          </div>
        )}
        */}
      </div>
    </div>
  );
}
