import React, { useState, useRef, useEffect } from 'react';
import { Play, X } from 'lucide-react';

export function PreviewPlayer({ song, compact = true, overlayCard = false }) {
  const [showEmbed, setShowEmbed] = useState(false);
  const embedRef = useRef(null);
  
  // Close embed when clicking outside
  useEffect(() => {
    if (!showEmbed) return;
    
    const handleClickOutside = (e) => {
      if (embedRef.current && !embedRef.current.contains(e.target)) {
        setShowEmbed(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmbed]);
  
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

  const buttonSize = compact ? 'w-10 h-10' : 'w-12 h-12';
  const iconSize = compact ? 'w-5 h-5' : 'w-6 h-6';

  // Overlay mode: embed covers the entire card
  if (overlayCard) {
    return (
      <div className="relative inline-block" ref={embedRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowEmbed(!showEmbed);
          }}
          className={`${buttonSize} ${
            showEmbed 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-green-500 hover:bg-green-600'
          } text-white rounded-full transition-all duration-200 flex items-center justify-center shadow-lg z-20 relative`}
          aria-label={showEmbed ? "Close preview" : "Play preview"}
        >
          {showEmbed ? (
            <X className={iconSize} strokeWidth={3} />
          ) : (
            <Play className={iconSize} fill="currentColor" strokeWidth={0} style={{ marginLeft: '2px' }} />
          )}
        </button>
        
        {showEmbed && (
          <div 
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 bg-black rounded-lg shadow-2xl border-2 border-green-500 z-50 flex flex-col"
            style={{ 
              top: '0',
              left: '0',
              right: '0',
              bottom: '0',
              minHeight: '200px'
            }}
          >
            {/* Close button in top right */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowEmbed(false);
              }}
              className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center z-10"
            >
              <X className="w-5 h-5" strokeWidth={3} />
            </button>
            
            {/* Spotify embed */}
            <div className="flex-1 p-2">
              <iframe
                title={`Spotify player for ${song.name || 'track'}`}
                src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
                width="100%"
                height="100%"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                style={{ borderRadius: '8px', minHeight: '152px' }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default mode: dropdown below button
  return (
    <div className="relative inline-block" ref={embedRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowEmbed(!showEmbed);
        }}
        className={`${buttonSize} ${
          showEmbed 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-green-500 hover:bg-green-600'
        } text-white rounded-full transition-all duration-200 flex items-center justify-center shadow-lg z-20 relative`}
        aria-label={showEmbed ? "Close preview" : "Play preview"}
      >
        {showEmbed ? (
          <X className={iconSize} strokeWidth={3} />
        ) : (
          <Play className={iconSize} fill="currentColor" strokeWidth={0} style={{ marginLeft: '2px' }} />
        )}
      </button>
      
      {showEmbed && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute bg-black rounded-lg shadow-2xl border-2 border-green-500 z-50"
          style={{ 
            width: '300px',
            top: '100%',
            marginTop: '8px',
            // Auto-adjust left/right positioning
            ...(window.innerWidth && embedRef.current?.getBoundingClientRect().right > window.innerWidth - 320
              ? { right: 0 }
              : { left: 0 })
          }}
        >
          <iframe
            title={`Spotify player for ${song.name || 'track'}`}
            src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
            width="100%"
            height="152"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            style={{ borderRadius: '8px' }}
          />
        </div>
      )}
    </div>
  );
}

export default PreviewPlayer;
