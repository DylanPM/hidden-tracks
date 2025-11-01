import React from 'react';
import { HINT_POINTS, CHALLENGE_POINTS } from '../../constants/gameConfig';

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

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Two Column Layout: Seed+Hints | Guess Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          
          {/* LEFT: Seed Info and Hints */}
          <div className="space-y-4">
            {/* Seed Track */}
            {seed && (
              <div className="bg-zinc-900 rounded-lg p-4 border-2 border-green-500">
                <h2 className="text-green-400 font-bold mb-2">Seed Track</h2>
                <p className="text-white text-lg font-bold">{seed.name}</p>
                <p className="text-zinc-400">{getArtistString(seed)}</p>
              </div>
            )}

            {/* Seed Hints */}
            <div className="bg-zinc-900 rounded-lg p-4">
              <h3 className="text-white font-bold mb-2">Seed Hints</h3>
              <p className="text-zinc-400 text-sm mb-3">
                Trade points for clues about the seed's audio properties
              </p>
              <div className="space-y-2">
                {[0, 1, 2].map((idx) => (
                  <button
                    key={idx}
                    onClick={() => onRevealHint(idx)}
                    disabled={revealedHints[idx]}
                    className={`w-full text-left px-4 py-3 rounded transition ${
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
          </div>

          {/* RIGHT: Guess Cards (Spotify Embeds) */}
          <div>
            <div className="bg-zinc-900 rounded-lg p-4 mb-4">
              <h3 className="text-white font-bold mb-1">Make Your Guess</h3>
              <p className="text-zinc-400 text-sm">Press play to preview, then click the card to select</p>
            </div>

            {errorMessage && (
              <div className="bg-red-900 border border-red-600 text-white px-4 py-2 rounded mb-4">
                {errorMessage}
              </div>
            )}

            <div className="space-y-3">
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

                    {/* Overlay - click anywhere to select */}
                    {/* Play button is at left side, we'll leave that area clear */}
                    <div 
                      onClick={() => onGuess(track)}
                      className="absolute inset-0 cursor-pointer hover:ring-2 hover:ring-green-500 rounded-lg transition"
                      title="Click to select this track"
                    >
                      {/* Invisible but captures clicks except in play button area */}
                      <div className="absolute inset-0">
                        {/* Right side - clickable */}
                        <div 
                          className="absolute right-0 top-0 bottom-0 bg-transparent"
                          style={{ left: '80px' }}
                        />
                        {/* Top strip - clickable */}
                        <div 
                          className="absolute left-0 right-0 top-0 bg-transparent"
                          style={{ height: '40px' }}
                        />
                        {/* Bottom strip - clickable */}
                        <div 
                          className="absolute left-0 right-0 bottom-0 bg-transparent"
                          style={{ height: '40px' }}
                        />
                      </div>
                    </div>

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
                className="w-full mt-4 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition"
              >
                ↻ Refresh Options
              </button>
            )}
          </div>
        </div>

        {/* Challenge Slots + Playlist */}
        <div className="bg-zinc-900 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white text-xl font-bold">Your Playlist</h2>
            <div className="text-zinc-400">
              {guesses.length} guesses · {guessesLeft} remaining
            </div>
          </div>

          <p className="text-zinc-400 text-sm mb-4">
            Fill challenge slots with correct guesses that match the criteria
          </p>

          {/* Challenge Slots (Top 3) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {challenges.map((challenge, idx) => {
              const isActive = isChallengeActive(idx);
              const placedGuessId = challengePlacements[idx];
              const placedGuess = placedGuessId
                ? guesses.find(g => g.id === placedGuessId)
                : null;

              return challenge ? (
                <div
                  key={idx}
                  className={`rounded-lg p-4 border-2 transition ${
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
                  className={`p-3 rounded ${
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
              className="w-full mt-6 px-6 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg transition"
            >
              See Final Score →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
