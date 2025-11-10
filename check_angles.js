const manifest = require('./public/genre_constellation_manifest.json');

// Filter out instrumentalness
const features = manifest.global.display.feature_angles.filter(f => f !== 'instrumentalness');

console.log('\n📐 FEATURE ANGLES ON RING:');
console.log('========================\n');

features.forEach((f, i) => {
  const angle = i * (360 / (features.length * 2));
  console.log(`  ${i}. ${f.padEnd(20)} → high at ${angle.toFixed(1)}° | low at ${(angle + 180).toFixed(1)}°`);
});

// Check classical's features
const classical = manifest.classical.features;
console.log('\n🎼 CLASSICAL MUSIC FEATURES:');
console.log('===========================\n');
Object.keys(classical).forEach(k => {
  if (k !== 'instrumentalness' && k !== 'tempo_bpm') {
    console.log(`  ${k.padEnd(20)} = ${classical[k]}`);
  }
});

// Calculate where classical SHOULD be positioned
console.log('\n📍 CLASSICAL IDEAL POSITION:');
console.log('===========================\n');

// Simulate the position calculation
const numSegments = features.length * 2;
const segmentAngleStep = (Math.PI * 2) / numSegments;

let x = 0, y = 0;
const EXAGGERATION = 1.2;
const projection_scale = 180;

features.forEach((feature, i) => {
  const value = classical[feature];
  if (value == null) return;

  // Simplified normalization (assume value is already normalized 0-1)
  const percentile = value;
  const weight = (percentile - 0.5) * 2 * EXAGGERATION;

  const angle = i * segmentAngleStep;
  const angleDeg = angle * 180 / Math.PI;

  x += weight * Math.cos(angle);
  y += weight * Math.sin(angle);

  if (Math.abs(weight) > 0.3) {
    console.log(`  ${feature.padEnd(20)}: ${value.toFixed(2)} → weight ${weight.toFixed(2)} at ${angleDeg.toFixed(1)}°`);
  }
});

console.log(`\n  Final position (before scaling): (${x.toFixed(1)}, ${y.toFixed(1)})`);

// Check coordinates system
console.log('\n🧭 COORDINATE SYSTEM:');
console.log('====================\n');
console.log('  0° = RIGHT (+x)');
console.log('  90° = DOWN (+y) ← ⚠️ SVG Y-axis points DOWN');
console.log('  180° = LEFT (-x)');
console.log('  270° = UP (-y)');
