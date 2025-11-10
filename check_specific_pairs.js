/**
 * Check Specific Node Pairs
 *
 * Checks distances between the specific pairs the user mentioned are too close
 */

const fs = require('fs');

// Load manifest
const manifest = JSON.parse(fs.readFileSync('./public/genre_constellation_manifest.json', 'utf8'));

// Configuration
const BASE_EXAGGERATION = 1.2;
const TARGET_RADIUS = 220;

const feature_angles = manifest.global.display.feature_angles.filter(f => f !== 'instrumentalness');
const projection_scale = manifest.global.display.projection_scale;
const speechiness_contrast_gamma = manifest.global.display.speechiness_contrast_gamma;
const globalQuantiles = manifest.global.quantiles;

const numSegments = feature_angles.length * 2;
const segmentAngleStep = (Math.PI * 2) / numSegments;
const featureAngles = {};
feature_angles.forEach((feature, i) => {
  featureAngles[feature] = i * segmentAngleStep;
});

function normalizeFeature(value, featureName, quantiles) {
  if (value == null || isNaN(value)) return 0.5;
  const q = quantiles[featureName];
  if (!q) return 0.5;

  if (value <= q.p10) return 0.1;
  if (value <= q.p50) return 0.1 + 0.4 * ((value - q.p10) / (q.p50 - q.p10));
  if (value <= q.p90) return 0.5 + 0.4 * ((value - q.p50) / (q.p90 - q.p50));
  return 0.9 + 0.1 * Math.min(1, (value - q.p90) / (q.p90 - q.p50));
}

function applyContrastCurve(percentile, featureName) {
  if (featureName === 'speechiness') {
    return Math.pow(percentile, 1 / speechiness_contrast_gamma);
  }
  return percentile;
}

function projectTo2D(features, quantiles, depth = 0) {
  let x = 0, y = 0;

  const depthExaggeration = depth === 0 ? 1.6 : (depth === 1 ? 1.2 : 1.0);
  const effectiveExaggeration = BASE_EXAGGERATION * depthExaggeration;

  feature_angles.forEach(featureName => {
    const rawValue = features[featureName];
    let percentile = normalizeFeature(rawValue, featureName, quantiles);
    percentile = applyContrastCurve(percentile, featureName);

    const weight = (percentile - 0.5) * 2 * effectiveExaggeration;
    const angle = featureAngles[featureName];
    x += weight * Math.cos(angle);
    y += weight * Math.sin(angle);
  });

  return {
    x: x * projection_scale,
    y: y * projection_scale
  };
}

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

  const depth = path.length - 1;

  if (node.features) {
    const pos = projectTo2D(node.features, globalQuantiles, depth);
    rawPositions[key] = pos;
    nodeFeatures[key] = node.features;
  }

  if (node.subgenres) {
    Object.keys(node.subgenres).forEach(subkey => {
      processNode(node.subgenres[subkey], [...path, subkey]);
    });
  }
}

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

// Apply collision avoidance
const MIN_DISTANCE_SIBLING = 60;
const MIN_DISTANCE_PARENT_CHILD = 65;
const MIN_DISTANCE_DEFAULT = 40;
const PUSH_STRENGTH = 0.6;
const MAX_ITERATIONS = 10;
const DAMPING = 0.95;

// Helper to determine relationship between two nodes
const getNodeRelationship = (key1, key2) => {
  const parts1 = key1.split('.');
  const parts2 = key2.split('.');

  // Parent-child if one is direct parent of the other
  if (parts1.length === parts2.length - 1 && key2.startsWith(key1 + '.')) {
    return 'parent-child';
  }
  if (parts2.length === parts1.length - 1 && key1.startsWith(key2 + '.')) {
    return 'parent-child';
  }

  // Siblings if they have the same parent
  if (parts1.length === parts2.length && parts1.length > 1) {
    const parent1 = parts1.slice(0, -1).join('.');
    const parent2 = parts2.slice(0, -1).join('.');
    if (parent1 === parent2) {
      return 'sibling';
    }
  }

  return 'unrelated';
};

const finalPositions = JSON.parse(JSON.stringify(scaledPositions));

for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
  const keys = Object.keys(finalPositions);

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const key1 = keys[i];
      const key2 = keys[j];
      const node1 = finalPositions[key1];
      const node2 = finalPositions[key2];

      const dx = node2.x - node1.x;
      const dy = node2.y - node1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const relationship = getNodeRelationship(key1, key2);
      const minDistance =
        relationship === 'parent-child' ? MIN_DISTANCE_PARENT_CHILD :
        relationship === 'sibling' ? MIN_DISTANCE_SIBLING :
        MIN_DISTANCE_DEFAULT;

      if (distance < minDistance && distance > 0) {
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
        const overlap = minDistance - distance;
        const pushDist = overlap * currentStrength / 2;

        const push1X = push1Dir.x !== 0 ? push1Dir.x * pushDist : -(dx / distance) * pushDist;
        const push1Y = push1Dir.y !== 0 ? push1Dir.y * pushDist : -(dy / distance) * pushDist;
        const push2X = push2Dir.x !== 0 ? push2Dir.x * pushDist : (dx / distance) * pushDist;
        const push2Y = push2Dir.y !== 0 ? push2Dir.y * pushDist : (dy / distance) * pushDist;

        node1.x += push1X;
        node1.y += push1Y;
        node2.x += push2X;
        node2.y += push2Y;

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
}

// Check specific pairs
console.log('\n🔍 CHECKING SPECIFIC NODE PAIRS:');
console.log('================================\n');

const pairs = [
  ['classical.modern classical', 'classical.romantic'],
  ['jazz.jazz fusion', 'jazz.bebop'],
  ['rock.Heavy', 'rock'],
  ['rock.Modern.indie rock', 'rock.Modern'],
  ['pop.dance pop', 'pop'],
  ['country.roots rock', 'country.southern rock'],
  ['latin.Classic Dance.merengue', 'latin.Classic Dance'],
  ['electronic.trance', 'electronic.techno'],
  ['Caribbean & African.afropop', 'Caribbean & African.dancehall'],
  ['Caribbean & African.afropop', 'Caribbean & African'],
  ['Caribbean & African.dancehall', 'Caribbean & African'],
  ['Caribbean & African.amapiano', 'Caribbean & African.dub']
];

pairs.forEach(([key1, key2]) => {
  const pos1 = finalPositions[key1];
  const pos2 = finalPositions[key2];

  if (!pos1 || !pos2) {
    console.log(`❌ ${key1} <-> ${key2}: ONE OR BOTH NOT FOUND`);
    return;
  }

  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const status = distance < 40 ? '🔴 TOO CLOSE' : (distance < 60 ? '🟡 CLOSE' : '🟢 OK');

  console.log(`${status} ${distance.toFixed(1)}px | ${key1.padEnd(45)} <-> ${key2}`);
});

console.log('\n✅ Check complete!\n');
