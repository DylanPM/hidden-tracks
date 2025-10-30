import React, { useState, useEffect } from 'react';
import { mapRows } from './utils/slimProfile';
import { profileTracksToGameTracks } from './utils/trackUtils';

const DIFFICULTY_PRESETS = {
  easy: {
    radioFitCutoff: 0.8,
    clarityCutoff: 0.0,    // Don't filter by clarity
    simOverallCutoff: 0.8,
    popularityCutoff: 0,   // Don't filter by popularity
    correctCount: 3,
    wrongCount: 1,
    maxSameArtistPercent: 30,
    energyRange: [0, 1],
    danceabilityRange: [0, 1],
    valenceRange: [0, 1],
    tempoRange: [60, 200],
    acousticnessRange: [0, 1],
    instrumentalnessRange: [0, 1],
    speechinessRange: [0, 1],
    livenessRange: [0, 1],
    loudnessRange: [-60, 0],
    yearRange: [1950, 2025],
  },
  medium: {
    radioFitCutoff: 0.7,
    clarityCutoff: 0.0,
    simOverallCutoff: 0.7,
    popularityCutoff: 0,
    correctCount: 2,
    wrongCount: 2,
    maxSameArtistPercent: 15,
    energyRange: [0, 1],
    danceabilityRange: [0, 1],
    valenceRange: [0, 1],
    tempoRange: [60, 200],
    acousticnessRange: [0, 1],
    instrumentalnessRange: [0, 1],
    speechinessRange: [0, 1],
    livenessRange: [0, 1],
    loudnessRange: [-60, 0],
    yearRange: [1950, 2025],
  },
  hard: {
    radioFitCutoff: 0.6,
    clarityCutoff: 0.0,
    simOverallCutoff: 0.6,
    popularityCutoff: 0,
    correctCount: 1,
    wrongCount: 3,
    maxSameArtistPercent: 0,
    energyRange: [0, 1],
    danceabilityRange: [0, 1],
    valenceRange: [0, 1],
    tempoRange: [60, 200],
    acousticnessRange: [0, 1],
    instrumentalnessRange: [0, 1],
    speechinessRange: [0, 1],
    livenessRange: [0, 1],
    loudnessRange: [-60, 0],
    yearRange: [1950, 2025],
  },
};

const ATTRIBUTE_DESCRIPTIONS = {
  radio_fit: "How well this track fits the radio station playlist (0 = poor fit, 1 = perfect fit)",
  clarity: "How distinct and clear the match is (0 = ambiguous, 1 = obvious)",
  similarity: "Overall similarity to the seed track across all dimensions",
  popularity: "Spotify popularity score (0-100, higher = more popular)",
  energy: "Intensity and activity level (0 = calm, 1 = energetic)",
  danceability: "How suitable for dancing (0 = not danceable, 1 = very danceable)",
  valence: "Musical positiveness (0 = sad/angry, 1 = happy/cheerful)",
  tempo: "Speed in beats per minute (BPM)",
  acousticness: "Confidence that track is acoustic (0 = electric, 1 = acoustic)",
  instrumentalness: "Predicts lack of vocals (0 = vocals, 1 = instrumental)",
  speechiness: "Presence of spoken words (0 = music, 1 = speech/podcast)",
  liveness: "Presence of live audience (0 = studio, 1 = live performance)",
  loudness: "Overall volume in decibels (dB), typically -60 to 0",
  year: "Release year of the track",
};

// Histogram component with gradient
const Histogram = ({ tracks, attribute, range, seedValue, isTempoScale = false, isYearScale = false, isLoudnessScale = false }) => {
  const numBuckets = 10;
  const buckets = Array(numBuckets).fill(0);
  
  let min, max;
  if (isTempoScale) {
    min = 60;
    max = 200;
  } else if (isYearScale) {
    min = 1950;
    max = 2025;
  } else if (isLoudnessScale) {
    min = -60;
    max = 0;
  } else {
    min = 0;
    max = 1;
  }
  
  const bucketSize = (max - min) / numBuckets;
  
  tracks.forEach(track => {
    let value = track[attribute];
    if (value === undefined || value === null) {
      if (isTempoScale) value = 120;
      else if (isYearScale) value = 2000;
      else if (isLoudnessScale) value = -10;
      else value = 0.5;
    }
    const bucketIndex = Math.min(Math.floor((value - min) / bucketSize), numBuckets - 1);
    if (bucketIndex >= 0 && bucketIndex < numBuckets) {
      buckets[bucketIndex]++;
    }
  });
  
  const maxCount = Math.max(...buckets, 1);
  
  const seedBucket = seedValue !== null ? Math.min(Math.floor((seedValue - min) / bucketSize), numBuckets - 1) : -1;
  const rangeStartBucket = Math.floor((range[0] - min) / bucketSize);
  const rangeEndBucket = Math.floor((range[1] - min) / bucketSize);
  

  
  return (
    <div style={{ marginTop: '5px', height: '60px', display: 'flex', alignItems: 'flex-end', gap: '2px', position: 'relative' }}>
      {buckets.map((count, idx) => {
        const inRange = idx >= rangeStartBucket && idx <= rangeEndBucket;
        const isSeedBucket = idx === seedBucket;
        
        // Calculate gradient color based on distance from range
        let barColor = '#ddd';
        if (inRange) {
          barColor = '#4CAF50'; // Green for in-range
        } else {
          // Gradient to red based on distance from range
          const distanceFromRange = idx < rangeStartBucket 
            ? rangeStartBucket - idx 
            : idx - rangeEndBucket;
          const intensity = Math.min(distanceFromRange / 3, 1); // Max out at 3 buckets away
          const red = Math.floor(200 + (55 * intensity));
          const green = Math.floor(200 * (1 - intensity));
          barColor = `rgb(${red}, ${green}, ${green})`;
        }
        
        return (
          <div 
            key={idx} 
            style={{ 
              flex: 1, 
              height: `${(count / maxCount) * 100}%`, 
              background: barColor,
              minHeight: count > 0 ? '2px' : '0px',
              position: 'relative',
              borderRadius: '2px 2px 0 0',
              border: isSeedBucket ? '2px solid #FF5722' : 'none',
              boxSizing: 'border-box'
            }}
            title={`${(min + idx * bucketSize).toFixed(isYearScale ? 0 : 2)}-${(min + (idx + 1) * bucketSize).toFixed(isYearScale ? 0 : 2)}: ${count} tracks${isSeedBucket ? ' (SEED)' : ''}`}
          >
            {isSeedBucket && (
              <div style={{ 
                position: 'absolute', 
                top: '-20px', 
                left: '50%', 
                transform: 'translateX(-50%)',
                fontSize: '16px'
              }}>
                🎯
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Track table component
const TrackTable = ({ tracks, expandedTrack, onToggleTrack }) => {
  if (tracks.length === 0) {
    return <p style={{ padding: '10px', color: '#999', fontSize: '12px' }}>No tracks in filtered pool</p>;
  }
  
  return (
    <div style={{ maxHeight: '300px', overflowY: 'auto', fontSize: '11px', border: '1px solid #ddd', borderRadius: '4px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#f5f5f5', position: 'sticky', top: 0 }}>
          <tr>
            <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Track</th>
            <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Artist</th>
            <th style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Radio Fit</th>
            <th style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Clarity</th>
            <th style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Similarity</th>
            <th style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Pop</th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((track, idx) => (
            <React.Fragment key={idx}>
              <tr 
                onClick={() => onToggleTrack(idx)} 
                style={{ 
                  cursor: 'pointer', 
                  background: expandedTrack === idx ? '#f0f0f0' : (idx % 2 === 0 ? '#fff' : '#fafafa'),
                  borderBottom: '1px solid #eee'
                }}
              >
                <td style={{ padding: '6px' }}>{track.track_name}</td>
                <td style={{ padding: '6px' }}>{track.artists}</td>
                <td style={{ padding: '6px', textAlign: 'center' }}>{track.radio_fit?.toFixed(2)}</td>
                <td style={{ padding: '6px', textAlign: 'center' }}>{track.clarity?.toFixed(2)}</td>
                <td style={{ padding: '6px', textAlign: 'center' }}>{track.similarity?.toFixed(2)}</td>
                <td style={{ padding: '6px', textAlign: 'center' }}>{track.popularity}</td>
              </tr>
              {expandedTrack === idx && (
                <tr style={{ background: '#f9f9f9' }}>
                  <td colSpan="6" style={{ padding: '10px', fontSize: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <div><strong>Energy:</strong> {track.energy?.toFixed(2)}</div>
                      <div><strong>Danceability:</strong> {track.danceability?.toFixed(2)}</div>
                      <div><strong>Valence:</strong> {track.valence?.toFixed(2)}</div>
                      <div><strong>Tempo:</strong> {track.tempo?.toFixed(0)} BPM</div>
                      <div><strong>Acousticness:</strong> {track.acousticness?.toFixed(2)}</div>
                      <div><strong>Instrumentalness:</strong> {track.instrumentalness?.toFixed(2)}</div>
                      <div><strong>Speechiness:</strong> {track.speechiness?.toFixed(2)}</div>
                      <div><strong>Liveness:</strong> {track.liveness?.toFixed(2)}</div>
                      <div><strong>Loudness:</strong> {track.loudness?.toFixed(1)} dB</div>
                      <div><strong>Year:</strong> {track.year}</div>
                      <div><strong>Same Artist:</strong> {track.same_artist ? 'Yes' : 'No'}</div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Attribute detail component (top/bottom 3)
const AttributeDetail = ({ tracks, attribute, range, isTempoScale, isYearScale, isLoudnessScale }) => {
  const filteredTracks = tracks.filter(t => {
    const val = t[attribute];
    return val >= range[0] && val <= range[1];
  });
  
  const sorted = [...filteredTracks].sort((a, b) => (b[attribute] ?? 0) - (a[attribute] ?? 0));
  const top3 = sorted.slice(0, 3);
  const bottom3 = sorted.slice(-3).reverse();
  
  const formatValue = (val) => {
    if (isTempoScale) return `${val?.toFixed(0)} BPM`;
    if (isYearScale) return val;
    if (isLoudnessScale) return `${val?.toFixed(1)} dB`;
    return val?.toFixed(2);
  };
  
  return (
    <div style={{ fontSize: '10px', marginTop: '5px', padding: '8px', background: '#f9f9f9', borderRadius: '4px' }}>
      <div style={{ marginBottom: '8px' }}>
        <strong>Highest 3 in range:</strong>
        {top3.length === 0 && <span style={{ color: '#999' }}> None</span>}
        {top3.map((t, i) => (
          <div key={i} style={{ marginLeft: '8px' }}>
            {i + 1}. {t.track_name} - {t.artists} ({formatValue(t[attribute])})
          </div>
        ))}
      </div>
      <div>
        <strong>Lowest 3 in range:</strong>
        {bottom3.length === 0 && <span style={{ color: '#999' }}> None</span>}
        {bottom3.map((t, i) => (
          <div key={i} style={{ marginLeft: '8px' }}>
            {i + 1}. {t.track_name} - {t.artists} ({formatValue(t[attribute])})
          </div>
        ))}
      </div>
    </div>
  );
};

const MiniGame = () => {
  const [profile, setProfile] = useState(null);
  const [allTracks, setAllTracks] = useState([]);
  const [seedSong, setSeedSong] = useState(null);
  const [correctPool, setCorrectPool] = useState([]);
  const [wrongPool, setWrongPool] = useState([]);
  
  // Game state
  const [currentOptions, setCurrentOptions] = useState([]);
  const [score, setScore] = useState(0);
  const [guessesLeft, setGuessesLeft] = useState(10);
  const [feedback, setFeedback] = useState('');
//to track guess history
  const [guessHistory, setGuessHistory] = useState([]);
  
  // UI state
  const [expandedTrack, setExpandedTrack] = useState(null);
  const [expandedAttributes, setExpandedAttributes] = useState({});
  
  // Tuning sliders - core
  const [radioFitCutoff, setRadioFitCutoff] = useState(0.7);
  const [clarityCutoff, setClarityCutoff] = useState(0.0);
  const [simOverallCutoff, setSimOverallCutoff] = useState(0.0);
  const [popularityCutoff, setPopularityCutoff] = useState(0);
  const [maxSameArtistPercent, setMaxSameArtistPercent] = useState(100);
  const [correctCount, setCorrectCount] = useState(2);
  const [wrongCount, setWrongCount] = useState(2);
  
  // Audio feature ranges
  const [energyRange, setEnergyRange] = useState([0, 1]);
  const [danceabilityRange, setDanceabilityRange] = useState([0, 1]);
  const [valenceRange, setValenceRange] = useState([0, 1]);
  const [tempoRange, setTempoRange] = useState([60, 200]);
  const [acousticnessRange, setAcousticnessRange] = useState([0, 1]);
  const [instrumentalnessRange, setInstrumentalnessRange] = useState([0, 1]);
  const [speechinessRange, setSpeechinessRange] = useState([0, 1]);
  const [livenessRange, setLivenessRange] = useState([0, 1]);
  const [loudnessRange, setLoudnessRange] = useState([-60, 0]);
  const [yearRange, setYearRange] = useState([1950, 2025]);
  
// Load profile on mount
useEffect(() => {
  fetch('/profiles/stevie-wonder.json')
    .then(res => res.json())
    .then(slimProfile => {
      console.log('Profile rows in JSON:', slimProfile.rows.length);
      
const decoded = mapRows(slimProfile);
console.log('Decoded rows:', decoded.length);

const gameTracks = profileTracksToGameTracks(decoded);
console.log('Game tracks:', gameTracks.length);
console.log('Sample track from profile:', gameTracks[1]); // ADD THIS LINE
console.log('Sample track:', gameTracks[1]); // <-- ADD THIS
console.log('Sample track year:', gameTracks[1]?.year); 

// Build seed song from profile.seed object
const seedFromProfile = {
  track_id: slimProfile.seed.id,
  track_name: slimProfile.seed.t || 'Unknown',
  artists: Array.isArray(slimProfile.seed.a) && Array.isArray(slimProfile.dict?.artists)
    ? slimProfile.seed.a.map(i => slimProfile.dict.artists[i]).filter(Boolean).join(', ')
    : 'Unknown',
  year: slimProfile.seed.y,
  // Copy audio features from the matching track in gameTracks
  ...(gameTracks.find(t => t.track_id === slimProfile.seed.id) || {})
};

console.log('Seed song:', seedFromProfile);

setSeedSong(seedFromProfile);
setAllTracks(gameTracks);
setProfile(slimProfile);
    })
    .catch(err => console.error('Load failed:', err));
}, []);
  
  // Split tracks into correct/wrong pools when cutoffs change
  // Split tracks into correct/wrong pools when cutoffs change
useEffect(() => {
  if (allTracks.length === 0) return;

    console.log('Pool filter inputs:', {
    radioFitCutoff,
    clarityCutoff,
    simOverallCutoff,
    popularityCutoff,
    energyRange,
    totalTracks: allTracks.length
  });
  
  // Step 1: Apply core filters
  let correct = allTracks.filter(t => {
    const passesCoreFilters = (
      t.radio_fit >= radioFitCutoff &&
      (t.clarity ?? 0) >= clarityCutoff &&
      (t.similarity ?? 0) >= simOverallCutoff &&
      (t.popularity ?? 0) >= popularityCutoff
    );
    
    if (!passesCoreFilters) return false;
    
    // Audio feature ranges
    return (
    (t.energy ?? 0.5) >= (energyRange?.[0] ?? 0) && (t.energy ?? 0.5) <= (energyRange?.[1] ?? 1) &&
    (t.danceability ?? 0.5) >= (danceabilityRange?.[0] ?? 0) && (t.danceability ?? 0.5) <= (danceabilityRange?.[1] ?? 1) &&
    (t.valence ?? 0.5) >= (valenceRange?.[0] ?? 0) && (t.valence ?? 0.5) <= (valenceRange?.[1] ?? 1) &&
    (t.tempo ?? 120) >= (tempoRange?.[0] ?? 60) && (t.tempo ?? 120) <= (tempoRange?.[1] ?? 200) &&
    (t.acousticness ?? 0.5) >= (acousticnessRange?.[0] ?? 0) && (t.acousticness ?? 0.5) <= (acousticnessRange?.[1] ?? 1) &&
    (t.instrumentalness ?? 0) >= (instrumentalnessRange?.[0] ?? 0) && (t.instrumentalness ?? 0) <= (instrumentalnessRange?.[1] ?? 1) &&
    (t.speechiness ?? 0.05) >= (speechinessRange?.[0] ?? 0) && (t.speechiness ?? 0.05) <= (speechinessRange?.[1] ?? 1) &&
    (t.liveness ?? 0.1) >= (livenessRange?.[0] ?? 0) && (t.liveness ?? 0.1) <= (livenessRange?.[1] ?? 1) &&
    (t.loudness ?? -10) >= (loudnessRange?.[0] ?? -60) && (t.loudness ?? -10) <= (loudnessRange?.[1] ?? 0) &&
    (t.year ?? 2000) >= (yearRange?.[0] ?? 1950) && (t.year ?? 2000) <= (yearRange?.[1] ?? 2025)
    );
  });

  
  
  // Step 2: Apply same-artist percentage limit
  if (maxSameArtistPercent < 100) {
    const sameArtistTracks = correct.filter(t => t.same_artist);
    const differentArtistTracks = correct.filter(t => !t.same_artist);
    
    const maxAllowed = Math.ceil(correct.length * (maxSameArtistPercent / 100));
    const limitedSameArtist = sameArtistTracks.slice(0, maxAllowed);
    
    correct = [...differentArtistTracks, ...limitedSameArtist];
  }
  
  // Step 3: Everything else is wrong
  const correctIds = new Set(correct.map(t => t.track_id));
  const wrong = allTracks.filter(t => !correctIds.has(t.track_id));
  
  setCorrectPool(correct);
  setWrongPool(wrong);
  
  console.log(`Filters: ${correct.length} correct (${correct.filter(t => t.same_artist).length} same artist), ${wrong.length} wrong`);
}, [allTracks, radioFitCutoff, clarityCutoff, simOverallCutoff, popularityCutoff, energyRange, danceabilityRange, valenceRange, tempoRange, acousticnessRange, instrumentalnessRange, speechinessRange, livenessRange, loudnessRange, yearRange, maxSameArtistPercent]);
  
  // Generate new quiz when pools or counts change
  useEffect(() => {
    if (correctPool.length === 0 || wrongPool.length === 0) return;
    generateQuiz();
  }, [correctPool, wrongPool, correctCount, wrongCount, maxSameArtistPercent]);
  
  const generateQuiz = () => {
    const options = [];
    
    const shuffledCorrect = [...correctPool].sort(() => Math.random() - 0.5);
    const maxSameArtist = Math.ceil((correctCount * maxSameArtistPercent) / 100);
    let sameArtistCount = 0;
    
    for (let i = 0; i < shuffledCorrect.length && options.length < correctCount; i++) {
      const track = shuffledCorrect[i];
      if (track.same_artist) {
        if (sameArtistCount < maxSameArtist) {
          options.push({ ...track, isCorrect: true });
          sameArtistCount++;
        }
      } else {
        options.push({ ...track, isCorrect: true });
      }
    }
    
    const shuffledWrong = [...wrongPool].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(wrongCount, shuffledWrong.length); i++) {
      options.push({ ...shuffledWrong[i], isCorrect: false });
    }
    
    setCurrentOptions(options.sort(() => Math.random() - 0.5));
  };
  
  const applyDifficulty = (preset) => {
    setRadioFitCutoff(preset.radioFitCutoff);
    setClarityCutoff(preset.clarityCutoff);
    setSimOverallCutoff(preset.simOverallCutoff);
    setPopularityCutoff(preset.popularityCutoff);
    setCorrectCount(preset.correctCount);
    setWrongCount(preset.wrongCount);
    setMaxSameArtistPercent(preset.maxSameArtistPercent);
    setEnergyRange(preset.energyRange);
    setDanceabilityRange(preset.danceabilityRange);
    setValenceRange(preset.valenceRange);
    setTempoRange(preset.tempoRange);
    setAcousticnessRange(preset.acousticnessRange);
    setInstrumentalnessRange(preset.instrumentalnessRange);
    setSpeechinessRange(preset.speechinessRange);
    setLivenessRange(preset.livenessRange);
    setLoudnessRange(preset.loudnessRange);
    setYearRange(preset.yearRange);
  };
  
const handleGuess = (option) => {
  if (guessesLeft <= 0) return;
  
  // Add to history
  setGuessHistory(prev => [...prev, {
    track: option,
    wasCorrect: option.isCorrect,
    timestamp: Date.now()
  }]);
  
  if (option.isCorrect) {
    setScore(score + 1);
    setFeedback(`✓ Correct! "${option.track_name}" is on the playlist`);
  } else {
    setFeedback(`✗ Nope. "${option.track_name}" (radio_fit: ${option.radio_fit.toFixed(2)}) isn't on the list`);
  }
  
  setGuessesLeft(guessesLeft - 1);
  
  setTimeout(() => {
    setFeedback('');
    if (guessesLeft - 1 > 0) {
      generateQuiz();
    }
  }, 1000);
};
  
  const toggleAttribute = (attr) => {
    setExpandedAttributes(prev => ({
      ...prev,
      [attr]: !prev[attr]
    }));
  };
  
  if (!seedSong) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }
  
  if (guessesLeft === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h1>Final Score: {score} / 10</h1>
        <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>Play Again</button>
      </div>
    );
  }
  
  const AttributeSlider = ({ label, value, range, onChange, min, max, step, attribute, description, isTempoScale, isYearScale, isLoudnessScale, showTopBottom }) => (
    <div style={{ marginBottom: '15px' }}>
      <label style={{ cursor: 'pointer' }} onClick={() => showTopBottom && toggleAttribute(attribute)}>
        <strong>{label}:</strong> {Array.isArray(value) ? `${(value[0] ?? 0).toFixed(isYearScale ? 0 : 2)} - ${(value[1] ?? 0).toFixed(isYearScale ? 0 : 2)}` : (value ?? 0).toFixed(2)}
        {showTopBottom && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>{expandedAttributes[attribute] ? '▼' : '▶'}</span>}
      </label>
    
    

      <div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>{description}</div>
      {Array.isArray(value) ? (
        <div style={{ display: 'flex', gap: '5px' }}>
          <input type="range" min={min} max={max} step={step} value={value[0]} onChange={(e) => onChange([parseFloat(e.target.value), value[1]])} style={{ width: '50%' }} />
          <input type="range" min={min} max={max} step={step} value={value[1]} onChange={(e) => onChange([value[0], parseFloat(e.target.value)])} style={{ width: '50%' }} />
        </div>
      ) : (
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: '100%' }} />
      )}
      {range && <Histogram tracks={correctPool} attribute={attribute} range={Array.isArray(value) ? value : [value, max]} seedValue={seedSong?.[attribute]} isTempoScale={isTempoScale} isYearScale={isYearScale} isLoudnessScale={isLoudnessScale} />}
      {showTopBottom && expandedAttributes[attribute] && (
        <AttributeDetail tracks={correctPool} attribute={attribute} range={value} isTempoScale={isTempoScale} isYearScale={isYearScale} isLoudnessScale={isLoudnessScale} />
      )}
    </div>
  );

  const similarityToText = (value) => {
  if (value >= 0.9) return "almost exactly";
  if (value >= 0.7) return "a lot";
  if (value >= 0.5) return "some";
  if (value >= 0.3) return "not much";
  return "very little";
};

const getTopSimilarityReasons = (track) => {
  if (!track.sim_components) return [];
  
  const sorted = Object.entries(track.sim_components)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);
  
  return sorted.map(([feature, value]) => ({
    feature,
    value,
    text: similarityToText(value)
  }));
};
  
  return (
    <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto' }}>
      <div style={{ background: '#f0f0f0', padding: '15px', marginBottom: '20px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>Tuning Panel</h3>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
            Total Pool: {correctPool.length + wrongPool.length} | 
            <span style={{ color: '#4CAF50', marginLeft: '8px' }}>✓ Correct: {correctPool.length}</span> | 
            <span style={{ color: '#f44336', marginLeft: '8px' }}>✗ Wrong: {wrongPool.length}</span>
          </div>
        </div>
        
        <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
          <button onClick={() => applyDifficulty(DIFFICULTY_PRESETS.easy)} style={{ padding: '10px 20px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            Easy Mode
          </button>
          
          <button onClick={() => applyDifficulty(DIFFICULTY_PRESETS.medium)} style={{ padding: '10px 20px', background: '#FF9800', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            Medium Mode
          </button>
          
          <button onClick={() => applyDifficulty(DIFFICULTY_PRESETS.hard)} style={{ padding: '10px 20px', background: '#f44336', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            Hard Mode
          </button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px' }}>
          {/* Core filters */}
          <div>
            <h4>Core Filters</h4>
            <AttributeSlider label="Radio Fit Cutoff" value={radioFitCutoff} range={true} onChange={setRadioFitCutoff} min={0.3} max={1.0} step={0.05} attribute="radio_fit" description={ATTRIBUTE_DESCRIPTIONS.radio_fit} showTopBottom={true} />
            <AttributeSlider label="Clarity Cutoff" value={clarityCutoff} range={true} onChange={setClarityCutoff} min={0.0} max={1.0} step={0.05} attribute="clarity" description={ATTRIBUTE_DESCRIPTIONS.clarity} showTopBottom={true} />
            <AttributeSlider label="Sim Overall Cutoff" value={simOverallCutoff} range={true} onChange={setSimOverallCutoff} min={0.3} max={1.0} step={0.05} attribute="similarity" description={ATTRIBUTE_DESCRIPTIONS.similarity} showTopBottom={true} />
            <AttributeSlider label="Min Popularity" value={popularityCutoff} range={true} onChange={setPopularityCutoff} min={0} max={100} step={5} attribute="popularity" description={ATTRIBUTE_DESCRIPTIONS.popularity} showTopBottom={true} />
            
            <label style={{ marginTop: '10px', display: 'block' }}>
              <strong>Max Same Artist %:</strong> {maxSameArtistPercent}
              <div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>Maximum percentage of correct answers that can be by the seed artist</div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                step="5" 
                value={maxSameArtistPercent}
                onChange={(e) => setMaxSameArtistPercent(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </label>
            
            <label style={{ marginTop: '10px', display: 'block' }}>
              <strong>Correct Songs:</strong> {correctCount}
              <div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>Number of correct answers to show</div>
              <input 
                type="range" 
                min="0" 
                max="4" 
                step="1" 
                value={correctCount}
                onChange={(e) => setCorrectCount(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </label>
            
            <label style={{ marginTop: '10px', display: 'block' }}>
              <strong>Wrong Songs:</strong> {wrongCount}
              <div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>Number of wrong answers (red herrings) to show</div>
              <input 
                type="range" 
                min="0" 
                max="4" 
                step="1" 
                value={wrongCount}
                onChange={(e) => setWrongCount(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </label>
          </div>
          
          {/* Audio features column 1 */}
          <div>
            <h4>Audio Features (Part 1)</h4>
            <AttributeSlider label="Energy" value={energyRange} range={true} onChange={setEnergyRange} min={0} max={1} step={0.05} attribute="energy" description={ATTRIBUTE_DESCRIPTIONS.energy} showTopBottom={true} />
            <AttributeSlider label="Danceability" value={danceabilityRange} range={true} onChange={setDanceabilityRange} min={0} max={1} step={0.05} attribute="danceability" description={ATTRIBUTE_DESCRIPTIONS.danceability} showTopBottom={true} />
            <AttributeSlider label="Valence" value={valenceRange} range={true} onChange={setValenceRange} min={0} max={1} step={0.05} attribute="valence" description={ATTRIBUTE_DESCRIPTIONS.valence} showTopBottom={true} />
            <AttributeSlider label="Acousticness" value={acousticnessRange} range={true} onChange={setAcousticnessRange} min={0} max={1} step={0.05} attribute="acousticness" description={ATTRIBUTE_DESCRIPTIONS.acousticness} showTopBottom={true} />
          </div>
          
          {/* Audio features column 2 */}
          <div>
            <h4>Audio Features (Part 2)</h4>
            <AttributeSlider label="Tempo" value={tempoRange} range={true} onChange={setTempoRange} min={60} max={200} step={5} attribute="tempo" description={ATTRIBUTE_DESCRIPTIONS.tempo} isTempoScale={true} showTopBottom={true} />
            <AttributeSlider label="Instrumentalness" value={instrumentalnessRange} range={true} onChange={setInstrumentalnessRange} min={0} max={1} step={0.05} attribute="instrumentalness" description={ATTRIBUTE_DESCRIPTIONS.instrumentalness} showTopBottom={true} />
            <AttributeSlider label="Speechiness" value={speechinessRange} range={true} onChange={setSpeechinessRange} min={0} max={1} step={0.05} attribute="speechiness" description={ATTRIBUTE_DESCRIPTIONS.speechiness} showTopBottom={true} />
            <AttributeSlider label="Liveness" value={livenessRange} range={true} onChange={setLivenessRange} min={0} max={1} step={0.05} attribute="liveness" description={ATTRIBUTE_DESCRIPTIONS.liveness} showTopBottom={true} />
          </div>
          
          {/* Metadata */}
          <div>
            <h4>Metadata</h4>
            <AttributeSlider label="Loudness" value={loudnessRange} range={true} onChange={setLoudnessRange} min={-60} max={0} step={1} attribute="loudness" description={ATTRIBUTE_DESCRIPTIONS.loudness} isLoudnessScale={true} showTopBottom={true} />
            <AttributeSlider label="Release Year" value={yearRange} range={true} onChange={setYearRange} min={1950} max={2025} step={1} attribute="year" description={ATTRIBUTE_DESCRIPTIONS.year} isYearScale={true} showTopBottom={true} />
          </div>
        </div>
        
        <div style={{ marginTop: '15px', fontSize: '11px', color: '#666' }}>
          🎯 = seed position | Green bars = within selected range | Gradient to red = outside range | Click attribute labels to see top/bottom 3 tracks
        </div>
      </div>
      
{/* Track tables */}
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
  <div style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
    <h4 style={{ marginTop: 0, color: '#4CAF50' }}>✓ Correct Pool ({correctPool.length} tracks)</h4>
    <TrackTable 
      tracks={correctPool.map(t => ({ ...t, isCorrect: true }))} 
      expandedTrack={expandedTrack} 
      onToggleTrack={(idx) => setExpandedTrack(expandedTrack === idx ? null : idx)} 
    />
  </div>
  
  <div style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
    <h4 style={{ marginTop: 0, color: '#f44336' }}>✗ Wrong Pool ({wrongPool.length} tracks)</h4>
    <TrackTable 
      tracks={wrongPool.map(t => ({ ...t, isCorrect: false }))} 
      expandedTrack={expandedTrack} 
      onToggleTrack={(idx) => setExpandedTrack(expandedTrack === idx ? null : idx)} 
    />
  </div>
</div>
      
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2>Score: {score} | Guesses Left: {guessesLeft}</h2>
      </div>
      
      <div style={{ marginBottom: '30px', padding: '20px', background: '#fff', border: '2px solid #333', borderRadius: '8px' }}>
        <h3>Seed Song</h3>
        <p style={{ fontSize: '18px', margin: '5px 0' }}><strong>{seedSong.track_name}</strong></p>
        <p style={{ color: '#666' }}>{seedSong.artists} ({seedSong.year})</p>
      </div>
      
      <h3>Which of these songs belong on the radio station?</h3>
      
      {feedback && (
        <div style={{ padding: '15px', marginBottom: '20px', background: feedback.startsWith('✓') ? '#d4edda' : '#f8d7da', borderRadius: '8px' }}>
          {feedback}
        </div>
      )}
      
      <div style={{ display: 'grid', gap: '10px' }}>
        {currentOptions.map((option, idx) => (
          <button
            key={idx}
            onClick={() => handleGuess(option)}
            style={{
              padding: '20px',
              background: '#fff',
              border: `3px solid ${option.isCorrect ? '#4CAF50' : '#f44336'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div><strong>{option.track_name}</strong></div>
                <div style={{ color: '#666', fontSize: '14px' }}>
                    {option.artists}
                    {option.year && ` (${option.year})`}
                </div>
              </div>
              {!option.isCorrect && <span style={{ color: '#f44336', fontWeight: 'bold', fontSize: '14px' }}>RED HERRING</span>}
            </div>
            <div style={{ color: '#999', fontSize: '12px', marginTop: '8px' }}>
              radio_fit: {option.radio_fit?.toFixed(3)} | clarity: {option.clarity?.toFixed(3)} | energy: {option.energy?.toFixed(2)} | dance: {option.danceability?.toFixed(2)}
            </div>
          </button>
        ))}
      </div>
      {/* Guess History */}
{guessHistory.length > 0 && (
  <div style={{ marginTop: '40px' }}>
    <h3>Your Guesses This Round</h3>
    <div style={{ display: 'grid', gap: '10px' }}>
      {guessHistory.map((guess, idx) => {
        const reasons = getTopSimilarityReasons(guess.track);
        
        return (
          <div
            key={idx}
            style={{
              padding: '15px',
              background: '#f9f9f9',
              border: `2px solid ${guess.wasCorrect ? '#4CAF50' : '#f44336'}`,
              borderRadius: '8px',
              fontSize: '14px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <strong>{guess.track.track_name}</strong>
                <div style={{ color: '#666', fontSize: '12px' }}>{guess.track.artists}</div>
              </div>
              <span style={{ 
                fontWeight: 'bold', 
                color: guess.wasCorrect ? '#4CAF50' : '#f44336' 
              }}>
                {guess.wasCorrect ? '✓ CORRECT' : '✗ WRONG'}
              </span>
            </div>
            
            <div style={{ fontSize: '12px', color: '#555', fontStyle: 'italic' }}>
              <strong>Why?</strong> This song {guess.wasCorrect ? 'matched' : "didn't match"} on{' '}
              {reasons.map((r, i) => (
                <span key={i}>
                  <strong>{r.feature}</strong> ({r.text})
                  {i < reasons.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}
    </div>
  );
};

export default MiniGame;