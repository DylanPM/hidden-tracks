import React, { useState } from 'react';
import { Play, X } from 'lucide-react';

const PreviewPlayer = ({ song, compact = false }) => {
  const [showEmbed, setShowEmbed] = useState(false);
  
  if (!song || !song.track_id) {
    return null;
  }

  // For compact mode (inline button)
  if (compact) {
    return (
      <>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowEmbed(!showEmbed);
          }}
          className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-full transition-all duration-200"
          aria-label={showEmbed ? "Close preview" : "Play preview"}
        >
          {showEmbed ? <X size={16} /> : <Play size={16} />}
        </button>
        
        {showEmbed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="relative bg-gray-900 rounded-lg p-4 max-w-md w-full">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmbed(false);
                }}
                className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 rounded-full z-10"
              >
                <X size={20} className="text-white" />
              </button>
              
              <iframe
                src={`https://open.spotify.com/embed/track/${song.track_id}?utm_source=generator&theme=0`}
                width="100%"
                height="152"
                frameBorder="0"
                allowFullScreen=""
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="rounded-lg"
              />
            </div>
          </div>
        )}
      </>
    );
  }
  
  // For regular mode (larger button with embed below)
  return (
    <div className="w-full">
      <button
        onClick={() => setShowEmbed(!showEmbed)}
        className="w-full p-3 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center justify-center gap-2 transition-all duration-200"
      >
        {showEmbed ? (
          <>
            <X size={20} />
            <span>Close Preview</span>
          </>
        ) : (
          <>
            <Play size={20} />
            <span>Play Preview</span>
          </>
        )}
      </button>
      
      {showEmbed && (
        <div className="mt-3 rounded-lg overflow-hidden">
          <iframe
            src={`https://open.spotify.com/embed/track/${song.track_id}?utm_source=generator&theme=0`}
            width="100%"
            height="152"
            frameBorder="0"
            allowFullScreen=""
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
};

export default PreviewPlayer;
export { PreviewPlayer };