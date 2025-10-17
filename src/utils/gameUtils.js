export const calculateSimilarity = (song1, song2) => {
  //todo: remove genre match or make it more general (not binary)
  const genreMatch = song1.track_genre === song2.track_genre ? 1 : 0.6;
  const energyDiff = Math.abs(song1.energy - song2.energy);
  const danceabilityDiff = Math.abs(song1.danceability - song2.danceability);
  const valenceDiff = Math.abs(song1.valence - song2.valence);
  const acousticnessDiff = Math.abs(song1.acousticness - song2.acousticness);
  const tempoDiff = Math.abs(song1.tempo - song2.tempo) / 200;
  const audioSimilarity = 1 - (energyDiff + danceabilityDiff + valenceDiff + acousticnessDiff + tempoDiff) / 5;
  const popularityDiff = Math.abs(song1.popularity - song2.popularity) / 100;
  const popularitySimilarity = 1 - popularityDiff;
  return (genreMatch * 0.2) + (audioSimilarity * 0.6) + (popularitySimilarity * 0.2);
};

export const fuzzyMatch = (input, target) => {
  if (!input || !target) return false;
  const clean = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean(target).includes(clean(input));
};

//todo: improve hint generation (more variety, use more of the seed song features)
export const generateSeedHints = (seedSong) => {
  const hints = [];
  let vague = '';
  if (seedSong.valence < 0.35) vague = 'Think introspective late nights and emotional vulnerability';
  else if (seedSong.valence > 0.65) vague = 'Think sunshine vibes and carefree energy';
  else if (seedSong.energy > 0.65) vague = 'Think driving beats and moving your body';
  else vague = 'Think smooth grooves and laid-back moods';
  hints.push(vague);
  
  let medium = `Genre: ${seedSong.track_genre}. `;
  if (seedSong.acousticness > 0.5) medium += 'Organic, unplugged sound';
  else if (seedSong.danceability > 0.65) medium += 'Made for movement';
  else medium += 'Polished production';
  hints.push(medium);
  
  let algo = '';
  if (seedSong.energy > 0.6) algo += 'High energy, ';
  else if (seedSong.energy < 0.4) algo += 'Low energy, ';
  if (seedSong.valence > 0.6) algo += 'positive mood, ';
  else if (seedSong.valence < 0.4) algo += 'melancholy mood, ';
  if (seedSong.popularity > 75) algo += 'mainstream hit';
  else if (seedSong.popularity < 50) algo += 'underground/indie';
  else algo += 'mid-tier popularity';
  hints.push(algo);
  
  return hints;
};

export const loadSpotifyDataset = async () => {
  try {
    const response = await fetch('https://huggingface.co/datasets/maharshipandya/spotify-tracks-dataset/resolve/main/dataset.csv');
    const csvText = await response.text();
    
    const lines = csvText.split('\n');
    const songs = [];
    
    for (let i = 1; i < Math.min(lines.length, 3000); i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const values = line.split(',');
      const track = {
        track_id: values[1]?.trim() || `track_${i}`,
        artists: values[2]?.trim() || 'Unknown',
        track_name: values[4]?.trim() || 'Untitled',
        popularity: parseInt(values[5]) || 50,
        //update to pick more popular songs by default?
        duration_ms: parseInt(values[6]) || 200000,
        explicit: values[7] === 'True',
        danceability: parseFloat(values[8]) || 0.5,
        energy: parseFloat(values[9]) || 0.5,
        key: parseInt(values[10]) || 0,
        loudness: parseFloat(values[11]) || -10,
        mode: parseInt(values[12]) || 1,
        speechiness: parseFloat(values[13]) || 0.05,
        acousticness: parseFloat(values[14]) || 0.5,
        instrumentalness: parseFloat(values[15]) || 0,
        liveness: parseFloat(values[16]) || 0.1,
        valence: parseFloat(values[17]) || 0.5,
        tempo: parseFloat(values[18]) || 120,
        time_signature: parseInt(values[19]) || 4,
        track_genre: values[20]?.trim() || 'pop',
      };
      
      const { normalizeTrack } = require('./trackUtils');
      const normalized = normalizeTrack(track);
      if (normalized) songs.push(normalized);
    }
    
    return songs.filter(s => 
      s && 
      s.artists && 
      typeof s.artists === 'string' && 
      s.track_name && 
      typeof s.track_name === 'string'
    );
  } catch (error) {
    console.error('Failed to load dataset:', error);
    return [];
  }
};