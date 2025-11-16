import React, { useEffect, useRef } from 'react';
import { Sparkles, Trophy } from 'lucide-react';
import { HINT_POINTS } from '../../constants/gameConfig';

export function ScorePhase({
  seed,
  guesses,
  challengePlacements,
  challenges,
  hintsUsed = 0,
  maxHints = 3,
  onPlayAgain,
  onReplaySeed
}) {
  const correctGuesses = guesses.filter(g => !g.incorrect);
  const scoreRef = useRef(null);

  // Calculate score breakdown
  let guessPoints = 0;
  let challengePoints = 0;

  correctGuesses.forEach(guess => {
    guessPoints += guess.basePoints;
    challengePlacements.forEach((placedGuessId, challengeIdx) => {
      if (placedGuessId === guess.id) {
        // 10 points per achieved challenge
        challengePoints += 10;
      }
    });
  });

  // COMMENTED OUT - unused hints bonus
  // const unusedHints = maxHints - hintsUsed;
  // const hintPoints = unusedHints * HINT_POINTS;
  const totalScore = guessPoints + challengePoints;

  // Check for new record (using localStorage)
  const highScoreKey = 'hiddenTracks_highScore';
  const previousHigh = parseInt(localStorage.getItem(highScoreKey) || '0');
  const isNewRecord = totalScore > previousHigh;

  useEffect(() => {
    if (isNewRecord) {
      localStorage.setItem(highScoreKey, totalScore.toString());
    }
  }, [totalScore, isNewRecord]);

  // Fire confetti once when the score screen mounts
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    (async () => {
      const { default: confetti } = await import('canvas-confetti');
      // First burst
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      // Follow-up puff
      setTimeout(() => {
        confetti({ particleCount: 60, startVelocity: 45, scalar: 0.9, origin: { y: 0.6 } });
      }, 300);
    })();
  }, []);

  // Scroll to score box on mount
  useEffect(() => {
    if (scoreRef.current) {
      scoreRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Extract Spotify track ID
  const getSpotifyId = (track) => {
    if (!track || !track.id) return '';
    const id = track.id;
    if (id.startsWith('spotify:track:')) {
      return id.split(':')[2];
    }
    return id;
  };

  const getArtistString = (track) => {
    if (!track?.artists) return 'Unknown';
    return Array.isArray(track.artists) ? track.artists.join(', ') : track.artists;
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <Sparkles className="w-16 h-16 text-green-500 mx-auto mb-4" />
          {seed && (
            <h1 className="text-2xl font-bold text-white tracking-tight mb-4">
              Here's your playlist for{' '}
              <span className="text-green-400 font-semibold">
                {seed.name} by {getArtistString(seed)}
              </span>
            </h1>
          )}
        </div>

        {/* Score Breakdown */}
        <div ref={scoreRef} className="bg-zinc-900 rounded-lg p-6 border-2 border-green-500">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-4 text-center">Your score</h1>

          <div className="space-y-3 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-base font-normal text-white leading-relaxed">
                {correctGuesses.length} correct guess{correctGuesses.length !== 1 ? 'es' : ''}
              </span>
              <span className="text-green-400 font-semibold text-base">+{guessPoints} points</span>
            </div>

            {/* COMMENTED OUT - Unused hints bonus
            {unusedHints > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-base font-normal text-white leading-relaxed">
                  {unusedHints} unused hint{unusedHints !== 1 ? 's' : ''}
                </span>
                <span className="text-green-400 font-semibold text-base">+{hintPoints} points</span>
              </div>
            )}
            */}

            {challengePoints > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-base font-normal text-white leading-relaxed">Challenge bonuses</span>
                <span className="text-green-400 font-semibold text-base">+{challengePoints} points</span>
              </div>
            )}
          </div>

          <div className="border-t-2 border-zinc-700 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold text-white">Total</span>
              <div className="flex items-center gap-3">
                <span className="text-5xl font-bold text-green-500">{Math.round(totalScore)}</span>
                {isNewRecord && (
                  <div className="flex items-center gap-1 bg-yellow-500/20 border border-yellow-500 rounded px-2 py-1">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    <span className="text-yellow-500 font-bold text-sm">New Record!</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Playlist: Seed + Correct Guesses */}
        <div className="bg-zinc-900 rounded-lg p-6">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-4">Your playlist</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Seed Track - Visually Distinguished */}
            {seed && (
              <div className="bg-zinc-800/50 p-3 rounded-lg border-2 border-green-500/30">
                <p className="text-green-400 text-base font-bold mb-2 flex items-center gap-2">
                  <span>🎵</span> Starting Track
                </p>
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
            )}

            {/* Correct Guesses */}
            {correctGuesses.map((guess) => (
              <div key={guess.id}>
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
            ))}
          </div>
        </div>

        {/* TODO: Social share element will go here */}
        {/*
        <div className="bg-zinc-900 rounded-lg p-6 text-center">
          <h3 className="text-white font-bold mb-3">Share Your Score</h3>
          <button className="px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded transition">
            Share on Twitter
          </button>
        </div>
        */}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {onReplaySeed && seed && (
            <button
              onClick={() => onReplaySeed(seed)}
              className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white px-8 py-4 rounded-lg font-bold text-lg transition"
            >
              Try this song again
            </button>
          )}
          <button
            onClick={onPlayAgain}
            className="flex-1 bg-green-500 text-black px-8 py-4 rounded-lg font-bold text-lg hover:bg-green-400 transition"
          >
            Return to map
          </button>
        </div>
      </div>
    </div>
  );
} 