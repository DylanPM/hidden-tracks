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
    const projectTo2D = (features) => {
      let x = 0;
      let y = 0;

      feature_angles.forEach(featureName => {
        // Skip if this feature is disabled
        if (activeFeatures[featureName] === false) return;

        const rawValue = features[featureName];
        let percentile = normalizeFeature(rawValue, featureName);
        percentile = applyContrastCurve(percentile, featureName);

        // Convert to weight: [-1, 1] (bidirectional)
        // percentile 0 → opposite direction (low label), 0.5 → center, 1 → toward axis (high label)
        const weight = (percentile - 0.5) * 2 * exaggeration;

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
      if (node.features) {
        rawResult[key] = projectTo2D(node.features);
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

    // ADAPTIVE SCALING: Auto-scale to fit within target boundary
    // Find maximum distance from center
    let maxRadius = 0;
    Object.values(rawResult).forEach(pos => {
      const distance = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      if (distance > maxRadius) maxRadius = distance;
    });

    // Calculate adaptive scale factor to fit within target radius
    const TARGET_RADIUS = 190; // Fit comfortably inside the 250px ring with some padding
    const adaptiveScale = maxRadius > 0 ? TARGET_RADIUS / maxRadius : 1;

    // Apply adaptive scaling to all positions
    const result = {};
    Object.keys(rawResult).forEach(key => {
      result[key] = {
        x: rawResult[key].x * adaptiveScale,
        y: rawResult[key].y * adaptiveScale
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
