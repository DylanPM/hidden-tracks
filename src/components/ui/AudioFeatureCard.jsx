import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AUDIO_FEATURES } from '../../constants/audioFeatures';

export function AudioFeatureCard({ feature, value, topSong, expanded, onToggle }) {
  const info = AUDIO_FEATURES[feature];
  if (!info) return null;
  
  if (value === undefined || value === null) return null;

  let displayValue, unit, barWidth;
  
  if (feature === 'tempo') {
    displayValue = Math.round(value);
    unit = ' BPM';
    barWidth = (value / 200) * 100;
  } else if (feature === 'key') {
    const keyNames = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
    displayValue = keyNames[Math.round(value) % 12];
    unit = '';
    barWidth = (Math.round(value) / 11) * 100;
  } else if (feature === 'mode') {
    displayValue = Math.round(value) === 1 ? 'Major' : 'Minor';
    unit = '';
    barWidth = Math.round(value) * 100;
  } else if (feature === 'time_signature') {
    displayValue = `${Math.round(value)}/4`;
    unit = '';
    barWidth = (Math.round(value) / 7) * 100;
  } else if (feature === 'loudness') {
    displayValue = value.toFixed(1);
    unit = ' dB';
    barWidth = ((value + 60) / 60) * 100;
  } else {
    displayValue = (value * 100).toFixed(0);
    unit = '%';
    barWidth = value * 100;
  }

  return (
    <div 
      className={`bg-zinc-800 border border-zinc-700 rounded-lg p-4 cursor-pointer transition hover:border-green-500 ${expanded ? 'col-span-2' : ''}`}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{info.icon}</span>
          <div>
            <h4 className="text-white font-semibold text-sm">{info.name}</h4>
            <p className="text-zinc-400 text-xs">{info.short}</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
      </div>
      
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-zinc-500">Your average</span>
          <span className="text-green-500 font-bold">{displayValue}{unit}</span>
        </div>
        <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-green-500"
            style={{ width: `${Math.min(100, Math.max(0, barWidth))}%` }}
          />
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-zinc-700">
          <p className="text-zinc-300 text-sm mb-3">{info.long}</p>
          {topSong?.artists && topSong?.track_name && (
            <div className="bg-zinc-900 rounded p-3">
              <p className="text-xs text-zinc-500 mb-1">Your highest {feature} track:</p>
              <p className="text-white font-semibold text-sm">{topSong.artists}</p>
              <p className="text-zinc-400 text-xs">{topSong.track_name}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}