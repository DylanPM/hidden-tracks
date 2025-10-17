import React, { useState, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

function PreviewPlayer({ song, compact = false }) {
  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState(null);

  useEffect(() => {
    return () => {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    };
  }, [audio]);

  const handlePlayPause = (e) => {
    e.stopPropagation(); // Prevent card selection when clicking play
    
    if (playing && audio) {
      audio.pause();
      setPlaying(false);
    } else if (song?.track_id) {
      const embedUrl = `https://open.spotify.com/embed/track/${song.track_id}?utm_source=generator`;
      
      // For embedded player, we can't control playback directly
      // Instead, open a small popup or tooltip
      const newAudio = new Audio(`https://p.scdn.co/mp3-preview/${song.preview_url || ''}`);
      
      if (song.preview_url) {
        newAudio.play().catch(() => {
          // If direct preview fails, open Spotify embed in window
          window.open(embedUrl, 'spotify', 'width=400,height=200');
        });
        setAudio(newAudio);
        setPlaying(true);
        
        newAudio.onended = () => {
          setPlaying(false);
          setAudio(null);
        };
      } else {
        // No preview available, open Spotify
        window.open(embedUrl, 'spotify', 'width=400,height=200');
      }
    }
  };

  if (compact) {
    return (
      <button
        onClick={handlePlayPause}
        className="flex-shrink-0 relative z-10 w-12 h-12 rounded-full bg-green-500 hover:bg-green-400 text-black flex items-center justify-center transition"
        title="Play preview"
      >
        {playing ? <Pause size={20} /> : <Play size={20} />}
      </button>
    );
  }

  return (
    <button
      onClick={handlePlayPause}
      className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-green-500 hover:bg-green-400 text-black font-semibold transition relative z-10"
      title="Play preview"
    >
      {playing ? <Pause size={18} /> : <Play size={18} />}
      {playing ? 'Pause' : 'Play'}
    </button>
  );
}

export default PreviewPlayer;
export { PreviewPlayer };