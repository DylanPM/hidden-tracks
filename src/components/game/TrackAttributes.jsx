import React from 'react';
import { Music, Zap, Radio, Smile, Gauge, TrendingUp } from 'lucide-react';

/**
 * TrackAttributes
 * Displays 6 key audio attributes for a track in a 3x2 grid
 * Values can be hidden (???) or revealed through gameplay
 */

const ATTRIBUTE_CONFIG = {
  danceability: {
    icon: Music,
    label: 'Danceability',
    description: 'Rhythmic groove and beat strength',
    lowLabel: 'Laid-back',
    highLabel: 'Danceable',
  },
  energy: {
    icon: Zap,
    label: 'Energy',
    description: 'Intensity and activity level',
    lowLabel: 'Calm',
    highLabel: 'Energetic',
  },
  acousticness: {
    icon: Radio,
    label: 'Acousticness',
    description: 'Presence of acoustic vs electronic elements',
    lowLabel: 'Electronic',
    highLabel: 'Acoustic',
  },
  valence: {
    icon: Smile,
    label: 'Valence',
    description: 'Musical positivity and mood',
    lowLabel: 'Sad',
    highLabel: 'Happy',
  },
  tempo: {
    icon: Gauge,
    label: 'Tempo',
    description: 'Speed and pace of the track',
    lowLabel: 'Slow',
    highLabel: 'Fast',
  },
  popularity: {
    icon: TrendingUp,
    label: 'Popularity',
    description: 'How well-known the track is',
    lowLabel: 'Niche',
    highLabel: 'Popular',
  },
};

export function TrackAttributes({
  track,
  revealedAttributes = {},
  onAttributeClick,
  clickableAttributes = false,
  pulseUnrevealed = false
}) {
  const attributes = ['danceability', 'energy', 'acousticness', 'valence', 'tempo', 'popularity'];

  const getAttributeValue = (attr) => {
    if (!track) return null;

    // Use tempo_norm for tempo, regular value for others
    if (attr === 'tempo') {
      return track.tempo_norm ?? track.tempo;
    }
    return track[attr];
  };

  const normalizeValue = (attr, value) => {
    if (value === null || value === undefined) return null;

    // Tempo is already normalized (tempo_norm), others need to be scaled to 0-100
    if (attr === 'tempo') {
      return Math.round(value * 100);
    }

    // Popularity is already 0-100
    if (attr === 'popularity') {
      return Math.round(value);
    }

    // Other attributes are 0-1, scale to 0-100
    return Math.round(value * 100);
  };

  const getIndicatorPosition = (normalizedValue) => {
    // Returns which side should be highlighted: 'low', 'mid', or 'high'
    if (normalizedValue < 35) return 'low';
    if (normalizedValue > 65) return 'high';
    return 'mid';
  };

  return (
    <div className="bg-zinc-900 rounded-lg p-3">
      <h3 className="text-white font-bold mb-2 text-base">Track Attributes</h3>
      <div className="grid grid-cols-2 gap-3">
        {attributes.map((attr) => {
          const config = ATTRIBUTE_CONFIG[attr];
          const Icon = config.icon;
          const rawValue = getAttributeValue(attr);
          const isRevealed = revealedAttributes[attr];
          const normalizedValue = rawValue !== null ? normalizeValue(attr, rawValue) : null;
          const position = normalizedValue !== null ? getIndicatorPosition(normalizedValue) : null;

          const isClickable = clickableAttributes && !isRevealed && rawValue !== null;
          const shouldPulse = pulseUnrevealed && !isRevealed && rawValue !== null;

          return (
            <div
              key={attr}
              onClick={() => isClickable && onAttributeClick?.(attr)}
              className={`bg-zinc-800 rounded p-2 ${
                isClickable ? 'cursor-pointer hover:bg-zinc-700 transition' : ''
              } ${shouldPulse ? 'animate-pulse' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-green-400" />
                <span className="text-white text-sm font-semibold">{config.label}</span>
              </div>
              <p className="text-zinc-400 text-xs mb-2">{config.description}</p>

              <div className="flex items-center justify-between text-xs mb-1">
                <span className={`${
                  isRevealed && position === 'low'
                    ? 'text-green-400 font-bold'
                    : 'text-zinc-500'
                }`}>
                  {config.lowLabel}
                </span>
                <span className={`text-lg font-bold ${
                  isRevealed ? 'text-white' : 'text-zinc-600'
                }`}>
                  {isRevealed && normalizedValue !== null ? normalizedValue : '???'}
                </span>
                <span className={`${
                  isRevealed && position === 'high'
                    ? 'text-green-400 font-bold'
                    : 'text-zinc-500'
                }`}>
                  {config.highLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
