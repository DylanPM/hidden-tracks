export const CLIENT_ID = '5349aaa7973d4da793a3fb676aace3ba';
export const REDIRECT_URI = 'https://hellodylanmckenzie.com/hidden-tracks';
export const SCOPES = 'user-top-read user-read-recently-played';

export const CHALLENGES = [
  { id: 'mega-hit', name: 'Mega Hit', description: 'Everyone knows this one', check: (song) => song.popularity > 75 },
  { id: 'deep-cut', name: 'Deep Cut', description: 'If you know, you know', check: (song) => song.popularity < 25 },
  { id: 'cult-classic', name: 'Cult Classic', description: 'Underground favorite', check: (song) => song.popularity >= 25 && song.popularity <= 50 },
  { id: 'high-energy', name: 'High Energy', description: 'Gets you moving', check: (song) => song.energy > 0.7 },
  { id: 'chill-vibes', name: 'Chill Vibes', description: 'Laid back and mellow', check: (song) => song.energy < 0.3 },
  { id: 'dance-floor', name: 'Dance Floor Ready', description: 'Made for dancing', check: (song) => song.danceability > 0.7 },
  { id: 'feel-good', name: 'Feel Good', description: 'Uplifting and positive', check: (song) => song.valence > 0.7 },
  { id: 'melancholy', name: 'Melancholy', description: 'In your feelings', check: (song) => song.valence < 0.3 },
  { id: 'unplugged', name: 'Unplugged', description: 'Acoustic and organic', check: (song) => song.acousticness > 0.6 },
  { id: 'fast', name: 'Fast & Furious', description: 'Quick tempo', check: (song) => song.tempo > 140 },
  { id: 'slow', name: 'Slow Burn', description: 'Takes its time', check: (song) => song.tempo < 90 },
];

export const GENRE_TREE = {
  round1: {
    prompt: "What's your main vibe?",
    options: ['pop', 'rock', 'hip-hop', 'electronic', 'r&b', 'country', 'jazz', 'indie']
  },
  round2: {
    pop: { prompt: "What kind of pop?", options: ['dance-pop', 'synth-pop', 'indie-pop', 'pop-rock'] },
    rock: { prompt: "What kind of rock?", options: ['alt-rock', 'indie-rock', 'classic-rock', 'hard-rock'] },
    'hip-hop': { prompt: "What kind of hip-hop?", options: ['trap', 'conscious-rap', 'alternative-hip-hop', 'old-school'] },
    electronic: { prompt: "What kind of electronic?", options: ['house', 'techno', 'edm', 'ambient'] },
    'r&b': { prompt: "What kind of R&B?", options: ['contemporary-r&b', 'soul', 'neo-soul', 'funk'] },
    country: { prompt: "What kind of country?", options: ['country-pop', 'alt-country', 'bluegrass', 'outlaw-country'] },
    jazz: { prompt: "What kind of jazz?", options: ['smooth-jazz', 'bebop', 'fusion', 'contemporary-jazz'] },
    indie: { prompt: "What kind of indie?", options: ['indie-rock', 'indie-pop', 'indie-folk', 'dream-pop'] }
  },
  round3: {
    prompt: "What else do you like?",
    options: ['folk', 'metal', 'latin', 'classical', 'blues', 'reggae', 'punk', 'soul']
  },
  round4: {
    folk: { prompt: "What style?", options: ['indie-folk', 'folk-rock', 'singer-songwriter', 'traditional'] },
    metal: { prompt: "What style?", options: ['heavy-metal', 'alt-metal', 'progressive-metal', 'metalcore'] },
    latin: { prompt: "What style?", options: ['reggaeton', 'latin-pop', 'salsa', 'bachata'] },
    classical: { prompt: "What period?", options: ['baroque', 'romantic', 'contemporary-classical', 'minimalism'] },
    blues: { prompt: "What style?", options: ['chicago-blues', 'delta-blues', 'blues-rock', 'electric-blues'] },
    reggae: { prompt: "What style?", options: ['roots-reggae', 'dancehall', 'dub', 'ska'] },
    punk: { prompt: "What style?", options: ['punk-rock', 'pop-punk', 'post-punk', 'hardcore'] },
    soul: { prompt: "What style?", options: ['classic-soul', 'neo-soul', 'motown', 'southern-soul'] }
  },
  round5: {
    prompt: "Energy check: pick your mood",
    options: ['high-energy', 'chill', 'melancholy', 'uplifting']
  }
};