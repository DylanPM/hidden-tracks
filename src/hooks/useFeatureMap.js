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
 */
export function useFeatureMap(manifest, exaggeration = 1.2, activeFeatures = {}) {
  const positions = useMemo(() => {
    if (!manifest?.global) return {};

    const { feature_angles, projection_scale, speechiness_contrast_gamma } = manifest.global.display;
    const { quantiles } = manifest.global;

    // Compute angle for each feature (octagonal: 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°)
    const angleStep = (Math.PI * 2) / feature_angles.length;
    const featureAngles = feature_angles.reduce((acc, feature, i) => {
      acc[feature] = i * angleStep;
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

        // Convert to weight centered at 0: [-0.5, 0.5]
        const weight = (percentile - 0.5) * exaggeration;

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
    const result = {};

    const processNode = (node, path = []) => {
      const key = path.join('.');
      if (node.features) {
        result[key] = projectTo2D(node.features);
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

    return result;
  }, [manifest, exaggeration, activeFeatures]);

  return { positions };
}

/**
 * Compute position for a single track using its individual features
 */
export function computeTrackPosition(trackFeatures, manifest, exaggeration = 1.2, activeFeatures = {}) {
  if (!manifest?.global) return { x: 0, y: 0 };

  const { feature_angles, projection_scale, speechiness_contrast_gamma } = manifest.global.display;
  const { quantiles } = manifest.global;

  const angleStep = (Math.PI * 2) / feature_angles.length;
  const featureAngles = feature_angles.reduce((acc, feature, i) => {
    acc[feature] = i * angleStep;
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

    const weight = (percentile - 0.5) * exaggeration;
    const angle = featureAngles[featureName];
    x += weight * Math.cos(angle);
    y += weight * Math.sin(angle);
  });

  return {
    x: x * projection_scale,
    y: y * projection_scale
  };
}
