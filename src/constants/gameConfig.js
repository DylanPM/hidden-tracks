export const CLIENT_ID = '5349aaa7973d4da793a3fb676aace3ba';
export const REDIRECT_URI = 'https://hidden-tracks.vercel.app';
export const SCOPES = 'user-top-read user-read-recently-played';
export const HINT_POINTS = 10;
export const CHALLENGE_POINTS = 10;


// Challenge definitions with clearer descriptions
export const CHALLENGES = [
  // Popularity challenges
  {
    id: 'mega-hit',
    name: 'Mega Hit',
    description: 'Track must have popularity score above 75 (widely known song)',
    check: (song, seed) => song.popularity > 75
  },
  {
    id: 'deep-cut',
    name: 'Deep Cut',
    description: 'Track must have popularity score below 25 (obscure gem)',
    check: (song, seed) => song.popularity < 25
  },
  {
    id: 'cult-classic',
    name: 'Cult Classic',
    description: 'Track must have popularity between 25-60 (niche favorite)',
    check: (song, seed) => song.popularity >= 25 && song.popularity <= 60
  },

  // Energy challenges
  {
    id: 'high-energy',
    name: 'High Energy',
    description: 'Track must feel intense and energetic (energy above 70)',
    check: (song, seed) => song.energy > 0.7
  },
  {
    id: 'chill-vibes',
    name: 'Chill Vibes',
    description: 'Track must feel relaxed and mellow (energy below 30)',
    check: (song, seed) => song.energy < 0.3
  },

  // Danceability challenges
  {
    id: 'dance-floor',
    name: 'Dance Floor',
    description: 'Track must be highly danceable (danceability above 70)',
    check: (song, seed) => song.danceability > 0.7
  },
  {
    id: 'anti-dance',
    name: 'Anti-Dance',
    description: 'Track must be laid-back and not for dancing (danceability below 30)',
    check: (song, seed) => song.danceability < 0.3
  },

  // Valence challenges
  {
    id: 'feel-good',
    name: 'Feel Good',
    description: 'Track must sound positive and upbeat (happiness above 70)',
    check: (song, seed) => song.valence > 0.7
  },
  {
    id: 'melancholy',
    name: 'Melancholy',
    description: 'Track must sound sad or introspective (happiness below 30)',
    check: (song, seed) => song.valence < 0.3
  },

  // Acousticness challenges
  {
    id: 'unplugged',
    name: 'Unplugged',
    description: 'Track must feature acoustic instruments (acoustic above 60)',
    check: (song, seed) => song.acousticness > 0.6
  },
  {
    id: 'electronic',
    name: 'Electronic',
    description: 'Track must be heavily produced/electronic (acoustic below 20)',
    check: (song, seed) => song.acousticness < 0.2
  },

  // Tempo challenges
  {
    id: 'fast-and-furious',
    name: 'Fast & Furious',
    description: 'Track must have fast tempo above 140 BPM',
    check: (song, seed) => song.tempo > 140
  },
  {
    id: 'slow-burn',
    name: 'Slow Burn',
    description: 'Track must have slow tempo below 90 BPM',
    check: (song, seed) => song.tempo < 90
  },

  // Era variant - different time period but musical match
  {
    id: 'time-traveler',
    name: 'Time Traveler',
    description: 'Track from a different era (>15 years apart) but similar vibe',
    check: (song, seed) => {
      if (!song.year || !seed.year) return false;
      const yearDiff = Math.abs(song.year - seed.year);
      if (yearDiff <= 15) return false;

      // Musical match: at least 2 of 3 attributes similar (within 0.25)
      const energySimilar = Math.abs(song.energy - seed.energy) < 0.25;
      const valenceSimilar = Math.abs(song.valence - seed.valence) < 0.25;
      const danceabilitySimilar = Math.abs(song.danceability - seed.danceability) < 0.25;

      const matches = [energySimilar, valenceSimilar, danceabilitySimilar].filter(Boolean).length;
      return matches >= 2;
    }
  },

  // Genre variant - different genre but musical match
  {
    id: 'genre-bender',
    name: 'Genre Bender',
    description: 'Track from a different genre but musically similar',
    check: (song, seed) => {
      // Check if genres are different
      const songGenre = song.genres?.[0]?.toLowerCase() || '';
      const seedGenre = seed.genres?.[0]?.toLowerCase() || '';

      if (!songGenre || !seedGenre || songGenre === seedGenre) return false;

      // Musical match: at least 3 of 4 attributes similar (within 0.2)
      const energySimilar = Math.abs(song.energy - seed.energy) < 0.2;
      const valenceSimilar = Math.abs(song.valence - seed.valence) < 0.2;
      const danceabilitySimilar = Math.abs(song.danceability - seed.danceability) < 0.2;
      const tempoSimilar = Math.abs((song.tempo || 120) - (seed.tempo || 120)) < 30;

      const matches = [energySimilar, valenceSimilar, danceabilitySimilar, tempoSimilar].filter(Boolean).length;
      return matches >= 3;
    }
  }
];