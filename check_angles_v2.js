const manifest = require('./public/genre_constellation_manifest.json');

// Filter out instrumentalness
const features = manifest.global.display.feature_angles.filter(f => f !== 'instrumentalness');
const quantiles = manifest.global.quantiles;

console.log('\n📐 FEATURE ANGLES ON RING:');
console.log('========================\n');

features.forEach((f, i) => {
  const angle = i * (360 / (features.length * 2));
  console.log(`  ${i}. ${f.padEnd(20)} → high at ${angle.toFixed(1)}° | low at ${(angle + 180).toFixed(1)}°`);
});

// Normalize function (from useFeatureMap.js)
function normalizeFeature(value, featureName) {
  if (value == null || isNaN(value)) return 0.5;

  const q = quantiles[featureName];
  if (!q) return 0.5;

  if (value <= q.p10) return 0.1;
  if (value <= q.p50) return 0.1 + 0.4 * ((value - q.p10) / (q.p50 - q.p10));
  if (value <= q.p90) return 0.5 + 0.4 * ((value - q.p50) / (q.p90 - q.p50));
  return 0.9 + 0.1 * Math.min(1, (value - q.p90) / (q.p90 - q.p50));
}

// Check classical's features
const classical = manifest.classical.features;
console.log('\n🎼 CLASSICAL MUSIC FEATURES (RAW):');
console.log('==================================\n');
Object.keys(classical).forEach(k => {
  if (k !== 'instrumentalness' && k !== 'tempo_bpm') {
    const normalized = normalizeFeature(classical[k], k);
    console.log(`  ${k.padEnd(20)} = ${classical[k].toFixed(3).padStart(7)} → normalized: ${normalized.toFixed(3)}`);
  }
});

// Calculate where classical SHOULD be positioned
console.log('\n📍 CLASSICAL IDEAL POSITION (WITH PROPER NORMALIZATION):');
console.log('========================================================\n');

const numSegments = features.length * 2;
const segmentAngleStep = (Math.PI * 2) / numSegments;

let x = 0, y = 0;
const EXAGGERATION = 1.2;
const projection_scale = 180;

features.forEach((feature, i) => {
  const rawValue = classical[feature];
  if (rawValue == null) return;

  const percentile = normalizeFeature(rawValue, feature);
  const weight = (percentile - 0.5) * 2 * EXAGGERATION;

  const angle = i * segmentAngleStep;
  const angleDeg = angle * 180 / Math.PI;

  x += weight * Math.cos(angle);
  y += weight * Math.sin(angle);

  console.log(`  ${feature.padEnd(20)}: raw=${rawValue.toFixed(2).padStart(6)} norm=${percentile.toFixed(3)} weight=${weight.toFixed(3).padStart(7)} at ${angleDeg.toFixed(1).padStart(5)}°`);
});

console.log(`\n  Final position (before scaling): (${x.toFixed(1)}, ${y.toFixed(1)})`);

const distance = Math.sqrt(x * x + y * y);
const angleDeg = Math.atan2(y, x) * 180 / Math.PI;
console.log(`  Distance from center: ${distance.toFixed(1)}`);
console.log(`  Angle from center: ${angleDeg.toFixed(1)}° (0°=right, 90°=down, 180°=left, 270°=up)`);
