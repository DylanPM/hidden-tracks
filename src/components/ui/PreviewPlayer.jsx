import React, { useState } from 'react';
import { Play, X } from 'lucide-react';

export function PreviewPlayer({ song, compact = false }) {
  const [showEmbed, setShowEmbed] = useState(false);
  
  if (!song) {
    return null;
  }

  // Extract track ID from URI if needed
  const getTrackId = () => {
    if (song.track_id && !song.track_id.startsWith('spotify:')) {
      return song.track_id;
    }
    if (song.uri) {
      return song.uri.split(':').pop();
    }
    if (song.id) {
      return song.id;
    }
    return null;
  };

  const trackId = getTrackId();
  
  if (!trackId) {
    console.warn('PreviewPlayer: No valid track ID found', song);
    return null;
  }

  // For compact mode (inline button)
  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowEmbed(!showEmbed);
          }}
          className="w-10 h-10 bg-green-500 hover:bg-green-600 text-white rounded-full transition-all duration-200 flex items-center justify-center"
          aria-label={showEmbed ? "Close preview" : "Play preview"}
        >
          {showEmbed ? (
            <X className="w-5 h-5" fill="currentColor" />
          ) : (
            <Play className="w-5 h-5" fill="currentColor" />
          )}
        </button>
        
        {showEmbed && (
          <div 
            onClick={(e) => e.stopPropagation()}
            className="absolute top-full left-0 mt-2 z-50 bg-black rounded-lg shadow-2xl border border-zinc-800"
            style={{ width: '300px' }}
          >
            <iframe
              src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          </div>
        )}
      </div>
    );
  }

  // For regular mode (larger button)
  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowEmbed(!showEmbed);
        }}
        className="w-12 h-12 bg-green-500 hover:bg-green-600 text-white rounded-full transition-all duration-200 flex items-center justify-center"
        aria-label={showEmbed ? "Close preview" : "Play preview"}
      >
        {showEmbed ? (
          <X className="w-6 h-6" fill="currentColor" />
        ) : (
          <Play className="w-6 h-6" fill="currentColor" />
        )}
      </button>
      
      {showEmbed && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute top-full left-0 mt-2 z-50 bg-black rounded-lg shadow-2xl border border-zinc-800"
          style={{ width: '300px' }}
        >
          <iframe
            src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
            width="100%"
            height="152"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}

export default PreviewPlayer;
