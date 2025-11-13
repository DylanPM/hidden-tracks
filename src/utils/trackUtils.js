export const normalizeTrack = (track) => {
  if (!track) return null;
  
  let artistsStr = 'Unknown';
  if (typeof track.artists === 'string' && track.artists.trim()) {
    artistsStr = track.artists.trim();
  } else if (Array.isArray(track.artists) && track.artists.length > 0) {
    artistsStr = track.artists
      .filter(a => a !== null && a !== undefined)
      .map(a => {
        if (typeof a === 'string' && a.trim()) return a.trim();
        if (a && typeof a === 'object' && a.name && typeof a.name === 'string' && a.name.trim()) return a.name.trim();
        return null;
      })
      .filter(a => a !== null)
      .join(', ') || 'Unknown';
  }
  
  const trackName = track.track_name || track.name || 'Untitled';
  const finalTrackName = typeof trackName === 'string' && trackName.trim() ? trackName.trim() : 'Untitled';
  
  if (artistsStr === 'Unknown' && finalTrackName === 'Untitled') {
    return null;
  }
  
  return {
    track_id: track.track_id || track.id || `track_${Date.now()}_${Math.random()}`,
    artists: artistsStr,
    track_name: finalTrackName,
    popularity: track.popularity || 50,
    energy: track.energy !== undefined ? track.energy : 0.5,
    danceability: track.danceability !== undefined ? track.danceability : 0.5,
    valence: track.valence !== undefined ? track.valence : 0.5,
    tempo: track.tempo !== undefined ? track.tempo : 120,
    acousticness: track.acousticness !== undefined ? track.acousticness : 0.5,
    instrumentalness: track.instrumentalness !== undefined ? track.instrumentalness : 0,
    liveness: track.liveness !== undefined ? track.liveness : 0.1,
    speechiness: track.speechiness !== undefined ? track.speechiness : 0.05,
    key: track.key !== undefined ? track.key : 0,
    loudness: track.loudness !== undefined ? track.loudness : -10,
    mode: track.mode !== undefined ? track.mode : 1,
    time_signature: track.time_signature !== undefined ? track.time_signature : 4,
    explicit: track.explicit || false,
    track_genre: track.track_genre || track.genre || 'unknown',
    duration_ms: track.duration_ms || 200000,
    preview_url: track.preview_url || null,
  };
};

export const buildSpotifyProfile = (tracks, features) => {
  try {
    const validFeatures = features.filter(f => f !== null);
    
    if (validFeatures.length === 0 || tracks.length === 0) {
      return null;
    }
    
    const avg = (key) => {
      const values = validFeatures.filter(f => f[key] !== undefined && f[key] !== null);
      if (values.length === 0) return 0.5;
      return values.reduce((sum, f) => sum + f[key], 0) / values.length;
    };
    
    const avgEnergy = avg('energy');
    const avgValence = avg('valence');
    const avgDanceability = avg('danceability');
    const avgAcousticness = avg('acousticness');
    const avgInstrumentalness = avg('instrumentalness');
    const avgLiveness = avg('liveness');
    const avgSpeechiness = avg('speechiness');
    const avgTempo = avg('tempo');
    const avgLoudness = avg('loudness');
    const avgKey = Math.round(avg('key'));
    const avgMode = Math.round(avg('mode'));
    const avgTimeSignature = Math.round(avg('time_signature'));
    const avgPopularity = tracks.reduce((sum, t) => sum + (t.popularity || 0), 0) / tracks.length;
    
    let descriptor = '';
    if (avgEnergy > 0.7 && avgValence > 0.7) descriptor = 'High Energy Optimist';
    else if (avgEnergy < 0.3 && avgValence < 0.3) descriptor = 'Melancholy Mood Master';
    else if (avgAcousticness > 0.6) descriptor = 'Acoustic Aficionado';
    else if (avgDanceability > 0.7) descriptor = 'Dance Floor Devotee';
    else if (avgValence < 0.4) descriptor = 'Emo Excellence';
    else if (avgEnergy > 0.7) descriptor = 'High Octane Hero';
    else if (avgTempo > 140) descriptor = 'Speed Demon';
    else if (avgTempo < 90) descriptor = 'Slow Jam Specialist';
    else if (avgSpeechiness > 0.3) descriptor = 'Lyric Lover';
    else descriptor = 'Eclectic Explorer';
    
    const findTopSong = (featureKey) => {
      let maxVal = -Infinity;
      let maxIdx = -1;
      
      features.forEach((feature, idx) => {
        if (feature && feature[featureKey] !== undefined && feature[featureKey] !== null) {
          if (feature[featureKey] > maxVal) {
            maxVal = feature[featureKey];
            maxIdx = idx;
          }
        }
      });
      
      if (maxIdx === -1 || !tracks[maxIdx]) return null;
      
      const track = tracks[maxIdx];
      const normalized = normalizeTrack(track);
      
      if (!normalized || !normalized.artists || !normalized.track_name) return null;
      
      return {
        artists: normalized.artists,
        track_name: normalized.track_name
      };
    };
    
    const normalizedTracks = [];
    
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (!track) continue;
      
      const feature = features[i];
      
      try {
        const normalized = normalizeTrack({
          id: track.id,
          artists: track.artists,
          name: track.name,
          track_name: track.name,
          popularity: track.popularity,
          duration_ms: track.duration_ms,
          explicit: track.explicit,
          preview_url: track.preview_url,
          energy: feature?.energy,
          danceability: feature?.danceability,
          valence: feature?.valence,
          tempo: feature?.tempo,
          acousticness: feature?.acousticness,
          instrumentalness: feature?.instrumentalness,
          liveness: feature?.liveness,
          speechiness: feature?.speechiness,
          key: feature?.key,
          loudness: feature?.loudness,
          mode: feature?.mode,
          time_signature: feature?.time_signature,
        });
        
        if (normalized && normalized.artists && normalized.track_name) {
          normalizedTracks.push(normalized);
        }
      } catch (err) {
        console.error('Error normalizing track:', err, track);
      }
    }
    
    if (normalizedTracks.length === 0) {
      return null;
    }
    
    // Import createTasteProfile from profiles
    const { createTasteProfile } = require('../constants/profiles');
    
    return createTasteProfile({
      name: 'Your Spotify Taste',
      source: 'spotify',
      descriptor,
      energy: [Math.max(0, avgEnergy - 0.2), Math.min(1, avgEnergy + 0.2)],
      valence: [Math.max(0, avgValence - 0.2), Math.min(1, avgValence + 0.2)],
      danceability: [Math.max(0, avgDanceability - 0.2), Math.min(1, avgDanceability + 0.2)],
      acousticness: [Math.max(0, avgAcousticness - 0.2), Math.min(1, avgAcousticness + 0.2)],
      tempo: [Math.max(60, avgTempo - 20), Math.min(200, avgTempo + 20)],
      popularity: [Math.max(0, avgPopularity - 20), Math.min(100, avgPopularity + 20)],
      genres: [],
      referenceTracks: normalizedTracks,
      audioFeatureAverages: {
        acousticness: avgAcousticness,
        danceability: avgDanceability,
        energy: avgEnergy,
        instrumentalness: avgInstrumentalness,
        key: avgKey,
        liveness: avgLiveness,
        loudness: avgLoudness,
        mode: avgMode,
        speechiness: avgSpeechiness,
        tempo: avgTempo,
        time_signature: avgTimeSignature,
        valence: avgValence,
      },
      topExamples: {
        acousticness: findTopSong('acousticness'),
        danceability: findTopSong('danceability'),
        energy: findTopSong('energy'),
        instrumentalness: findTopSong('instrumentalness'),
        key: findTopSong('key'),
        liveness: findTopSong('liveness'),
        loudness: findTopSong('loudness'),
        mode: findTopSong('mode'),
        speechiness: findTopSong('speechiness'),
        tempo: findTopSong('tempo'),
        time_signature: findTopSong('time_signature'),
        valence: findTopSong('valence'),
      },
    });
  } catch (error) {
    console.error('Error building Spotify profile:', error);
    return null;
  }
};

export const profileTracksToGameTracks = (decodedTracks) => {
  return decodedTracks.map(track => ({
    // Map profile format → game format
    track_id: track.id,
    artists: track.artist || 'Unknown',
    track_name: track.name || 'Untitled',
    popularity: track.popularity || 50,
    year: track.year,
    
    // Audio features (already dequantized by slimProfile.js)
    energy: track.energy ?? 0.5,
    danceability: track.danceability ?? 0.5,
    valence: track.valence ?? 0.5,
    tempo: track.tempo ?? 120,
    acousticness: track.acousticness ?? 0.5,
    instrumentalness: track.instrumentalness ?? 0,
    liveness: track.liveness ?? 0.1,
    speechiness: track.speechiness ?? 0.05,
    key: track.key ?? 0,
    loudness: track.loudness_db ?? -10,
    mode: track.mode ?? 1,
    time_signature: track.time_signature ?? 4,
    
    // New metadata for enhanced gameplay
    similarity: track.sim_overall ?? 0,
    radio_fit: track.radio_fit ?? 0,
    clarity: track.clarity ?? 0,
    sim_components: track.sim_components || {},
    era_distance: track.era_distance,
    same_artist: track.same_artist,
    
    // Standard fields
    duration_ms: track.duration_ms || 200000,
    explicit: track.flags?.explicit || false,
    preview_url: null,
    track_genre: 'unknown',
  }));
};