const fs = require('fs');

const manifest = JSON.parse(fs.readFileSync('public/genre_constellation_manifest.json', 'utf8'));

const { feature_angles, projection_scale, speechiness_contrast_gamma } = manifest.global.display;
const globalQuantiles = manifest.global.quantiles;
const exaggeration = 1.2;

// Axis angles
const segmentAngleStep = (Math.PI * 2) / 16;
const featureAngles = {};
feature_angles.forEach((feature, i) => {
  featureAngles[feature] = i * segmentAngleStep;
});

// Axis names for display
const axisNames = [
  'danceability (0°, right)',
  'energy (22.5°)',
  'speechiness/wordy (45°)',
  'acousticness (67.5°)',
  'valence/happy (90°, top)',
  'tempo_norm (112.5°)',
  'popularity (135°)',
  'instrumentalness (157.5°)'
];

console.log('=== AXIS MAPPING ===');
feature_angles.forEach((f, i) => {
  const degrees = (i * 22.5).toFixed(1);
  const lowDegrees = ((i * 22.5 + 180) % 360).toFixed(1);
  console.log(`${f}: high=${degrees}°, low=${lowDegrees}°`);
});
console.log('');

// Normalize feature value
const normalizeFeature = (value, featureName) => {
  if (value == null || isNaN(value)) return 0.5;
  const q = globalQuantiles[featureName];
  if (!q) return 0.5;

  if (value <= q.p10) return 0.1;
  if (value <= q.p50) return 0.1 + 0.4 * ((value - q.p10) / (q.p50 - q.p10));
  if (value <= q.p90) return 0.5 + 0.4 * ((value - q.p50) / (q.p90 - q.p50));
  return 0.9 + 0.1 * Math.min(1, (value - q.p90) / (q.p90 - q.p50));
};

// Apply contrast curve
const applyContrastCurve = (percentile, featureName) => {
  if (featureName === 'speechiness') {
    return Math.pow(percentile, 1 / speechiness_contrast_gamma);
  }
  return percentile;
};

// Project to 2D
const projectTo2D = (features) => {
  let x = 0;
  let y = 0;
  const contributions = [];

  feature_angles.forEach(featureName => {
    const rawValue = features[featureName];
    let percentile = normalizeFeature(rawValue, featureName);
    percentile = applyContrastCurve(percentile, featureName);

    // Convert to weight: [-1, 1]
    const weight = (percentile - 0.5) * 2 * exaggeration;
    const angle = featureAngles[featureName];
    const xContrib = weight * Math.cos(angle);
    const yContrib = weight * Math.sin(angle);

    x += xContrib;
    y += yContrib;

    contributions.push({
      feature: featureName,
      raw: rawValue,
      percentile: percentile.toFixed(3),
      weight: weight.toFixed(3),
      xContrib: xContrib.toFixed(3),
      yContrib: yContrib.toFixed(3)
    });
  });

  return {
    x: x * projection_scale,
    y: y * projection_scale,
    contributions
  };
};

// Convert to polar for easier understanding
const toPolar = (x, y) => {
  const r = Math.sqrt(x * x + y * y);
  let theta = Math.atan2(y, x);
  if (theta < 0) theta += 2 * Math.PI;
  const degrees = (theta * 180 / Math.PI).toFixed(1);
  return { r: r.toFixed(1), degrees };
};

console.log('=== TOP-LEVEL GENRE POSITIONS ===\n');

const genres = ['jazz', 'classical', 'electronic', 'country', 'hip hop', 'rock', 'pop', 'r&b / soul / funk', 'latin'];

genres.forEach(genreKey => {
  if (!manifest[genreKey]?.features) {
    console.log(`${genreKey}: NO FEATURES FOUND`);
    return;
  }

  const features = manifest[genreKey].features;
  const result = projectTo2D(features);
  const polar = toPolar(result.x, result.y);

  console.log(`\n${genreKey.toUpperCase()}`);
  console.log(`  Position: (${result.x.toFixed(1)}, ${result.y.toFixed(1)})`);
  console.log(`  Polar: r=${polar.r}, θ=${polar.degrees}°`);

  // Show dominant features
  const sorted = result.contributions
    .map(c => ({ ...c, magnitude: Math.abs(parseFloat(c.weight)) }))
    .sort((a, b) => b.magnitude - a.magnitude);

  console.log(`  Top 3 contributors:`);
  sorted.slice(0, 3).forEach(c => {
    const direction = parseFloat(c.weight) > 0 ? 'high' : 'low';
    console.log(`    - ${c.feature} ${direction} (weight: ${c.weight}, raw: ${c.raw})`);
  });
});
