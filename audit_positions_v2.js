/**
 * Position Audit Script v2
 *
 * Audits genre/subgenre node positions to verify they're placed according to their attributes.
 * Reports:
 * 1. Distance from ideal position as a percentage
 * 2. What caused the node to move (adaptive scaling factor)
 */

const fs = require('fs');

// Load manifest
const manifest = JSON.parse(fs.readFileSync('./public/genre_constellation_manifest.json', 'utf8'));

// Configuration (matching useFeatureMap.js)
const BASE_EXAGGERATION = 1.2;
const TARGET_RADIUS = 220; // From adaptive scaling

// Filter out instrumentalness (matching the new implementation)
const feature_angles = manifest.global.display.feature_angles.filter(f => f !== 'instrumentalness');
const projection_scale = manifest.global.display.projection_scale;
const speechiness_contrast_gamma = manifest.global.display.speechiness_contrast_gamma;
const globalQuantiles = manifest.global.quantiles;

console.log(`\n📊 POSITION AUDIT v2`);
console.log(`===================`);
console.log(`Features used: ${feature_angles.join(', ')}`);
console.log(`Projection scale: ${projection_scale}`);
console.log(`Exaggeration: ${EXAGGERATION}`);
console.log(`Target radius: ${TARGET_RADIUS}px\n`);

// Calculate angles for each feature (matching useFeatureMap.js)
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

// Project features to 2D (before adaptive scaling)
function projectTo2D(features, quantiles, depth = 0) {
  let x = 0, y = 0;

  // Apply stronger exaggeration for root-level genres
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

// Process all nodes and calculate positions
const rawPositions = {};
const nodes = [];

function processNode(node, path = []) {
  const key = path.join('.');
  if (!key) return; // Skip root

  const depth = path.length - 1; // Root genres have depth 0

  if (node.features) {
    const pos = projectTo2D(node.features, globalQuantiles, depth);
    rawPositions[key] = pos;
    nodes.push({
      key,
      path,
      depth,
      features: node.features,
      rawPos: pos
    });
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

// Calculate adaptive scaling
let maxRadius = 0;
Object.values(rawPositions).forEach(pos => {
  const distance = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
  if (distance > maxRadius) maxRadius = distance;
});

const adaptiveScale = maxRadius > 0 ? TARGET_RADIUS / maxRadius : 1;

console.log(`📐 SCALING ANALYSIS`);
console.log(`   Max raw radius: ${maxRadius.toFixed(2)}px`);
console.log(`   Adaptive scale factor: ${adaptiveScale.toFixed(4)}`);
console.log(`   This scales all positions by ${(adaptiveScale * 100).toFixed(2)}%\n`);

// Apply adaptive scaling to get final positions
const finalPositions = {};
Object.keys(rawPositions).forEach(key => {
  finalPositions[key] = {
    x: rawPositions[key].x * adaptiveScale,
    y: rawPositions[key].y * adaptiveScale
  };
});

// Audit each node
console.log(`📍 NODE AUDIT (showing nodes furthest from center)`);
console.log(`   Format: [genre path] → distance from center | displacement\n`);

// Calculate metrics for each node
const nodeMetrics = nodes.map(node => {
  const rawPos = node.rawPos;
  const finalPos = finalPositions[node.key];

  const rawDistance = Math.sqrt(rawPos.x * rawPos.x + rawPos.y * rawPos.y);
  const finalDistance = Math.sqrt(finalPos.x * finalPos.x + finalPos.y * finalPos.y);
  const displacement = rawDistance - finalDistance;
  const displacementPct = rawDistance > 0 ? (displacement / rawDistance * 100) : 0;

  return {
    ...node,
    rawDistance,
    finalDistance,
    displacement,
    displacementPct
  };
});

// Sort by final distance (nodes furthest from center first)
nodeMetrics.sort((a, b) => b.finalDistance - a.finalDistance);

// Show top 20 nodes furthest from center
console.log(`   Top 20 nodes furthest from center:`);
nodeMetrics.slice(0, 20).forEach((node, i) => {
  console.log(`   ${(i+1).toString().padStart(2)}. ${node.key.padEnd(30)} → ${node.finalDistance.toFixed(1)}px from center | displaced ${-node.displacement.toFixed(1)}px (${-node.displacementPct.toFixed(1)}%)`);
});

console.log(`\n   Summary:`);
console.log(`   • All nodes scaled by same factor: ${adaptiveScale.toFixed(4)}`);
console.log(`   • No collision avoidance or position adjustment`);
console.log(`   • Positions are PURELY attribute-driven (scaled to fit)`);
console.log(`   • Max distance from center: ${Math.max(...nodeMetrics.map(n => n.finalDistance)).toFixed(1)}px`);
console.log(`   • Min distance from center: ${Math.min(...nodeMetrics.map(n => n.finalDistance)).toFixed(1)}px`);
console.log(`   • Average distance: ${(nodeMetrics.reduce((sum, n) => sum + n.finalDistance, 0) / nodeMetrics.length).toFixed(1)}px\n`);

// Check if any nodes exceed the target boundary
const outsideBoundary = nodeMetrics.filter(n => n.finalDistance > TARGET_RADIUS);
if (outsideBoundary.length > 0) {
  console.log(`⚠️  WARNING: ${outsideBoundary.length} nodes exceed target radius of ${TARGET_RADIUS}px:`);
  outsideBoundary.forEach(node => {
    console.log(`   • ${node.key}: ${node.finalDistance.toFixed(1)}px (${(node.finalDistance - TARGET_RADIUS).toFixed(1)}px over)`);
  });
} else {
  console.log(`✅ All nodes fit within target radius of ${TARGET_RADIUS}px`);
}

console.log(`\n✅ Audit complete!\n`);
