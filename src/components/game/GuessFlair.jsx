import React, { useState, useEffect } from 'react';
import { ArrowDown } from 'lucide-react';
import { CHALLENGE_POINTS } from '../../constants/gameConfig';

/**
 * GuessFlair
 * Displays "flair" elements that drop from the bottom of a guessed track embed
 * Includes: challenge badge, attribute feedback with smart selection, and points awarded
 */

// Attribute labels for display
const ATTRIBUTE_LABELS = {
  danceability: { lowLabel: 'Laid-back', highLabel: 'Danceable' },
  energy: { lowLabel: 'Calm', highLabel: 'Energetic' },
  acousticness: { lowLabel: 'Electronic', highLabel: 'Acoustic' },
  valence: { lowLabel: 'Sad', highLabel: 'Happy' },
  tempo: { lowLabel: 'Slow', highLabel: 'Fast' },
  popularity: { lowLabel: 'Niche', highLabel: 'Popular' },
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

    // Priority 2: Player-revealed attributes
    const revealedAttrs = Object.keys(revealedSeedAttributes).filter(
      attr => revealedSeedAttributes[attr]
    );
    if (revealedAttrs.length >= 2) {
      return revealedAttrs.slice(0, 2);
    } else if (revealedAttrs.length === 1) {
      // Use the revealed one + most similar/different
      const remaining = allAttributes.filter(a => !revealedAttrs.includes(a));
      const sorted = sortAttributesBySimilarity(remaining, guess.trackData, seed, isCorrect);
      return [revealedAttrs[0], sorted[0]];
    }

    // Priority 3: Most similar (correct) or most different (incorrect)
    const sorted = sortAttributesBySimilarity(allAttributes, guess.trackData, seed, isCorrect);
    return sorted.slice(0, 2);
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

    // Use tempo_norm for tempo, regular value for others
    if (attr === 'tempo') {
      return track.tempo_norm ?? null;
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

    if (attr === 'tempo' || attr === 'popularity') {
      return Math.round(value * (attr === 'tempo' ? 100 : 100));
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

  return (
    <div className="space-y-2 relative">
      {/* 1. Challenge Badge (if applicable) */}
      {challenge && (
        <>
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
          {/* Visual connector: arrow from challenge to attributes */}
          {showAttributeFeedback && (
            <div className="flex justify-center">
              <ArrowDown className="w-4 h-4 text-zinc-600" />
            </div>
          )}
        </>
      )}

      {/* 2. Attribute Feedback (2 colored boxes) */}
      {showAttributeFeedback && guess.trackData && (
        <>
          <div
            className={`transform transition-all duration-300 ${
              dropped ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
            }`}
            style={{ transitionDelay: `${animationDelay + (challenge ? 100 : 0)}ms` }}
          >
            <div className="grid grid-cols-2 gap-2">
              {selectedAttrs.map((attr) => {
                const value = getAttributeValue(guess.trackData, attr);
                const displayValue = formatAttributeValue(attr, value);
                const position = getPosition(value);
                const labels = ATTRIBUTE_LABELS[attr];

                // Color based on correct/incorrect and position
                const getBgColor = () => {
                  if (isCorrect) {
                    // Correct guess - green tones
                    if (position === 'low') return 'bg-emerald-900/40 border-emerald-600';
                    if (position === 'high') return 'bg-green-900/40 border-green-500';
                    return 'bg-green-900/30 border-green-600';
                  } else {
                    // Incorrect guess - red tones
                    if (position === 'low') return 'bg-red-900/40 border-red-600';
                    if (position === 'high') return 'bg-orange-900/40 border-orange-600';
                    return 'bg-red-900/30 border-red-700';
                  }
                };

                return (
                  <div
                    key={attr}
                    className={`rounded-lg p-2 border-2 ${getBgColor()}`}
                  >
                    <p className="text-white font-semibold capitalize text-sm mb-1">
                      {attr}
                    </p>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className={position === 'low' ? 'text-white font-bold' : 'text-zinc-500'}>
                        {labels.lowLabel}
                      </span>
                      <span className={position === 'high' ? 'text-white font-bold' : 'text-zinc-500'}>
                        {labels.highLabel}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-white font-bold text-lg">
                        {displayValue}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Visual connector: arrow from attributes to points */}
          {isCorrect && (
            <div className="flex justify-center">
              <ArrowDown className="w-4 h-4 text-zinc-600" />
            </div>
          )}
        </>
      )}

      {/* 3. Points Awarded (if correct) */}
      {isCorrect && (
        <div
          className={`bg-green-900/30 border-2 border-green-500 rounded-lg p-2 transform transition-all duration-300 ${
            dropped ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
          }`}
          style={{ transitionDelay: `${animationDelay + (challenge ? 200 : showAttributeFeedback ? 100 : 0)}ms` }}
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
