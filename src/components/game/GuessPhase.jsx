import React from 'react';
import { HINT_POINTS, CHALLENGE_POINTS } from '../../constants/gameConfig';

// Version tracking
console.log('🎮 GuessPhase v2.2 - Bottom controls accessible + additive clues');

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
    
    guesses.forEach((guess) => {
      if (!guess.trackData) return;
      
      const guessTrack = guess.trackData;
      
      // Pick random attribute
      const attr = attributes[Math.floor(Math.random() * attributes.length)];
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

  const clues = generateClues();

  return (
    <div className="min-h-screen bg-zinc-950 p-3 md:p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Two Column Layout: Seed+Hints | Guess Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          
          {/* LEFT: Seed Info and Hints */}
          <div className="space-y-3">
            {/* Seed Track */}
            {seed && (
              <div className="bg-zinc-900 rounded-lg p-3 border-2 border-green-500">
                <h2 className="text-green-400 font-bold mb-2 text-sm">Seed Track</h2>
                <div className="relative">
                  <iframe
                    src={`https://open.spotify.com/embed/track/${getSpotifyId(seed)}?utm_source=generator`}
                    width="100%"
                    height="152"
                    frameBorder="0"
                    allowtransparency="true"
                    allow="encrypted-media"
                    className="rounded-lg"
                  />
                  {/* No overlay on seed - let them interact freely */}
                </div>
              </div>
            )}

            {/* Seed Hints */}
            <div className="bg-zinc-900 rounded-lg p-3">
              <h3 className="text-white font-bold mb-1 text-sm">Seed Hints</h3>
              <p className="text-zinc-400 text-xs mb-2">
                Trade points for clues about the seed's audio properties
              </p>
              <div className="space-y-2">
                {[0, 1, 2].map((idx) => (
                  <button
                    key={idx}
                    onClick={() => onRevealHint(idx)}
                    disabled={revealedHints[idx]}
                    className={`w-full text-left px-3 py-2 rounded transition text-sm ${
                      revealedHints[idx]
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-500 text-white font-semibold'
                    }`}
                  >
                    {revealedHints[idx] ? (
                      <span>{seedHints[idx]}</span>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span>Hint {idx + 1} (click to reveal)</span>
                        <span className="text-sm">+{HINT_POINTS}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* What We Know So Far */}
            <div className="bg-zinc-900 rounded-lg p-3">
              <h3 className="text-white font-bold mb-1 text-sm">What We Know So Far</h3>
              <p className="text-zinc-400 text-xs mb-2">
                Clues discovered from your guesses
              </p>
              {clues.length > 0 ? (
                <ul className="space-y-1.5 text-zinc-300 text-xs">
                  {clues.map((clue, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-green-400 mr-2">•</span>
                      <span>{clue}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-zinc-600 text-xs italic">
                  Make a guess to discover clues about the playlist
                </p>
              )}
            </div>
          </div>

          {/* RIGHT: Guess Cards (Spotify Embeds) */}
          <div>
            <div className="bg-zinc-900 rounded-lg p-3 mb-3 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold mb-1 text-sm">Make Your Guess</h3>
                <p className="text-zinc-400 text-xs">Click card to select, use controls at bottom to play/scrub</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-green-400">{guesses.length}</div>
                <div className="text-xs text-green-500/70">of {maxGuesses || 6}</div>
              </div>
            </div>

            {errorMessage && (
              <div className="bg-red-900 border border-red-600 text-white px-3 py-2 rounded mb-3 text-sm">
                {errorMessage}
              </div>
            )}

            <div className="space-y-2">
              {multipleChoiceOptions.length > 0 ? (
                multipleChoiceOptions.map((track) => (
                  <div
                    key={track.id}
                    className="relative"
                  >
                    {/* Spotify Embed */}
                    <iframe
                      src={`https://open.spotify.com/embed/track/${getSpotifyId(track)}?utm_source=generator`}
                      width="100%"
                      height="152"
                      frameBorder="0"
                      allowtransparency="true"
                      allow="encrypted-media"
                      className="rounded-lg"
                    />

                    {/* Clickable overlay - covers top 70% so controls (bottom 30%) work */}
                    <div 
                      onClick={() => onGuess(track)}
                      className="absolute top-0 left-0 right-0 cursor-pointer hover:bg-green-500/10 rounded-t-lg transition"
                      style={{ height: '70%' }}
                      title="Click to select this track"
                    />

                    {/* Debug indicator */}
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
                className="w-full mt-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition text-sm"
              >
                ↻ Refresh Options
              </button>
            )}
          </div>
        </div>

        {/* Challenge Slots + Playlist */}
        <div className="bg-zinc-900 rounded-lg p-4" data-playlist-section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-white text-lg font-bold">Your Playlist</h2>
            <div className="text-zinc-400 text-sm">
              {guesses.length} guesses · {guessesLeft} remaining
            </div>
          </div>

          <p className="text-zinc-400 text-sm mb-3">
            Fill challenge slots with correct guesses that match the criteria
          </p>

          {/* Challenge Slots (Top 3) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {challenges.map((challenge, idx) => {
              const isActive = isChallengeActive(idx);
              const placedGuessId = challengePlacements[idx];
              const placedGuess = placedGuessId
                ? guesses.find(g => g.id === placedGuessId)
                : null;

              return challenge ? (
                <div
                  key={idx}
                  className={`rounded-lg p-3 border-2 transition ${
                    isActive
                      ? 'bg-blue-900/50 border-blue-500'
                      : 'bg-zinc-800 border-zinc-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className={`font-bold ${isActive ? 'text-blue-300' : 'text-zinc-500'}`}>
                      {challenge.name}
                    </h3>
                    {isActive && (
                      <span className="text-blue-300 text-sm font-bold">
                        +{CHALLENGE_POINTS}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mb-2 ${isActive ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    {challenge.description}
                  </p>
                  {placedGuess && (
                    <div className="mt-2 pt-2 border-t border-zinc-700">
                      <p className="text-white text-sm font-semibold">{placedGuess.song}</p>
                      <p className="text-zinc-400 text-xs">{placedGuess.artist}</p>
                    </div>
                  )}
                  {!isActive && (
                    <button
                      onClick={() => onGetHint(idx)}
                      className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 transition"
                    >
                      See examples →
                    </button>
                  )}
                </div>
              ) : (
                <div key={idx} className="rounded-lg p-4 bg-zinc-800 border-2 border-zinc-700">
                  <p className="text-zinc-600 text-center">Empty slot</p>
                </div>
              );
            })}
          </div>

          {/* All Guesses */}
          {guesses.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-white font-bold mb-2">All Guesses</h3>
              {guesses.map((guess, idx) => (
                <div
                  key={guess.id}
                  className={`p-2 rounded text-sm ${
                    guess.incorrect
                      ? 'bg-red-900/30 border border-red-800'
                      : 'bg-green-900/30 border border-green-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-semibold">{guess.song}</p>
                      <p className="text-zinc-400 text-sm">{guess.artist}</p>
                    </div>
                    {!guess.incorrect && (
                      <span className="text-green-400 font-bold">
                        +{guess.basePoints}
                      </span>
                    )}
                  </div>
                  {guess.feedback && guess.feedback.length > 0 && (
                    <div className="mt-2 text-xs text-red-300">
                      {guess.feedback.map((fb, i) => (
                        <div key={i}>• {fb}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {guessesLeft === 0 && (
            <button
              onClick={onSeeScore}
              className="w-full mt-4 px-6 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg transition"
            >
              See Final Score →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
