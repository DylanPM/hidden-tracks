import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { CHALLENGE_POINTS } from '../../constants/gameConfig';
import { TrackAttributes } from './TrackAttributes';

/**
 * GuessFlair
 * Displays "flair" elements that drop from the bottom of a guessed track embed
 * Includes: challenge badge, attribute feedback, and points awarded
 */

export function GuessFlair({
  guess,
  challenge,
  revealedSeedAttributes,
  isCorrect,
  animationDelay = 0
}) {
  const [dropped, setDropped] = useState(false);

  useEffect(() => {
    // Trigger drop animation after delay
    const timer = setTimeout(() => setDropped(true), animationDelay);
    return () => clearTimeout(timer);
  }, [animationDelay]);

  // Get the 2 attributes that were revealed by the player
  const getRevealedAttributeSubset = () => {
    const revealed = Object.keys(revealedSeedAttributes).filter(
      attr => revealedSeedAttributes[attr]
    );
    // Only show first 2 revealed attributes
    return revealed.slice(0, 2);
  };

  const revealedAttrs = getRevealedAttributeSubset();
  const showAttributeFeedback = revealedAttrs.length > 0;

  return (
    <div className="space-y-1">
      {/* 1. Challenge Badge (if applicable) */}
      {challenge && (
        <div
          className={`bg-blue-900/50 border-2 border-blue-500 rounded-lg p-2 transform transition-all duration-300 ${
            dropped ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
          }`}
          style={{ transitionDelay: `${animationDelay}ms` }}
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="text-blue-300 font-bold text-sm">{challenge.name}</p>
              <p className="text-zinc-400 text-xs">{challenge.description}</p>
            </div>
            <span className="text-blue-300 text-sm font-bold">
              +{CHALLENGE_POINTS}
            </span>
          </div>
        </div>
      )}

      {/* 2. Attribute Feedback (2 revealed attributes) */}
      {showAttributeFeedback && guess.trackData && (
        <div
          className={`bg-zinc-800 rounded-lg p-2 transform transition-all duration-300 ${
            dropped ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
          }`}
          style={{ transitionDelay: `${animationDelay + 100}ms` }}
        >
          <p className="text-zinc-400 text-xs mb-2">Track Attributes:</p>
          <div className="grid grid-cols-2 gap-2">
            {revealedAttrs.map((attr) => {
              const value = guess.trackData[attr === 'tempo' ? 'tempo_norm' : attr];
              const normalizedValue =
                attr === 'tempo' || attr === 'popularity'
                  ? Math.round(value * (attr === 'tempo' ? 100 : 1))
                  : Math.round(value * 100);

              const labels = {
                danceability: ['Laid-back', 'Danceable'],
                energy: ['Calm', 'Energetic'],
                acousticness: ['Electronic', 'Acoustic'],
                valence: ['Sad', 'Happy'],
                tempo: ['Slow', 'Fast'],
                popularity: ['Niche', 'Popular'],
              };

              const [lowLabel, highLabel] = labels[attr] || ['Low', 'High'];
              const position = normalizedValue < 35 ? 'low' : normalizedValue > 65 ? 'high' : 'mid';

              return (
                <div key={attr} className="text-xs">
                  <p className="text-white font-semibold capitalize mb-1">{attr}</p>
                  <div className="flex justify-between items-center">
                    <span className={position === 'low' ? 'text-green-400 font-bold' : 'text-zinc-500'}>
                      {lowLabel}
                    </span>
                    <span className="text-white font-bold">{normalizedValue}</span>
                    <span className={position === 'high' ? 'text-green-400 font-bold' : 'text-zinc-500'}>
                      {highLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* TODO: Expandable section for 4 more attributes */}
          {/*
          <button className="w-full mt-2 flex items-center justify-center gap-1 text-zinc-400 hover:text-zinc-300 text-xs">
            <ChevronDown className="w-3 h-3" />
            <span>Show all attributes</span>
          </button>
          */}
        </div>
      )}

      {/* TODO: Narrative summary of why/why not the song made the cut */}
      {/* This will go here - narrative explanation based on attributes */}

      {/* 3. Points Awarded (if correct) */}
      {isCorrect && (
        <div
          className={`bg-green-900/30 border-2 border-green-500 rounded-lg p-2 transform transition-all duration-300 ${
            dropped ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
          }`}
          style={{ transitionDelay: `${animationDelay + 200}ms` }}
        >
          <div className="flex justify-center items-center gap-2">
            <span className="text-green-400 font-bold text-lg">
              +{guess.basePoints} points
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
