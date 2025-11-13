import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { HINT_POINTS, CHALLENGE_POINTS } from '../../constants/gameConfig';
import { TrackAttributes } from './TrackAttributes';
import { GuessFlair } from './GuessFlair';

// Version tracking
console.log('🎮 GuessPhase v2.7 - Typography polish and bigger clues');

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
  const [highlightClues, setHighlightClues] = useState(false);
  const [isAnimatingScroll, setIsAnimatingScroll] = useState(false);

  // Debug: Animation timing controls
  const [guessDwellTime, setGuessDwellTime] = useState(2500); // milliseconds
  const [intelDwellTime, setIntelDwellTime] = useState(2500); // milliseconds
  const [showDebugControls, setShowDebugControls] = useState(false);

  // Scroll animation sequence after a guess
  useEffect(() => {
    if (guesses.length === 0 || isAnimatingScroll) return;

    const latestGuess = guesses[guesses.length - 1];
    const isCorrect = !latestGuess.incorrect;

    const runScrollSequence = async () => {
      setIsAnimatingScroll(true);

      // Step 1: Scroll to where the guess landed and dwell
      const targetRef = isCorrect ? correctGuessesRef : incorrectGuessesRef;
      if (targetRef.current) {
        targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 600)); // Scroll animation time
        await new Promise(resolve => setTimeout(resolve, guessDwellTime)); // Dwell on guess
      }

      // Step 2: Scroll to "What We Know So Far"
      if (whatWeKnowRef.current) {
        whatWeKnowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 600)); // Scroll animation time
      }

      // Step 3: Highlight section and linger
      setHighlightClues(true);
      await new Promise(resolve => setTimeout(resolve, intelDwellTime)); // Dwell on intel
      setHighlightClues(false);

      // Step 4: Peek up slightly (scroll up 150px to see bottom of guess options)
      window.scrollBy({ top: -150, behavior: 'smooth' });

      await new Promise(resolve => setTimeout(resolve, 300));
      setIsAnimatingScroll(false);
    };

    runScrollSequence();
  }, [guesses.length]);

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
    const value = seed[attribute === 'tempo' ? 'tempo_norm' : attribute];
    if (value === undefined || value === null || isNaN(value)) return;

    // Determine range (low < 0.35, high > 0.65, else mid)
    let range;
    if (value < 0.35) range = 'low';
    else if (value > 0.65) range = 'high';
    else range = 'mid';

    // Get description
    const description = ATTRIBUTE_DESCRIPTIONS[attribute];
    if (!description) return;

    const { adjective, guidance } = description[range];

    // Format the value for display
    let displayValue;
    if (attribute === 'tempo' || attribute === 'popularity') {
      displayValue = Math.round(value * (attribute === 'tempo' ? 100 : 1));
    } else {
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

  // Generate clues from guesses (1 clue per guess)
  const generateClues = () => {
    if (!seed || guesses.length === 0) return [];

    const clues = [];
    const attributes = ['genre', 'year', 'valence', 'popularity', 'danceability',
                        'energy', 'acousticness', 'instrumentalness', 'speechiness'];

    guesses.forEach((guess, guessIndex) => {
      if (!guess.trackData) return;

      const guessTrack = guess.trackData;

      // Pick deterministic attribute based on guess index (stable across renders)
      const attr = attributes[guessIndex % attributes.length];
      let clue = '';
      
      if (guess.incorrect) {
        // Wrong guess - tell what playlist prefers instead
        if (attr === 'genre' && guessTrack.genres?.length > 0) {
          clue = `Playlist doesn't typically feature ${guessTrack.genres[0]}`;
        } else if (attr === 'year' && guessTrack.year) {
          if (guessTrack.year < seed.year) {
            clue = `Playlist prefers songs released after ${guessTrack.year}`;
          } else {
            clue = `Playlist prefers songs released before ${guessTrack.year}`;
          }
        } else if (attr === 'popularity') {
          if (guessTrack.popularity < 30) {
            clue = `Playlist prefers more well-known tracks`;
          } else if (guessTrack.popularity > 70) {
            clue = `Playlist prefers less mainstream tracks`;
          }
        } else if (attr === 'valence') {
          if (guessTrack.valence < 0.4) {
            clue = `Playlist prefers more upbeat, positive vibes`;
          } else if (guessTrack.valence > 0.6) {
            clue = `Playlist prefers more melancholy, introspective tracks`;
          }
        } else if (attr === 'danceability') {
          if (guessTrack.danceability < 0.4) {
            clue = `Playlist prefers more danceable rhythms`;
          } else if (guessTrack.danceability > 0.7) {
            clue = `Playlist prefers less dance-oriented tracks`;
          }
        } else if (attr === 'energy') {
          if (guessTrack.energy < 0.4) {
            clue = `Playlist prefers higher energy tracks`;
          } else if (guessTrack.energy > 0.7) {
            clue = `Playlist prefers more laid-back energy`;
          }
        } else if (attr === 'acousticness') {
          if (guessTrack.acousticness > 0.6) {
            clue = `Playlist prefers more electronic/produced sound`;
          } else {
            clue = `Playlist prefers more acoustic instrumentation`;
          }
        }
      } else {
        // Correct guess - confirm what playlist includes
        if (attr === 'genre' && guessTrack.genres?.length > 0) {
          clue = `Playlist includes ${guessTrack.genres[0]} tracks`;
        } else if (attr === 'year' && guessTrack.year) {
          const decade = Math.floor(guessTrack.year / 10) * 10;
          clue = `Playlist features music from the ${decade}s`;
        } else if (attr === 'popularity') {
          if (guessTrack.popularity < 30) {
            clue = `Playlist welcomes deep cuts and lesser-known tracks`;
          } else if (guessTrack.popularity > 70) {
            clue = `Playlist includes popular, well-known songs`;
          } else {
            clue = `Playlist includes moderately popular tracks`;
          }
        } else if (attr === 'valence') {
          if (guessTrack.valence < 0.4) {
            clue = `Playlist embraces melancholy and introspective moods`;
          } else if (guessTrack.valence > 0.6) {
            clue = `Playlist features upbeat, feel-good vibes`;
          }
        } else if (attr === 'danceability') {
          if (guessTrack.danceability > 0.6) {
            clue = `Playlist loves groove and rhythm`;
          } else {
            clue = `Playlist values musical complexity over danceability`;
          }
        } else if (attr === 'energy') {
          if (guessTrack.energy > 0.6) {
            clue = `Playlist brings high energy and intensity`;
          } else {
            clue = `Playlist maintains a relaxed, chill energy`;
          }
        }
      }
      
      if (clue) clues.push(clue);
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
          <div>
            <div className={`bg-zinc-900 rounded-lg p-4 mb-2 transition-all ${
              flashGuessCounter ? 'ring-4 ring-green-500 ring-opacity-75 scale-105' : ''
            }`}>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-white font-bold text-2xl">What's on the Playlist?</h3>
                  <p className="text-zinc-400 text-base">Pick one of 3 songs, or refresh for new choices</p>
                </div>
              </div>

              {/* Guesses Remaining - Number line with connecting line */}
              <div>
                <p className="text-zinc-400 text-sm font-semibold mb-2 text-center">
                  Guesses<br />Remaining
                </p>
                <div className="relative flex items-center justify-between px-4">
                  {/* Background connecting line */}
                  <div className="absolute left-0 right-0 h-0.5 bg-zinc-600" style={{ top: '50%', transform: 'translateY(-50%)' }} />

                  {/* Number circles - counting down from 6 to 1 */}
                  {[...Array(maxGuesses || 6)].map((_, idx) => {
                    const guessNum = (maxGuesses || 6) - idx;
                    const isCurrent = guesses.length === guessNum;
                    const isPast = guesses.length > guessNum;

                    return (
                      <div key={idx} className="relative flex items-center justify-center">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center border-3 transition-all z-10 ${
                          isCurrent
                            ? 'bg-green-500 border-green-400 text-black scale-110 shadow-lg'
                            : isPast
                            ? 'bg-zinc-700 border-zinc-600 text-zinc-500'
                            : 'bg-zinc-800 border-zinc-600 text-zinc-400'
                        } ${flashGuessCounter && isCurrent ? 'ring-4 ring-green-400' : ''}`}>
                          <span className="text-2xl font-bold">{guessNum}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
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

          {/* 3. Track Attributes */}
          {seed && (
            <div onClick={(e) => e.stopPropagation()}>
              <TrackAttributes
                track={seed}
                revealedAttributes={revealedAttributes}
                onAttributeClick={handleAttributeReveal}
                clickableAttributes={pendingHintUse}
                pulseUnrevealed={pendingHintUse}
              />
            </div>
          )}

          {/* 4. Reveal Starting Track Attributes - Split into 2 colored boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Left box: How to use - Click anywhere to activate or cancel */}
            <div
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
              <h3 className="text-white font-bold text-xl mb-4">Reveal Starting Track Attributes</h3>
              <div className="flex items-center justify-center gap-4 mb-4">
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
              {hintsUsed < maxHints && (
                <p className="text-zinc-300 text-base text-center">
                  {pendingHintUse
                    ? '👆 Click an attribute above to reveal it!'
                    : 'Click here, then click an attribute to reveal'}
                </p>
              )}
            </div>

            {/* Right box: Score impact */}
            <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4 flex flex-col justify-center items-center">
              <p className="text-zinc-300 text-sm font-semibold mb-2">Unused Reveals Bonus</p>
              <p className="text-green-400 text-3xl font-bold">+{(maxHints - hintsUsed) * HINT_POINTS}pts</p>
            </div>
          </div>

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
                {/* Reveal clues - styled as insight cards */}
                {revealClues.map((clue, idx) => (
                  <div
                    key={`reveal-${idx}`}
                    className="bg-green-900/20 border border-green-700/40 rounded-lg p-3 flex items-start gap-3 hover:bg-green-900/30 transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-green-400 font-bold text-sm">{idx + 1}</span>
                    </div>
                    <p className="text-zinc-200 text-base leading-relaxed flex-1">
                      {clue}
                    </p>
                  </div>
                ))}
                {/* Guess-based clues - styled as insight cards */}
                {clues.map((clue, idx) => (
                  <div
                    key={`guess-${idx}`}
                    className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3 flex items-start gap-3 hover:bg-blue-900/30 transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
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
            For extra points, pick songs that are on the playlist and have these qualities
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
                  'feel-good': '#2563EB',        // valence - blue
                  'melancholy': '#2563EB',       // valence - blue
                  'unplugged': '#16A34A',        // acousticness - green
                  'fast-and-furious': '#EAB308', // tempo - yellow/gold
                  'slow-burn': '#EAB308',        // tempo - yellow/gold
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
                      {correctGuesses.map((guess, idx) => {
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
                      {incorrectGuesses.map((guess, idx) => (
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

        {/* Debug Controls for Animation Timing */}
        <button
          onClick={() => setShowDebugControls(!showDebugControls)}
          className="fixed bottom-4 right-4 z-40 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded border border-zinc-600 transition"
        >
          {showDebugControls ? '✕' : '⚙️'} Animation Debug
        </button>

        {showDebugControls && (
          <div className="fixed bottom-16 right-4 z-40 bg-zinc-900 border-2 border-zinc-700 rounded-lg p-4 shadow-xl w-64">
            <h3 className="text-white font-bold mb-3 text-sm">Animation Timing (ms)</h3>

            <div className="space-y-3">
              <div>
                <label className="text-zinc-400 text-xs block mb-1">Guess Dwell Time:</label>
                <input
                  type="number"
                  value={guessDwellTime}
                  onChange={(e) => setGuessDwellTime(Number(e.target.value))}
                  className="w-full bg-zinc-800 text-white px-2 py-1 rounded text-sm border border-zinc-700"
                  step="500"
                  min="0"
                  max="10000"
                />
              </div>

              <div>
                <label className="text-zinc-400 text-xs block mb-1">Intel Dwell Time:</label>
                <input
                  type="number"
                  value={intelDwellTime}
                  onChange={(e) => setIntelDwellTime(Number(e.target.value))}
                  className="w-full bg-zinc-800 text-white px-2 py-1 rounded text-sm border border-zinc-700"
                  step="500"
                  min="0"
                  max="10000"
                />
              </div>

              <button
                onClick={() => {
                  setGuessDwellTime(2500);
                  setIntelDwellTime(2500);
                }}
                className="w-full px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded transition"
              >
                Reset to Default
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
