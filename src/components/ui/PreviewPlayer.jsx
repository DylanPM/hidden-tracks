import React, { useState, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

export function PreviewPlayer({ song, compact = false }) {
  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(song?.preview_url || null);
  const [error, setError] = useState(false);

  useEffect(() => {
    return () => {
      if (audio) {
        audio.pause();
        audio.remove();
      }
    };
  }, [audio]);

  const fetchPreview = async () => {
    if (previewUrl || loading || error) return;
    
    setLoading(true);
    try {
      const query = `artist:${song.artists} track:${song.track_name}`;
      const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('spotify_token') || '') }
      });
      
      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json();
      const preview = data.tracks?.items?.[0]?.preview_url;
      
      if (preview) {
        setPreviewUrl(preview);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error('Preview fetch error:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = async (e) => {
    e.stopPropagation();
    
    if (!previewUrl && !loading && !error) {
      await fetchPreview();
      return;
    }
    
    if (!previewUrl || error) return;
    
    if (!audio) {
      const newAudio = new Audio(previewUrl);
      newAudio.addEventListener('ended', () => setPlaying(false));
      setAudio(newAudio);
      newAudio.play();
      setPlaying(true);
    } else if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  };

  if (error) {
    return compact ? null : (
      <div className="p-2 text-zinc-500 text-xs">No preview</div>
    );
  }

  return (
    <div
      onClick={togglePlay}
      style={{ pointerEvents: loading ? 'none' : 'auto' }}
      className={`${compact ? 'p-1.5' : 'p-2'} bg-green-500 hover:bg-green-400 rounded-full transition disabled:opacity-50 disabled:cursor-wait`}
      title={loading ? 'Loading preview...' : playing ? 'Pause' : 'Play preview'}
    >
      {loading ? (
        <div className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} border-2 border-black border-t-transparent rounded-full animate-spin`} />
      ) : playing ? (
        <Pause className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-black`} />
      ) : (
        <Play className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-black`} />
      )}
    </div>
  );
}