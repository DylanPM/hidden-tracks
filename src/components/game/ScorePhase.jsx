import React from 'react';
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
export default ScorePhase;