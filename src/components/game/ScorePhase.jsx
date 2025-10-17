import React, { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';



export function ScorePhase({ guesses, challengePlacements, challenges, onPlayAgain }) {
  const correctGuesses = guesses.filter(g => !g.incorrect);
  let totalScore = 0;
  
  correctGuesses.forEach(guess => {
    totalScore += guess.basePoints;
    challengePlacements.forEach((placedGuessId, challengeIdx) => {
      if (placedGuessId === guess.id) {
        totalScore += guess.challengeScores[challengeIdx];
      }
    });
  });

  // Fire confetti once when the score screen mounts.
// The ref prevents double-firing in React Strict Mode (dev only).
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

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-zinc-900 rounded-lg p-8 text-center mb-6 border border-zinc-800">
          <Sparkles className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-4xl font-bold text-white mb-3">Final Score</h2>
          <p className="text-7xl font-bold text-green-500 mb-2">{Math.round(totalScore)}</p>
          <p className="text-zinc-300">You made {correctGuesses.length} correct guesses out of {guesses.length} total</p>
        </div>

        <button
          onClick={onPlayAgain}
          className="w-full bg-green-500 text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-green-400 transition"
        >
          Play Again
        </button>
      </div>
    </div>
  );
} 