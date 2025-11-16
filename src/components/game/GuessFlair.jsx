import React, { useState, useEffect } from 'react';
import { ArrowDown } from 'lucide-react';
import { CHALLENGE_POINTS } from '../../constants/gameConfig';

/**
 * GuessFlair
 * Displays "flair" elements that drop from the bottom of a guessed track embed
 * Includes: challenge badge, attribute feedback with smart selection, and points awarded
 */

// Attribute configuration for display
const ATTRIBUTE_CONFIG = {
  danceability: { lowLabel: 'Laid-back', highLabel: 'Danceable', color: '#9333EA' },
  energy: { lowLabel: 'Calm', highLabel: 'Energetic', color: '#DC2626' },
  acousticness: { lowLabel: 'Electronic', highLabel: 'Acoustic', color: '#16A34A' },
  valence: { lowLabel: 'Sad', highLabel: 'Happy', color: '#2563EB' },
  tempo: { lowLabel: 'Slow', highLabel: 'Fast', color: '#EAB308' },
  popularity: { lowLabel: 'Niche', highLabel: 'Popular', color: '#EC4899' },
};

// Determine which attributes a challenge tests
const getChallengeAttributes = (challenge) => {
  if (!challenge) return [];

  const attrMap = {
    'mega-hit': ['popularity'],
    'deep-cut': ['popularity'],
    'cult-classic': ['popularity'],
    'high-energy': ['energy'],
    'chill-vibes': ['energy'],
    'dance-floor': ['danceability'],
    'feel-good': ['valence'],
    'melancholy': ['valence'],
    'unplugged': ['acousticness'],
    'fast-and-furious': ['tempo'],
    'slow-burn': ['tempo'],
  };

  return attrMap[challenge.id] || [];
};

export function GuessFlair({
  guess,
  seed,
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

  // Smart attribute selection with 3-tier priority system
  const selectAttributesForFlair = () => {
    if (!guess.trackData || !seed) return [];

    const allAttributes = ['danceability', 'energy', 'acousticness', 'valence', 'tempo', 'popularity'];

    // Priority 1: Challenge-linked attributes
    if (challenge) {
      const challengeAttrs = getChallengeAttributes(challenge);
      if (challengeAttrs.length > 0) {
        // If challenge has 1 attr, we need 1 more; if 2+, just use first 2
        if (challengeAttrs.length >= 2) {
          return challengeAttrs.slice(0, 2);
        } else {
          // Fill remaining slot with most similar/different attribute
          const remaining = allAttributes.filter(a => !challengeAttrs.includes(a));
          const sorted = sortAttributesBySimilarity(remaining, guess.trackData, seed, isCorrect);
          return [...challengeAttrs, sorted[0]];
        }
      }
    }

    // Priority 2: Random selection from all 6 attributes
    // NOTE: Previously this used player-revealed attributes (Priority 2) and
    // most similar/different attributes (Priority 3), but that wasn't working well.
    // Now we just randomly pick 2 attributes from the 6 available.

    // Use guess ID as seed for deterministic randomness (same guess = same attributes)
    const seedValue = guess.id ? String(guess.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : Math.random();
    const shuffled = [...allAttributes].sort(() => {
      // Deterministic shuffle based on guess ID
      return (seedValue % 2 === 0) ? -1 : 1;
    });

    // Simple Fisher-Yates shuffle with deterministic seed
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(((seedValue + i) * 9301 + 49297) % 233280 / 233280 * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, 2);
  };

  // Sort attributes by similarity to seed
  const sortAttributesBySimilarity = (attributes, guessTrack, seedTrack, showSimilar) => {
    const similarities = attributes.map(attr => {
      const guessValue = getAttributeValue(guessTrack, attr);
      const seedValue = getAttributeValue(seedTrack, attr);

      if (guessValue === null || seedValue === null) {
        return { attr, similarity: -1 }; // Invalid data goes to end
      }

      // Calculate similarity (0 = completely different, 1 = identical)
      const similarity = 1 - Math.abs(guessValue - seedValue);
      return { attr, similarity };
    });

    // Sort by similarity (descending for similar, ascending for different)
    similarities.sort((a, b) => {
      if (showSimilar) {
        return b.similarity - a.similarity; // Most similar first
      } else {
        return a.similarity - b.similarity; // Most different first
      }
    });

    return similarities.map(s => s.attr);
  };

  // Get normalized attribute value (0-1 scale)
  const getAttributeValue = (track, attr) => {
    if (!track) return null;

    // Use tempo_norm for tempo, or normalize from raw tempo (BPM)
    if (attr === 'tempo') {
      if (track.tempo_norm !== undefined && track.tempo_norm !== null) {
        return track.tempo_norm;
      }
      // Fallback: normalize raw tempo (assume range 0-200 BPM)
      if (track.tempo !== undefined && track.tempo !== null) {
        return Math.min(Math.max(track.tempo / 200, 0), 1);
      }
      return null;
    }

    // Popularity is 0-100, normalize to 0-1
    if (attr === 'popularity') {
      const pop = track[attr];
      return pop !== undefined && pop !== null ? pop / 100 : null;
    }

    // Other attributes are already 0-1
    const value = track[attr];
    return value !== undefined && value !== null ? value : null;
  };

  const selectedAttrs = selectAttributesForFlair();
  const showAttributeFeedback = selectedAttrs.length > 0;

  // Format attribute value for display
  const formatAttributeValue = (attr, value) => {
    if (value === null) return '?';

    if (attr === 'tempo') {
      // Tempo: map 0-1 range to 70-140 BPM
      return value < 10 ? Math.round(70 + (value * 70)) : Math.round(value);
    }
    if (attr === 'popularity') {
      return Math.round(value * 100);
    }
    return Math.round(value * 100);
  };

  // Determine position (low/mid/high) for styling
  const getPosition = (value) => {
    if (value === null) return 'mid';
    const normalized = value * 100;
    if (normalized < 35) return 'low';
    if (normalized > 65) return 'high';
    return 'mid';
  };

  // Clamp circle position so it doesn't go off-screen
  // Circle is w-8 (32px), so radius is 16px. Clamp between 5% and 95%
  const clampPosition = (value) => {
    if (value === null || value === '?') return 50;
    const num = typeof value === 'number' ? value : parseFloat(value);
    return Math.min(Math.max(num, 5), 95);
  };

  return (
    <div className="space-y-0 relative">
      {/* 1. Attribute Feedback (2 half-width boxes with connectors from embed) */}
      {showAttributeFeedback && guess.trackData && (
        <>
          {/* Connector lines from embed to attributes - extend upward to touch embed */}
          <div className="flex justify-center gap-2 h-6 -mt-3">
            <div className="w-1/2 flex justify-center">
              <div className="w-0.5 h-full bg-zinc-600" />
            </div>
            <div className="w-1/2 flex justify-center">
              <div className="w-0.5 h-full bg-zinc-600" />
            </div>
          </div>

          <div
            className={`transform transition-all duration-300 ${
              dropped ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
            }`}
            style={{ transitionDelay: `${animationDelay}ms` }}
          >
            <div className="grid grid-cols-2 gap-2">
              {selectedAttrs.map((attr) => {
                const value = getAttributeValue(guess.trackData, attr);
                const displayValue = formatAttributeValue(attr, value);
                const position = getPosition(value);
                const config = ATTRIBUTE_CONFIG[attr];

                // Color based on correct/incorrect
                const getBgColor = () => {
                  if (isCorrect) {
                    return 'bg-green-900/24 border-green-700';
                  } else {
                    return 'bg-zinc-800 border-zinc-700';
                  }
                };

                return (
                  <div
                    key={attr}
                    className={`rounded-lg p-2 border-2 ${getBgColor()}`}
                  >
                    <p className="text-white font-semibold capitalize text-sm mb-3">
                      {attr}
                    </p>

                    {/* Number line visualization with positioned circle */}
                    <div className="relative">
                      {/* Label row */}
                      <div className="flex justify-between items-center mb-1 px-1">
                        <span className={`text-[10px] transition ${
                          position === 'low' ? 'font-bold' : ''
                        }`}
                        style={{
                          color: position === 'low' ? config.color : '#a1a1aa'
                        }}>
                          {config.lowLabel}
                        </span>
                        <span className={`text-[10px] transition ${
                          position === 'high' ? 'font-bold' : ''
                        }`}
                        style={{
                          color: position === 'high' ? config.color : '#a1a1aa'
                        }}>
                          {config.highLabel}
                        </span>
                      </div>

                      {/* Line with positioned circle */}
                      <div className="relative h-8 flex items-center px-1">
                        {/* Background line */}
                        <div className="absolute left-1 right-1 h-0.5 bg-zinc-600" />

                        {/* Number circle - positioned based on value */}
                        <div
                          className="absolute flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition text-xs font-semibold"
                          style={{
                            left: `calc(0.25rem + ${clampPosition(displayValue)}% - 0.25rem)`,
                            transform: 'translateX(-50%)',
                            backgroundColor: config.color,
                            color: 'white'
                          }}
                        >
                          {displayValue}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* 2. Challenge Badge (if applicable) - 1/2 width cards: description + points */}
      {challenge && (
        <>
          {/* Connector lines from attributes to challenge */}
          <div className="flex justify-center gap-2 h-3">
            <div className="w-1/2 flex justify-center">
              <div className="w-0.5 h-full bg-zinc-600" />
            </div>
            <div className="w-1/2 flex justify-center">
              <div className="w-0.5 h-full bg-zinc-600" />
            </div>
          </div>

          <div
            className={`grid grid-cols-2 gap-2 transform transition-all duration-300 ${
              dropped ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
            }`}
            style={{ transitionDelay: `${animationDelay + (showAttributeFeedback ? 100 : 0)}ms` }}
          >
            {/* Left box: Challenge name and description */}
            <div className="bg-blue-900/50 border-2 border-blue-500 rounded-lg p-3">
              <p className="text-blue-300 font-bold text-base mb-1">{challenge.name}</p>
              <p className="text-zinc-300 text-sm">{challenge.description}</p>
            </div>

            {/* Right box: Points - Spotify treatment */}
            <div className="bg-blue-900/50 border-2 border-blue-500 rounded-lg p-3 flex items-center justify-center">
              <span className="text-blue-300 text-3xl font-bold">
                +{CHALLENGE_POINTS}
              </span>
            </div>
          </div>
        </>
      )}

      {/* 3. Points/Feedback Banner - hangs below challenge or attributes */}
      {isCorrect ? (
        <>
          {/* Two connector lines from attributes to points */}
          <div className="flex justify-center gap-2 h-3">
            <div className="w-1/2 flex justify-center">
              <div className="w-0.5 h-full bg-zinc-600" />
            </div>
            <div className="w-1/2 flex justify-center">
              <div className="w-0.5 h-full bg-zinc-600" />
            </div>
          </div>

          <div
            className={`bg-green-900/24 border-2 border-green-600 rounded-lg p-3 transform transition-all duration-300 ${
              dropped ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
            }`}
            style={{ transitionDelay: `${animationDelay + (challenge ? 200 : showAttributeFeedback ? 100 : 0)}ms` }}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-green-500 font-bold text-base">
                On the playlist!
              </span>
              <span className="text-green-500 font-bold text-xl">
                +{guess.basePoints} points
              </span>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Two connector lines from attributes to feedback */}
          <div className="flex justify-center gap-2 h-3">
            <div className="w-1/2 flex justify-center">
              <div className="w-0.5 h-full bg-zinc-600" />
            </div>
            <div className="w-1/2 flex justify-center">
              <div className="w-0.5 h-full bg-zinc-600" />
            </div>
          </div>

          <div
            className={`bg-red-900/24 border-2 border-red-600 rounded-lg p-3 transform transition-all duration-300 ${
              dropped ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
            }`}
            style={{ transitionDelay: `${animationDelay + (showAttributeFeedback ? 100 : 0)}ms` }}
          >
            <div className="text-center">
              <span className="text-red-500 font-bold text-lg block mb-2">
                Not on playlist
              </span>
              {/* REMOVED - Feedback is now in intel section
              {guess.feedback && guess.feedback.length > 0 && (
                <div className="text-sm text-red-300 space-y-1">
                  {guess.feedback.map((fb, i) => (
                    <div key={i}>{fb}</div>
                  ))}
                </div>
              )}
              */}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
