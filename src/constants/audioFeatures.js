export const AUDIO_FEATURES = {
  acousticness: { 
    name: 'Acousticness', 
    icon: '🎸',
    short: 'How acoustic the track sounds',
    long: 'Confidence measure of whether the track is acoustic. 1.0 represents high confidence the track is acoustic, featuring traditional instruments rather than electronic production.'
  },
  danceability: { 
    name: 'Danceability', 
    icon: '💃',
    short: 'How suitable for dancing',
    long: 'Describes how suitable a track is for dancing based on tempo, rhythm stability, beat strength, and overall regularity. 0.0 is least danceable and 1.0 is most danceable.'
  },
  energy: { 
    name: 'Energy', 
    icon: '⚡',
    short: 'Intensity and activity',
    long: 'Perceptual measure of intensity and activity. Energetic tracks feel fast, loud, and noisy. Death metal has high energy, while a Bach prelude scores low.'
  },
  instrumentalness: { 
    name: 'Instrumentalness', 
    icon: '🎹',
    short: 'Likelihood of no vocals',
    long: 'Predicts whether a track contains no vocals. "Ooh" and "aah" sounds are treated as instrumental. Rap or spoken word tracks are clearly "vocal". Values above 0.5 represent instrumental tracks.'
  },
  key: {
    name: 'Key',
    icon: '🎼',
    short: 'Musical key of the track',
    long: 'The key the track is in. Integers map to pitches using standard Pitch Class notation (0 = C, 1 = C♯/D♭, 2 = D, and so on). Spotify uses this to understand harmonic relationships between songs.'
  },
  liveness: { 
    name: 'Liveness', 
    icon: '🎤',
    short: 'Presence of an audience',
    long: 'Detects the presence of an audience in the recording. Higher values represent an increased probability that the track was performed live. Above 0.8 provides strong likelihood the track is live.'
  },
  loudness: {
    name: 'Loudness',
    icon: '🔊',
    short: 'Overall volume in decibels',
    long: 'The overall loudness of a track in decibels (dB). Values typically range from -60 to 0 dB. Loudness is the quality of a sound that is the primary psychological correlate of physical strength (amplitude).'
  },
  mode: {
    name: 'Mode',
    icon: '🎵',
    short: 'Major or minor scale',
    long: 'Indicates the modality (major or minor) of a track. Major mode is represented by 1 and minor is 0. This affects the emotional character, major keys tend to sound happier, minor keys more melancholic.'
  },
  speechiness: { 
    name: 'Speechiness', 
    icon: '🗣️',
    short: 'Presence of spoken words',
    long: 'Detects the presence of spoken words. Values above 0.66 describe tracks probably made entirely of spoken word. 0.33-0.66 may contain both music and speech. Below 0.33 represents music and non-speech tracks.'
  },
  tempo: { 
    name: 'Tempo', 
    icon: '⏱️',
    short: 'Overall pace in BPM',
    long: 'The overall estimated tempo in beats per minute (BPM). Tempo is the speed or pace of a piece and corresponds directly to the average beat duration.'
  },
  time_signature: {
    name: 'Time Signature',
    icon: '⏲️',
    short: 'Beats per measure',
    long: 'An estimated time signature. The time signature (meter) is a notational convention to specify how many beats are in each bar (or measure). Common values are 3 (3/4 time) and 4 (4/4 time).'
  },
  valence: { 
    name: 'Valence', 
    icon: '😊',
    short: 'Musical positivity',
    long: 'Describes the musical positiveness. Tracks with high valence sound more positive (happy, cheerful, euphoric), while tracks with low valence sound more negative (sad, depressed, angry).'
  },
};