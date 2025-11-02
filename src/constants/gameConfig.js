export const CLIENT_ID = '5349aaa7973d4da793a3fb676aace3ba';
export const REDIRECT_URI = 'https://hidden-tracks.vercel.app';
export const SCOPES = 'user-top-read user-read-recently-played';
export const HINT_POINTS = 10;
export const CHALLENGE_POINTS = 10;


// Challenge definitions with clearer descriptions
export const CHALLENGES = [
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
    description: 'Track must have popularity between 25-50 (niche favorite)',
    check: (song, seed) => song.popularity >= 25 && song.popularity <= 50
  },
  {
    id: 'high-energy',
    name: 'High Energy',
    description: 'Track must feel intense and energetic (energy above 70%)',
    check: (song, seed) => song.energy > 0.7
  },
  {
    id: 'chill-vibes',
    name: 'Chill Vibes',
    description: 'Track must feel relaxed and mellow (energy below 30%)',
    check: (song, seed) => song.energy < 0.3
  },
  {
    id: 'dance-floor',
    name: 'Dance Floor',
    description: 'Track must be highly danceable (danceability above 70%)',
    check: (song, seed) => song.danceability > 0.7
  },
  {
    id: 'feel-good',
    name: 'Feel Good',
    description: 'Track must sound positive and upbeat (happiness above 70%)',
    check: (song, seed) => song.valence > 0.7
  },
  {
    id: 'melancholy',
    name: 'Melancholy',
    description: 'Track must sound sad or introspective (happiness below 30%)',
    check: (song, seed) => song.valence < 0.3
  },
  {
    id: 'unplugged',
    name: 'Unplugged',
    description: 'Track must feature acoustic instruments (acoustic above 60%)',
    check: (song, seed) => song.acousticness > 0.6
  },
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
  }
];