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
    description: 'Does it make you want to move?',
    lowLabel: 'Laid-back',
    highLabel: 'Danceable',
    color: '#9333EA',
  },
  energy: {
    icon: Zap,
    label: 'Energy',
    description: 'How intense does it feel?',
    lowLabel: 'Calm',
    highLabel: 'Energetic',
    color: '#DC2626',
  },
  acousticness: {
    icon: Radio,
    label: 'Acousticness',
    description: 'Is it produced or performed?',
    lowLabel: 'Electronic',
    highLabel: 'Acoustic',
    color: '#16A34A',
  },
  valence: {
    icon: Smile,
    label: 'Valence',
    description: 'What\u2019s the mood?',
    lowLabel: 'Sad',
    highLabel: 'Happy',
    color: '#2563EB',
  },
  tempo: {
    icon: Gauge,
    label: 'Tempo',
    description: 'How fast is it?',
    lowLabel: 'Slow',
    highLabel: 'Fast',
    color: '#EAB308',
  },
  popularity: {
    icon: TrendingUp,
    label: 'Popularity',
    description: 'How well-known is it?',
    lowLabel: 'Niche',
    highLabel: 'Popular',
    color: '#EC4899',
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

  const clampPosition = (value) => {
    // Clamp circle position so it doesn't go off-screen
    // Circle is w-8 (32px), so radius is 16px. Clamp between 5% and 95%
    if (value === null) return 50;
    return Math.min(Math.max(value, 5), 95);
  };

  return (
    <div className="bg-zinc-900 rounded-lg p-3">
      <h3 className="text-white font-bold mb-2 text-xl">Starting Track Attributes</h3>
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
              className={`bg-zinc-800 rounded p-3 ${
                isClickable ? 'cursor-pointer hover:bg-zinc-700 transition' : ''
              } ${shouldPulse ? 'animate-pulse' : ''}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-6 h-6" style={{ color: config.color }} />
                <span className="text-white text-lg font-semibold">{config.label}</span>
              </div>
              <p className="text-zinc-300 text-base mb-4">{config.description}</p>

              {/* Number line visualization with circles */}
              <div className="flex items-center justify-between gap-1">
                {/* Low label circle */}
                <div className={`flex-shrink-0 w-16 h-16 rounded-full border-2 flex items-center justify-center text-center transition ${
                  isRevealed && position === 'low'
                    ? `border-[${config.color}] text-white font-bold`
                    : 'border-zinc-600 text-zinc-400'
                }`}
                style={{
                  backgroundColor: isRevealed && position === 'low' ? config.color : 'transparent'
                }}>
                  <span className="text-xs leading-tight px-1">{config.lowLabel}</span>
                </div>

                {/* Connecting line (left half) */}
                <div className="flex-1 h-0.5 bg-zinc-600" />

                {/* Center number circle */}
                <div className={`flex-shrink-0 w-14 h-14 rounded-full border-2 flex items-center justify-center transition ${
                  isRevealed
                    ? `border-[${config.color}] text-white font-bold text-lg`
                    : 'border-zinc-600 text-zinc-600 text-lg'
                }`}
                style={{
                  backgroundColor: isRevealed ? config.color : 'transparent'
                }}>
                  {isRevealed && normalizedValue !== null ? normalizedValue : '???'}
                </div>

                {/* Connecting line (right half) */}
                <div className="flex-1 h-0.5 bg-zinc-600" />

                {/* High label circle */}
                <div className={`flex-shrink-0 w-16 h-16 rounded-full border-2 flex items-center justify-center text-center transition ${
                  isRevealed && position === 'high'
                    ? `border-[${config.color}] text-white font-bold`
                    : 'border-zinc-600 text-zinc-400'
                }`}
                style={{
                  backgroundColor: isRevealed && position === 'high' ? config.color : 'transparent'
                }}>
                  <span className="text-xs leading-tight px-1">{config.highLabel}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
