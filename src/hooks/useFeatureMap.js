import { useMemo } from 'react';

/**
 * useFeatureMap
 *
 * Computes 2D positions for genres/subgenres/tracks based on their audio features.
 * Uses the manifest's global config for normalization and projection.
 *
 * @param {Object} manifest - The genre manifest with global config
 * @param {number} exaggeration - Exaggeration factor for spreading
 * @param {Object} activeFeatures - Map of feature names to boolean (enabled/disabled)
 * @param {Array} siblingFeatures - Optional array of feature objects from siblings for local normalization
 */
export function useFeatureMap(manifest, exaggeration = 1.2, activeFeatures = {}, siblingFeatures = null) {
  const positions = useMemo(() => {
    if (!manifest?.global) return {};

    const { feature_angles: rawFeatureAngles, projection_scale, speechiness_contrast_gamma } = manifest.global.display;
    const { quantiles: globalQuantiles } = manifest.global;

    // Filter out instrumentalness from display
    const feature_angles = rawFeatureAngles.filter(f => f !== 'instrumentalness');

    // Compute local quantiles from siblings if provided
    const computeLocalQuantiles = (siblings) => {
      const localQ = {};

      feature_angles.forEach(featureName => {
        const values = siblings
          .map(s => s[featureName])
          .filter(v => v != null && !isNaN(v))
          .sort((a, b) => a - b);

        if (values.length === 0) {
          localQ[featureName] = globalQuantiles[featureName] || { p10: 0, p50: 0.5, p90: 1 };
          return;
        }

        const p10Idx = Math.floor(values.length * 0.1);
        const p50Idx = Math.floor(values.length * 0.5);
        const p90Idx = Math.floor(values.length * 0.9);

        localQ[featureName] = {
          p10: values[p10Idx],
          p50: values[p50Idx],
          p90: values[p90Idx]
        };
      });

      return localQ;
    };

    // Use local quantiles if siblings provided, otherwise global
    const quantiles = siblingFeatures ? computeLocalQuantiles(siblingFeatures) : globalQuantiles;

    // Compute angle for each feature to match ring segments
    // Each feature has high and low ends, so total segments = feature_angles.length * 2
    const numSegments = feature_angles.length * 2;
    const segmentAngleStep = (Math.PI * 2) / numSegments;
    const featureAngles = feature_angles.reduce((acc, feature, i) => {
      acc[feature] = i * segmentAngleStep; // Evenly space features around the circle
      return acc;
    }, {});

    // Normalize a feature value to 0-1 using percentile approximation
    const normalizeFeature = (value, featureName) => {
      if (value == null || isNaN(value)) return 0.5; // neutral if missing

      const q = quantiles[featureName];
      if (!q) return 0.5;

      // Approximate percentile using p10, p50, p90
      if (value <= q.p10) return 0.1;
      if (value <= q.p50) return 0.1 + 0.4 * ((value - q.p10) / (q.p50 - q.p10));
      if (value <= q.p90) return 0.5 + 0.4 * ((value - q.p50) / (q.p90 - q.p50));
      return 0.9 + 0.1 * Math.min(1, (value - q.p90) / (q.p90 - q.p50));
    };

    // Apply contrast curve to speechiness (spreads values near zero)
    const applyContrastCurve = (percentile, featureName) => {
      if (featureName === 'speechiness') {
        return Math.pow(percentile, 1 / speechiness_contrast_gamma);
      }
      return percentile;
    };

    // Project normalized features to 2D
    // Depth-based exaggeration: root genres get more extreme positioning
    const projectTo2D = (features, depth = 0) => {
      let x = 0;
      let y = 0;

      // Apply stronger exaggeration for root-level genres
      // Root (depth 0): 1.6x to make them more distinct
      // Level 1: 1.2x (normal)
      // Level 2+: 1.0x (less exaggerated)
      const depthExaggeration = depth === 0 ? 1.6 : (depth === 1 ? 1.2 : 1.0);
      const effectiveExaggeration = exaggeration * depthExaggeration;

      feature_angles.forEach(featureName => {
        // Skip if this feature is disabled
        if (activeFeatures[featureName] === false) return;

        const rawValue = features[featureName];
        let percentile = normalizeFeature(rawValue, featureName);
        percentile = applyContrastCurve(percentile, featureName);

        // Convert to weight: [-1, 1] (bidirectional)
        // percentile 0 → opposite direction (low label), 0.5 → center, 1 → toward axis (high label)
        const weight = (percentile - 0.5) * 2 * effectiveExaggeration;

        // Add weighted unit vector for this axis
        const angle = featureAngles[featureName];
        x += weight * Math.cos(angle);
        y += weight * Math.sin(angle);
      });

      // Scale to screen coordinates
      return {
        x: x * projection_scale,
        y: y * projection_scale
      };
    };

    // Compute positions for all genres and subgenres
    const rawResult = {};

    const processNode = (node, path = []) => {
      const key = path.join('.');
      const depth = path.length - 1; // Root genres have depth 0

      if (node.features) {
        rawResult[key] = projectTo2D(node.features, depth);
      }

      if (node.subgenres) {
        Object.keys(node.subgenres).forEach(subkey => {
          processNode(node.subgenres[subkey], [...path, subkey]);
        });
      }
    };

    // Process all root genres
    Object.keys(manifest).forEach(genreKey => {
      if (genreKey === 'global' || genreKey === 'build') return;
      processNode(manifest[genreKey], [genreKey]);
    });

    // ADAPTIVE SCALING with log transform and collision avoidance
    const TARGET_RADIUS = 220; // Use more of the available space (ring is at 245px)

    // Find maximum distance from center
    let maxRadius = 0;
    Object.values(rawResult).forEach(pos => {
      const distance = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      if (distance > maxRadius) maxRadius = distance;
    });

    // Calculate adaptive scale factor
    const adaptiveScale = maxRadius > 0 ? TARGET_RADIUS / maxRadius : 1;

    // Apply log scaling to spread outer nodes more (0.5 closer to 1 than to 0)
    // This uncrowds nodes by giving more space to nodes further from center
    const applyLogScale = (distance, maxDist) => {
      if (maxDist === 0) return 0;
      const normalized = distance / maxDist; // 0 to 1
      // Apply logarithmic transform: log2(1 + x) makes 0.5 → ~0.58
      const logged = Math.log2(1 + normalized) / Math.log2(2); // 0 to 1, curved
      return logged * maxDist;
    };

    // First pass: apply adaptive scaling with log transform
    const scaledResult = {};
    Object.keys(rawResult).forEach(key => {
      const x = rawResult[key].x * adaptiveScale;
      const y = rawResult[key].y * adaptiveScale;
      const distance = Math.sqrt(x * x + y * y);
      const logDistance = applyLogScale(distance, TARGET_RADIUS);
      const scale = distance > 0 ? logDistance / distance : 1;

      scaledResult[key] = {
        x: x * scale,
        y: y * scale,
        features: null // Will store features for collision resolution
      };
    });

    // Store features for collision resolution
    Object.keys(rawResult).forEach(key => {
      const pathParts = key.split('.');
      let node = manifest;
      for (const part of pathParts) {
        if (node[part]) node = node[part];
        else if (node.subgenres?.[part]) node = node.subgenres[part];
      }
      if (node?.features) {
        scaledResult[key].features = node.features;
      }
    });

    // COLLISION AVOIDANCE: Push overlapping nodes in direction of strongest attribute
    // Relationship-aware minimum distances provide better separation for related nodes
    const MIN_DISTANCE_SIBLING = 50; // Minimum distance between siblings at same level
    const MIN_DISTANCE_PARENT_CHILD = 55; // Minimum distance between parent and child
    const MIN_DISTANCE_ROOT = 75; // Minimum distance between root genres (increased for readability)
    const MIN_DISTANCE_DEFAULT = 40; // Default for unrelated nodes
    const PUSH_STRENGTH = 0.4; // Balanced strength to avoid instability
    const MAX_ITERATIONS = 5; // Enough iterations for convergence without chaos
    const DAMPING = 0.88; // Progressive damping to stabilize

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

      // Siblings if they have the same parent (same path except last element)
      if (parts1.length === parts2.length && parts1.length > 1) {
        const parent1 = parts1.slice(0, -1).join('.');
        const parent2 = parts2.slice(0, -1).join('.');
        if (parent1 === parent2) {
          return 'sibling';
        }
      }

      return 'unrelated';
    };

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const keys = Object.keys(scaledResult);
      let hadCollision = false;

      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const key1 = keys[i];
          const key2 = keys[j];
          const node1 = scaledResult[key1];
          const node2 = scaledResult[key2];

          const dx = node2.x - node1.x;
          const dy = node2.y - node1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Determine appropriate minimum distance based on relationship
          const relationship = getNodeRelationship(key1, key2);
          const isRoot1 = !key1.includes('.');
          const isRoot2 = !key2.includes('.');
          const bothRoot = isRoot1 && isRoot2;

          const minDistance = bothRoot ? MIN_DISTANCE_ROOT :
            relationship === 'parent-child' ? MIN_DISTANCE_PARENT_CHILD :
            relationship === 'sibling' ? MIN_DISTANCE_SIBLING :
            MIN_DISTANCE_DEFAULT;

          if (distance < minDistance && distance > 0) {
            hadCollision = true;

            // Calculate push direction for each node based on strongest attribute
            const getPushDirection = (features) => {
              if (!features) return { x: 0, y: 0 };

              let strongestFeature = null;
              let strongestWeight = 0;

              feature_angles.forEach(featureName => {
                const value = features[featureName];
                if (value == null) return;

                // Normalize to see which feature is most extreme
                const weight = Math.abs(value - 0.5);
                if (weight > strongestWeight) {
                  strongestWeight = weight;
                  strongestFeature = featureName;
                }
              });

              if (!strongestFeature) return { x: 0, y: 0 };

              // Get direction of strongest feature
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

            // Push nodes apart, biased toward their strongest attribute direction
            // Apply damping: pushes get weaker each iteration to prevent spiraling
            const currentStrength = PUSH_STRENGTH * Math.pow(DAMPING, iteration);
            const overlap = minDistance - distance;
            const pushDist = overlap * currentStrength / 2;

            // If no feature direction, fall back to direct separation
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

      if (!hadCollision) break;
    }

    // Final result without features metadata
    const result = {};
    Object.keys(scaledResult).forEach(key => {
      result[key] = {
        x: scaledResult[key].x,
        y: scaledResult[key].y
      };
    });

    return result;
  }, [manifest, exaggeration, activeFeatures, siblingFeatures]);

  return { positions };
}

/**
 * Compute position for a single track using its individual features
 * @param {Array} siblingFeatures - Optional array of feature objects from sibling tracks for local normalization
 */
export function computeTrackPosition(trackFeatures, manifest, exaggeration = 1.2, activeFeatures = {}, siblingFeatures = null) {
  if (!manifest?.global) return { x: 0, y: 0 };

  const { feature_angles: rawFeatureAngles, projection_scale, speechiness_contrast_gamma } = manifest.global.display;
  const { quantiles: globalQuantiles } = manifest.global;

  // Filter out instrumentalness from display
  const feature_angles = rawFeatureAngles.filter(f => f !== 'instrumentalness');

  // Compute local quantiles from siblings if provided
  let quantiles = globalQuantiles;
  if (siblingFeatures && siblingFeatures.length > 0) {
    const localQ = {};
    feature_angles.forEach(featureName => {
      const values = siblingFeatures
        .map(s => s[featureName])
        .filter(v => v != null && !isNaN(v))
        .sort((a, b) => a - b);

      if (values.length === 0) {
        localQ[featureName] = globalQuantiles[featureName] || { p10: 0, p50: 0.5, p90: 1 };
        return;
      }

      const p10Idx = Math.floor(values.length * 0.1);
      const p50Idx = Math.floor(values.length * 0.5);
      const p90Idx = Math.floor(values.length * 0.9);

      localQ[featureName] = {
        p10: values[p10Idx],
        p50: values[p50Idx],
        p90: values[p90Idx]
      };
    });
    quantiles = localQ;
  }

  // Each feature has high and low ends, so total segments = feature_angles.length * 2
  const numSegments = feature_angles.length * 2;
  const segmentAngleStep = (Math.PI * 2) / numSegments;
  const featureAngles = feature_angles.reduce((acc, feature, i) => {
    acc[feature] = i * segmentAngleStep; // Evenly space features around the circle
    return acc;
  }, {});

  const normalizeFeature = (value, featureName) => {
    if (value == null || isNaN(value)) return 0.5;

    const q = quantiles[featureName];
    if (!q) return 0.5;

    if (value <= q.p10) return 0.1;
    if (value <= q.p50) return 0.1 + 0.4 * ((value - q.p10) / (q.p50 - q.p10));
    if (value <= q.p90) return 0.5 + 0.4 * ((value - q.p50) / (q.p90 - q.p50));
    return 0.9 + 0.1 * Math.min(1, (value - q.p90) / (q.p90 - q.p50));
  };

  const applyContrastCurve = (percentile, featureName) => {
    if (featureName === 'speechiness') {
      return Math.pow(percentile, 1 / speechiness_contrast_gamma);
    }
    return percentile;
  };

  let x = 0;
  let y = 0;

  feature_angles.forEach(featureName => {
    // Skip if this feature is disabled
    if (activeFeatures[featureName] === false) return;

    const rawValue = trackFeatures[featureName];
    let percentile = normalizeFeature(rawValue, featureName);
    percentile = applyContrastCurve(percentile, featureName);

    // Bidirectional: percentile 0 → opposite (low), 0.5 → center, 1 → toward axis (high)
    const weight = (percentile - 0.5) * 2 * exaggeration;
    const angle = featureAngles[featureName];
    x += weight * Math.cos(angle);
    y += weight * Math.sin(angle);
  });

  return {
    x: x * projection_scale,
    y: y * projection_scale
  };
}
