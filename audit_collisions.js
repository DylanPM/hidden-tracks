/**
 * Collision Audit Script
 *
 * Shows how much collision avoidance moves nodes from their ideal positions
 */

const fs = require('fs');

// Load manifest
const manifest = JSON.parse(fs.readFileSync('./public/genre_constellation_manifest.json', 'utf8'));

// Configuration (matching useFeatureMap.js)
const EXAGGERATION = 1.2;
const TARGET_RADIUS = 220; // Updated to match current implementation

// Filter out instrumentalness
const feature_angles = manifest.global.display.feature_angles.filter(f => f !== 'instrumentalness');
const projection_scale = manifest.global.display.projection_scale;
const speechiness_contrast_gamma = manifest.global.display.speechiness_contrast_gamma;
const globalQuantiles = manifest.global.quantiles;

// Calculate angles for each feature
const numSegments = feature_angles.length * 2;
const segmentAngleStep = (Math.PI * 2) / numSegments;
const featureAngles = {};
feature_angles.forEach((feature, i) => {
  featureAngles[feature] = i * segmentAngleStep;
});

// Normalize a feature value
function normalizeFeature(value, featureName, quantiles) {
  if (value == null || isNaN(value)) return 0.5;
  const q = quantiles[featureName];
  if (!q) return 0.5;

  if (value <= q.p10) return 0.1;
  if (value <= q.p50) return 0.1 + 0.4 * ((value - q.p10) / (q.p50 - q.p10));
  if (value <= q.p90) return 0.5 + 0.4 * ((value - q.p50) / (q.p90 - q.p50));
  return 0.9 + 0.1 * Math.min(1, (value - q.p90) / (q.p90 - q.p50));
}

// Apply contrast curve
function applyContrastCurve(percentile, featureName) {
  if (featureName === 'speechiness') {
    return Math.pow(percentile, 1 / speechiness_contrast_gamma);
  }
  return percentile;
}

// Project features to 2D
function projectTo2D(features, quantiles) {
  let x = 0, y = 0;

  feature_angles.forEach(featureName => {
    const rawValue = features[featureName];
    let percentile = normalizeFeature(rawValue, featureName, quantiles);
    percentile = applyContrastCurve(percentile, featureName);

    const weight = (percentile - 0.5) * 2 * EXAGGERATION;
    const angle = featureAngles[featureName];
    x += weight * Math.cos(angle);
    y += weight * Math.sin(angle);
  });

  return {
    x: x * projection_scale,
    y: y * projection_scale
  };
}

// Apply log scaling
function applyLogScale(distance, maxDist) {
  if (maxDist === 0) return 0;
  const normalized = distance / maxDist;
  const logged = Math.log2(1 + normalized) / Math.log2(2);
  return logged * maxDist;
}

// Process all nodes
const rawPositions = {};
const nodeFeatures = {};

function processNode(node, path = []) {
  const key = path.join('.');
  if (!key) return;

  if (node.features) {
    const pos = projectTo2D(node.features, globalQuantiles);
    rawPositions[key] = pos;
    nodeFeatures[key] = node.features;
  }

  if (node.subgenres) {
    Object.keys(node.subgenres).forEach(subkey => {
      processNode(node.subgenres[subkey], [...path, subkey]);
    });
  }
}

// Process all genres
Object.keys(manifest).forEach(genreKey => {
  if (genreKey === 'global' || genreKey === 'build') return;
  processNode(manifest[genreKey], [genreKey]);
});

// Find max radius
let maxRadius = 0;
Object.values(rawPositions).forEach(pos => {
  const distance = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
  if (distance > maxRadius) maxRadius = distance;
});

const adaptiveScale = maxRadius > 0 ? TARGET_RADIUS / maxRadius : 1;

// Apply adaptive scaling with log transform
const scaledPositions = {};
Object.keys(rawPositions).forEach(key => {
  const x = rawPositions[key].x * adaptiveScale;
  const y = rawPositions[key].y * adaptiveScale;
  const distance = Math.sqrt(x * x + y * y);
  const logDistance = applyLogScale(distance, TARGET_RADIUS);
  const scale = distance > 0 ? logDistance / distance : 1;

  scaledPositions[key] = {
    x: x * scale,
    y: y * scale,
    features: nodeFeatures[key]
  };
});

console.log(`\n📍 COLLISION AVOIDANCE AUDIT`);
console.log(`============================\n`);

// Apply collision avoidance (matching useFeatureMap.js)
const MIN_DISTANCE = 40;
const PUSH_STRENGTH = 0.3;
const MAX_ITERATIONS = 3;
const DAMPING = 0.85;

const finalPositions = JSON.parse(JSON.stringify(scaledPositions));

for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
  const keys = Object.keys(finalPositions);
  let hadCollision = false;
  let collisionCount = 0;

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const node1 = finalPositions[keys[i]];
      const node2 = finalPositions[keys[j]];

      const dx = node2.x - node1.x;
      const dy = node2.y - node1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < MIN_DISTANCE && distance > 0) {
        hadCollision = true;
        collisionCount++;

        // Get push direction based on strongest feature
        const getPushDirection = (features) => {
          if (!features) return { x: 0, y: 0 };

          let strongestFeature = null;
          let strongestWeight = 0;

          feature_angles.forEach(featureName => {
            const value = features[featureName];
            if (value == null) return;

            const weight = Math.abs(value - 0.5);
            if (weight > strongestWeight) {
              strongestWeight = weight;
              strongestFeature = featureName;
            }
          });

          if (!strongestFeature) return { x: 0, y: 0 };

          const angle = featureAngles[strongestFeature];
          const isHigh = features[strongestFeature] > 0.5;
          const direction = isHigh ? 1 : -1;

          return {
            x: Math.cos(angle) * direction,
            y: Math.sin(angle) * direction
          };
        };

        const push1Dir = getPushDirection(node1.features);
        const push2Dir = getPushDirection(node2.features);

        const currentStrength = PUSH_STRENGTH * Math.pow(DAMPING, iteration);
        const overlap = MIN_DISTANCE - distance;
        const pushDist = overlap * currentStrength / 2;

        const push1X = push1Dir.x !== 0 ? push1Dir.x * pushDist : -(dx / distance) * pushDist;
        const push1Y = push1Dir.y !== 0 ? push1Dir.y * pushDist : -(dy / distance) * pushDist;
        const push2X = push2Dir.x !== 0 ? push2Dir.x * pushDist : (dx / distance) * pushDist;
        const push2Y = push2Dir.y !== 0 ? push2Dir.y * pushDist : (dy / distance) * pushDist;

        node1.x += push1X;
        node1.y += push1Y;
        node2.x += push2X;
        node2.y += push2Y;

        // Clamp to boundary
        [node1, node2].forEach(node => {
          const dist = Math.sqrt(node.x * node.x + node.y * node.y);
          if (dist > TARGET_RADIUS) {
            const scale = TARGET_RADIUS / dist;
            node.x *= scale;
            node.y *= scale;
          }
        });
      }
    }
  }

  console.log(`Iteration ${iteration + 1}: ${collisionCount} collisions resolved`);
  if (!hadCollision) break;
}

// Calculate displacement for each node
const displacements = Object.keys(scaledPositions).map(key => {
  const ideal = scaledPositions[key];
  const actual = finalPositions[key];

  const idealDist = Math.sqrt(ideal.x * ideal.x + ideal.y * ideal.y);
  const actualDist = Math.sqrt(actual.x * actual.x + actual.y * actual.y);
  const displacement = Math.sqrt(
    Math.pow(actual.x - ideal.x, 2) + Math.pow(actual.y - ideal.y, 2)
  );
  const displacementPct = idealDist > 0 ? (displacement / idealDist * 100) : 0;

  return {
    key,
    ideal: { x: ideal.x, y: ideal.y, dist: idealDist },
    actual: { x: actual.x, y: actual.y, dist: actualDist },
    displacement,
    displacementPct
  };
});

// Sort by displacement
displacements.sort((a, b) => b.displacement - a.displacement);

console.log(`\n📊 TOP 20 MOST DISPLACED NODES:`);
console.log(`   (showing how far collision avoidance pushed them from ideal)\n`);

displacements.slice(0, 20).forEach((node, i) => {
  const angleChange = Math.atan2(node.actual.y, node.actual.x) - Math.atan2(node.ideal.y, node.ideal.x);
  const angleDeg = (angleChange * 180 / Math.PI).toFixed(1);

  console.log(`${(i+1).toString().padStart(2)}. ${node.key.padEnd(40)} → moved ${node.displacement.toFixed(1)}px (${node.displacementPct.toFixed(1)}% of ideal dist) | angle shift: ${angleDeg}°`);
});

console.log(`\n📈 STATISTICS:`);
console.log(`   Average displacement: ${(displacements.reduce((sum, n) => sum + n.displacement, 0) / displacements.length).toFixed(1)}px`);
console.log(`   Max displacement: ${displacements[0].displacement.toFixed(1)}px`);
console.log(`   Nodes with >20px displacement: ${displacements.filter(n => n.displacement > 20).length}`);
console.log(`   Nodes with >50px displacement: ${displacements.filter(n => n.displacement > 50).length}`);

// Check root-level genres specifically
console.log(`\n🎯 ROOT LEVEL GENRES (the ones you see first):`);
const rootGenres = displacements.filter(d => !d.key.includes('.'));
rootGenres.forEach(node => {
  console.log(`   ${node.key.padEnd(25)} → ideal: (${node.ideal.x.toFixed(0)}, ${node.ideal.y.toFixed(0)}) | actual: (${node.actual.x.toFixed(0)}, ${node.actual.y.toFixed(0)}) | moved: ${node.displacement.toFixed(1)}px`);
});

console.log(`\n✅ Audit complete!\n`);
