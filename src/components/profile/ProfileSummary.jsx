import React, { useState } from 'react';
import { AudioFeatureCard } from '../ui/AudioFeatureCard';

export function ProfileSummary({ profile, onStart }) {
  const [expandedFeature, setExpandedFeature] = useState(null);

  if (!profile || !profile.audioFeatureAverages) {
    return (
      <div className="min-h-screen bg-black p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl font-bold mb-4">Error loading profile</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-green-500 text-black px-6 py-3 rounded-full font-bold hover:bg-green-400 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold text-green-500 mb-4">{profile.descriptor}</h1>
          <p className="text-zinc-400 text-sm mb-6">
            {profile.source === 'spotify' && 'Based on your Spotify listening history'}
            {profile.source === 'custom' && 'Based on your taste preferences'}
            {profile.source === 'preset' && 'A curated music profile'}
          </p>
          
          {profile.referenceTracks && profile.referenceTracks.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 max-w-2xl mx-auto">
              <p className="text-zinc-500 text-xs mb-2">Songs analyzed:</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {profile.referenceTracks.slice(0, 10).map((track, idx) => (
                  <p key={idx} className="text-zinc-400 text-xs">
                    {track?.artists || 'Unknown'} - {track?.track_name || 'Unknown'}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        <h2 className="text-2xl font-bold text-white mb-4 text-center">Your Audio DNA</h2>
        <p className="text-zinc-400 text-center text-sm mb-6">Click any attribute to learn more about how Spotify analyzes your music</p>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {Object.entries(profile.audioFeatureAverages || {}).map(([feature, value]) => {
            if (value === undefined || value === null) return null;
            
            const topSong = profile.topExamples?.[feature];
            
            return (
              <AudioFeatureCard
                key={feature}
                feature={feature}
                value={value}
                topSong={topSong}
                expanded={expandedFeature === feature}
                onToggle={() => setExpandedFeature(expandedFeature === feature ? null : feature)}
              />
            );
          })}
        </div>

        <button
          onClick={onStart}
          className="w-full bg-green-500 text-black py-4 rounded-full font-bold text-lg hover:bg-green-400 transition"
        >
          Start Playing
        </button>
      </div>
    </div>
  );
}