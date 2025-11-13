import React, { useEffect, useRef } from 'react';
import { Sparkles, Trophy } from 'lucide-react';
import { HINT_POINTS, CHALLENGE_POINTS } from '../../constants/gameConfig';

export function ScorePhase({
  seed,
  guesses,
  challengePlacements,
  challenges,
  hintsUsed = 0,
  maxHints = 3,
  onPlayAgain
}) {
  const correctGuesses = guesses.filter(g => !g.incorrect);

  // Calculate score breakdown
  let guessPoints = 0;
  let challengePoints = 0;

  correctGuesses.forEach(guess => {
    guessPoints += guess.basePoints;
    challengePlacements.forEach((placedGuessId, challengeIdx) => {
      if (placedGuessId === guess.id && guess.challengeScores[challengeIdx]) {
        challengePoints += guess.challengeScores[challengeIdx];
      }
    });
  });

  const unusedHints = maxHints - hintsUsed;
  const hintPoints = unusedHints * HINT_POINTS;
  const totalScore = guessPoints + hintPoints + challengePoints;

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
          <h1 className="text-4xl font-bold text-white mb-2">Listen up!</h1>
          {seed && (
            <p className="text-xl text-zinc-300">
              Here's your playlist for{' '}
              <span className="text-green-400 font-semibold">
                {seed.name} by {getArtistString(seed)}
              </span>
            </p>
          )}
        </div>

        {/* Score Breakdown */}
        <div className="bg-zinc-900 rounded-lg p-6 border-2 border-green-500">
          <h2 className="text-2xl font-bold text-white mb-4 text-center">Your Score</h2>

          <div className="space-y-3 mb-4">
            <div className="flex justify-between items-center text-lg">
              <span className="text-zinc-300">
                {correctGuesses.length} correct guess{correctGuesses.length !== 1 ? 'es' : ''}
              </span>
              <span className="text-green-400 font-bold">+{guessPoints} points</span>
            </div>

            {unusedHints > 0 && (
              <div className="flex justify-between items-center text-lg">
                <span className="text-zinc-300">
                  {unusedHints} unused hint{unusedHints !== 1 ? 's' : ''}
                </span>
                <span className="text-green-400 font-bold">+{hintPoints} points</span>
              </div>
            )}

            {challengePoints > 0 && (
              <div className="flex justify-between items-center text-lg">
                <span className="text-zinc-300">Challenge bonuses</span>
                <span className="text-green-400 font-bold">+{challengePoints} points</span>
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
          <h2 className="text-2xl font-bold text-white mb-4">Your Playlist</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Seed Track */}
            {seed && (
              <div>
                <p className="text-green-400 text-sm font-semibold mb-2">Starting Track</p>
                <iframe
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
                  src={`https://open.spotify.com/embed/track/${getSpotifyId({ id: guess.id })}?utm_source=generator`}
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

        {/* Return to Map */}
        <button
          onClick={onPlayAgain}
          className="w-full bg-green-500 text-black px-8 py-4 rounded-lg font-bold text-lg hover:bg-green-400 transition"
        >
          Click here to return to the map and pick a new song
        </button>
      </div>
    </div>
  );
} 