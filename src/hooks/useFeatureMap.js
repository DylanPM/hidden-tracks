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

    // Compute local quantiles for root genres to spread them better
    // Root genres should be normalized relative to EACH OTHER, not the global dataset
    const rootGenreKeys = Object.keys(manifest).filter(k => k !== 'global' && k !== 'build');
    const rootGenreFeatures = rootGenreKeys
      .map(key => manifest[key]?.features)
      .filter(f => f != null);

    const rootQuantiles = rootGenreFeatures.length > 0
      ? computeLocalQuantiles(rootGenreFeatures)
      : globalQuantiles;

    // DEBUG: Log quantile comparison for one feature
    console.log('\n📊 QUANTILE COMPARISON (acousticness):');
    console.log(`  Global: p10=${globalQuantiles.acousticness?.p10?.toFixed(3)}, p50=${globalQuantiles.acousticness?.p50?.toFixed(3)}, p90=${globalQuantiles.acousticness?.p90?.toFixed(3)}`);
    console.log(`  Root:   p10=${rootQuantiles.acousticness?.p10?.toFixed(3)}, p50=${rootQuantiles.acousticness?.p50?.toFixed(3)}, p90=${rootQuantiles.acousticness?.p90?.toFixed(3)}`);

    // DEBUG: Log initial feature-based positions for country and jazz
    console.log('\n🎯 INITIAL POSITIONS (before collision avoidance):');

    // Log feature values for country and jazz
    ['country', 'jazz'].forEach(genreKey => {
      if (manifest[genreKey]?.features) {
        const features = manifest[genreKey].features;
        console.log(`\n  ${genreKey} features (raw → percentile):`);
        feature_angles.forEach(feat => {
          if (features[feat] != null) {
            const raw = features[feat];
            const q = globalQuantiles[feat];
            let percentile = 0.5;
            if (q) {
              if (raw <= q.p10) percentile = 0.1 * (raw / q.p10);
              else if (raw <= q.p50) percentile = 0.1 + 0.4 * ((raw - q.p10) / (q.p50 - q.p10));
              else if (raw <= q.p90) percentile = 0.5 + 0.4 * ((raw - q.p50) / (q.p90 - q.p50));
              else percentile = 0.9 + 0.1 * Math.min(1, (raw - q.p90) / (q.p90 - q.p50));
            }
            console.log(`    ${feat}: ${raw.toFixed(3)} → ${percentile.toFixed(3)}`);
          }
        });
      }
    });

    // Use global quantiles everywhere for semantic consistency
    // This ensures positions match the disco floor and semantic meaning is preserved at all levels
    // (Previously used local quantiles for subgenres, which caused position/disco-floor mismatch)
    const quantiles = globalQuantiles;

    // Calculate averaged features for parent genres based on their subgenres
    // This gives a more representative picture of the parent genre as a whole
    const calculateAveragedParentFeatures = () => {
      const averaged = {};

      Object.keys(manifest).forEach(genreKey => {
        if (genreKey === 'global' || genreKey === 'build') return;

        const genre = manifest[genreKey];
        if (!genre.subgenres) return;

        // Collect all subgenre features
        const subgenreFeatures = Object.keys(genre.subgenres)
          .map(subKey => genre.subgenres[subKey].features)
          .filter(f => f != null);

        if (subgenreFeatures.length === 0) return;

        // Average each feature across all subgenres
        const avgFeatures = {};
        feature_angles.forEach(feat => {
          const values = subgenreFeatures
            .map(f => f[feat])
            .filter(v => v != null && !isNaN(v));

          if (values.length > 0) {
            avgFeatures[feat] = values.reduce((sum, v) => sum + v, 0) / values.length;
          }
        });

        averaged[genreKey] = avgFeatures;
      });

      return averaged;
    };

    const averagedParentFeatures = calculateAveragedParentFeatures();

    // DEBUG: Log comparison of original vs averaged features
    ['country', 'jazz', 'electronic', 'hip hop', 'rock'].forEach(genreKey => {
      const key = genreKey.replace(' ', '-');
      if (averagedParentFeatures[genreKey] && manifest[genreKey]?.features) {
        console.log(`\n🎵 ${genreKey.toUpperCase()} FEATURE COMPARISON:`);
        console.log('  Original (seed tracks):');
        feature_angles.forEach(feat => {
          if (manifest[genreKey].features[feat] != null) {
            console.log(`    ${feat}: ${manifest[genreKey].features[feat].toFixed(3)}`);
          }
        });
        console.log('  Averaged (across all subgenres):');
        feature_angles.forEach(feat => {
          if (averagedParentFeatures[genreKey][feat] != null) {
            console.log(`    ${feat}: ${averagedParentFeatures[genreKey][feat].toFixed(3)}`);
          }
        });
      }
    });

    // ============================================================================
    // POSITIONING ANGLES: One axis per feature, evenly distributed around circle
    // ============================================================================
    // This determines where nodes are positioned based on their feature values.
    // Each feature gets ONE axis (e.g., Energy at 51°):
    //   - High values positioned TOWARD the axis (51°)
    //   - Low values positioned AWAY from axis (231° = opposite direction)
    //
    // IMPORTANT: The display component uses TWO different angle systems:
    //   1. This POSITIONING system (numFeatures axes) - for node positions
    //   2. RING SEGMENT system (numFeatures * 2 segments) - for rectangle widths
    // See GenreConstellationSelect_FeatureMap.jsx "ANGLE CALCULATION SYSTEM" for details
    // ============================================================================
    const numFeatures = feature_angles.length;
    const featureAngleStep = (Math.PI * 2) / numFeatures;
    const featureAngles = feature_angles.reduce((acc, feature, i) => {
      acc[feature] = i * featureAngleStep; // Distribute features evenly around full circle
      return acc;
    }, {});

    // DEBUG: Log feature axis angles
    console.log('\n🧭 FEATURE AXIS ANGLES:');
    feature_angles.forEach((feature, i) => {
      const angle = featureAngles[feature];
      const degrees = (angle * 180 / Math.PI).toFixed(1);
      console.log(`  ${i}: ${feature} → ${degrees}°`);
    });

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

      // Count active features
      const activeCount = feature_angles.filter(f => activeFeatures[f] !== false).length;

      // Apply stronger exaggeration for root-level genres
      // Root (depth 0): 1.2x (using averaged features with exclusion zones)
      // Level 1: 1.2x (normal)
      // Level 2+: 1.1x (pushed 10% further for better spacing with ring text)
      const depthExaggeration = depth === 0 ? 1.2 : (depth === 1 ? 1.2 : 1.1);

      // Feature-count exaggeration: boost spread when fewer features active
      // 1 feature: 2.5x, 2 features: 1.8x, 3+: 1.0x
      const featureCountExaggeration = activeCount === 1 ? 2.5 : (activeCount === 2 ? 1.8 : 1.0);

      const effectiveExaggeration = exaggeration * depthExaggeration * featureCountExaggeration;

      // UNIQUE ATTRIBUTE BOOSTING: For root genres, boost their most distinctive attribute
      // to push similar genres in different directions
      // TEMPORARILY DISABLED - was causing clustering
      let uniquenessBoosts = {};
      if (false && depth === 0) {
        // Find this genre's most extreme (distinctive) attributes
        feature_angles.forEach(featureName => {
          if (activeFeatures[featureName] === false) return;
          const rawValue = features[featureName];
          let percentile = normalizeFeature(rawValue, featureName);
          percentile = applyContrastCurve(percentile, featureName);

          // Extremeness = distance from 0.5 (neutral)
          const extremeness = Math.abs(percentile - 0.5);
          uniquenessBoosts[featureName] = extremeness;
        });

        // Find the most extreme attribute
        let maxExtremeness = 0;
        let mostDistinctiveFeature = null;
        Object.keys(uniquenessBoosts).forEach(feat => {
          if (uniquenessBoosts[feat] > maxExtremeness) {
            maxExtremeness = uniquenessBoosts[feat];
            mostDistinctiveFeature = feat;
          }
        });

        // Boost the most distinctive attribute by 1.8x to push genres apart
        if (mostDistinctiveFeature) {
          uniquenessBoosts[mostDistinctiveFeature] = 1.8;
        }
        // Reset others to 1.0
        Object.keys(uniquenessBoosts).forEach(feat => {
          if (feat !== mostDistinctiveFeature) {
            uniquenessBoosts[feat] = 1.0;
          }
        });
      }

      // Calculate weights - normalize each to unit direction for equal influence
      feature_angles.forEach(featureName => {
        if (activeFeatures[featureName] === false) return;

        const rawValue = features[featureName];
        let percentile = normalizeFeature(rawValue, featureName);
        percentile = applyContrastCurve(percentile, featureName);

        // Simple weight: positive = toward axis, negative = away from axis
        // Keep it simple - just use the deviation from neutral (0.5)
        const weight = (percentile - 0.5) * 2; // Range: -1 to +1

        const angle = featureAngles[featureName];
        x += weight * Math.cos(angle);
        y += weight * Math.sin(angle);
      });

      // Apply exaggeration AFTER summing to preserve balance
      x *= effectiveExaggeration;
      y *= effectiveExaggeration;

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
        // For root-level parent genres, use averaged features (more accurate representation)
        // Combined with exclusion zones, this provides accurate positioning
        const isRootGenre = depth === 0;
        const genreKey = path[0];
        const features = (isRootGenre && averagedParentFeatures[genreKey])
          ? averagedParentFeatures[genreKey]
          : node.features;

        rawResult[key] = projectTo2D(features, depth);
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
    const TARGET_RADIUS = 195; // Reduced from 220 to add padding (ring is at 245px, inner at 245)

    // Find maximum distance from center
    let maxRadius = 0;
    Object.values(rawResult).forEach(pos => {
      const distance = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      if (distance > maxRadius) maxRadius = distance;
    });

    // Calculate adaptive scale factor
    const adaptiveScale = maxRadius > 0 ? TARGET_RADIUS / maxRadius : 1;

    // Apply power curve scaling to spread outer nodes more (use more of the ring)
    // This uncrowds nodes by giving more space to nodes further from center
    // Using x^0.6 power curve: pushes 0.5 → 0.73 (more aggressive than x^0.7 which did 0.5 → 0.66)
    const applyRadialSpread = (distance, maxDist) => {
      if (maxDist === 0) return 0;
      const normalized = distance / maxDist; // 0 to 1
      // Apply power curve: x^0.6 spreads outer nodes more aggressively
      const spread = Math.pow(normalized, 0.6);
      return spread * maxDist;
    };

    // First pass: apply adaptive scaling with radial spread
    const scaledResult = {};
    Object.keys(rawResult).forEach(key => {
      const x = rawResult[key].x * adaptiveScale;
      const y = rawResult[key].y * adaptiveScale;
      const distance = Math.sqrt(x * x + y * y);
      const spreadDistance = applyRadialSpread(distance, TARGET_RADIUS);
      const scale = distance > 0 ? spreadDistance / distance : 1;

      scaledResult[key] = {
        x: x * scale,
        y: y * scale,
        features: null // Will store features for collision resolution
      };

      // DEBUG: Log positions for key genres after initial projection
      if (['country', 'jazz', 'electronic', 'hip hop', 'rock'].includes(key)) {
        console.log(`  ${key}: (${(x * scale).toFixed(1)}, ${(y * scale).toFixed(1)})`);
      }
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
        // For root-level parent genres, use averaged features for collision resolution
        const isRootGenre = pathParts.length === 1;
        const genreKey = pathParts[0];
        const features = (isRootGenre && averagedParentFeatures[genreKey])
          ? averagedParentFeatures[genreKey]
          : node.features;

        scaledResult[key].features = features;
      }
    });

    // Calculate exclusion zones for each genre based on their weakest features
    // Exclusion zones prevent collision avoidance from pushing genres toward axes where they're weak
    const calculateExclusionZones = () => {
      const zones = {};

      Object.keys(scaledResult).forEach(key => {
        const nodeFeatures = scaledResult[key].features;
        if (!nodeFeatures) return;

        const exclusionFeatures = [];

        // Find features where this genre ranks low (percentile < 0.3)
        feature_angles.forEach(feat => {
          const value = nodeFeatures[feat];
          if (value == null || isNaN(value)) return;

          const percentile = normalizeFeature(value, feat);

          // If low percentile (weak feature), mark for exclusion
          if (percentile < 0.3) {
            exclusionFeatures.push({
              feature: feat,
              angle: featureAngles[feat],
              percentile
            });
          }
        });

        // Create exclusion zones (±45° around each weak feature axis)
        zones[key] = exclusionFeatures.map(f => ({
          feature: f.feature,
          centerAngle: f.angle,
          minAngle: (f.angle - Math.PI / 4 + Math.PI * 2) % (Math.PI * 2),
          maxAngle: (f.angle + Math.PI / 4) % (Math.PI * 2),
          percentile: f.percentile
        }));
      });

      return zones;
    };

    const exclusionZones = calculateExclusionZones();

    // DEBUG: Log exclusion zones for key genres
    console.log('\n🚫 EXCLUSION ZONES (weak features to avoid):');
    ['country', 'jazz', 'electronic', 'hip hop', 'rock'].forEach(key => {
      if (exclusionZones[key] && exclusionZones[key].length > 0) {
        console.log(`  ${key}:`);
        exclusionZones[key].forEach(zone => {
          const degrees = (zone.centerAngle * 180 / Math.PI).toFixed(1);
          console.log(`    ${zone.feature} @ ${degrees}° (±45°) - percentile: ${zone.percentile.toFixed(3)}`);
        });
      }
    });

    // COLLISION AVOIDANCE: Push overlapping nodes using radial separation
    // Relationship-aware minimum distances provide better separation for related nodes
    const MIN_DISTANCE_SIBLING = 95; // Increased another 10px from 85
    const MIN_DISTANCE_PARENT_CHILD = 125; // Increased another 10px from 115
    const MIN_DISTANCE_ROOT = 155; // Increased another 10px from 145
    const MIN_DISTANCE_DEFAULT = 75; // Increased another 10px from 65
    const PUSH_STRENGTH = 0.6; // Stronger push from 0.5
    const MAX_ITERATIONS = 10; // More iterations from 8
    const DAMPING = 0.88; // Slower damping for more aggressive separation

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

    // Helper to check if an angle intersects any exclusion zone
    const isInExclusionZone = (nodeKey, angle) => {
      const zones = exclusionZones[nodeKey];
      if (!zones || zones.length === 0) return false;

      // Normalize angle to [0, 2π)
      let normAngle = angle % (Math.PI * 2);
      if (normAngle < 0) normAngle += Math.PI * 2;

      return zones.some(zone => {
        // Handle wrap-around for zones crossing 0°
        if (zone.minAngle > zone.maxAngle) {
          return normAngle >= zone.minAngle || normAngle <= zone.maxAngle;
        }
        return normAngle >= zone.minAngle && normAngle <= zone.maxAngle;
      });
    };

    // Helper to find best push angle that avoids exclusion zones
    const findSafePushAngle = (nodeKey, baseAngle) => {
      // Try angles: base, base+90°, base-90°, base+45°, base-45°
      const candidateAngles = [
        baseAngle,
        baseAngle + Math.PI / 2,
        baseAngle - Math.PI / 2,
        baseAngle + Math.PI / 4,
        baseAngle - Math.PI / 4
      ];

      for (const angle of candidateAngles) {
        if (!isInExclusionZone(nodeKey, angle)) {
          return angle;
        }
      }

      // If all angles blocked, use base angle as last resort
      return baseAngle;
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

            // Push nodes apart using radial separation with exclusion zone avoidance
            // Apply damping: pushes get weaker each iteration to prevent spiraling
            const currentStrength = PUSH_STRENGTH * Math.pow(DAMPING, iteration);
            const overlap = minDistance - distance;
            const pushDist = overlap * currentStrength / 2;

            // Calculate base push direction (radial separation)
            const basePushAngle1 = Math.atan2(-dy, -dx); // Push node1 away from node2
            const basePushAngle2 = Math.atan2(dy, dx);   // Push node2 away from node1

            // Find safe angles that avoid exclusion zones
            const safePushAngle1 = findSafePushAngle(key1, basePushAngle1);
            const safePushAngle2 = findSafePushAngle(key2, basePushAngle2);

            // Apply pushes using safe angles
            const push1X = Math.cos(safePushAngle1) * pushDist;
            const push1Y = Math.sin(safePushAngle1) * pushDist;
            const push2X = Math.cos(safePushAngle2) * pushDist;
            const push2Y = Math.sin(safePushAngle2) * pushDist;

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

    // Final clamping pass to ensure ALL nodes stay within boundary
    Object.keys(scaledResult).forEach(key => {
      const node = scaledResult[key];
      const dist = Math.sqrt(node.x * node.x + node.y * node.y);
      if (dist > TARGET_RADIUS) {
        const scale = TARGET_RADIUS / dist;
        node.x *= scale;
        node.y *= scale;
      }
    });

    // DEBUG: Log final positions after collision avoidance
    console.log('\n🎯 FINAL POSITIONS (after collision avoidance):');
    ['country', 'jazz', 'electronic', 'hip hop', 'rock'].forEach(key => {
      if (scaledResult[key]) {
        const pos = scaledResult[key];
        const angle = Math.atan2(pos.y, pos.x);
        const angleDegrees = (angle * 180 / Math.PI + 360) % 360;

        // Find nearest feature axis
        let nearestFeature = null;
        let minDiff = Infinity;
        feature_angles.forEach((feature, i) => {
          const featureAngle = featureAngles[feature];
          let diff = Math.abs(angle - featureAngle);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;
          if (diff < minDiff) {
            minDiff = diff;
            nearestFeature = feature;
          }
        });

        // Also show the node's actual feature value for that axis
        const nodeFeatures = scaledResult[key].features;
        const featureValue = nodeFeatures?.[nearestFeature];
        const featureValueStr = featureValue != null ? featureValue.toFixed(3) : 'N/A';

        console.log(`  ${key}: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) at ${angleDegrees.toFixed(0)}° → nearest axis: ${nearestFeature} (value: ${featureValueStr})`);
      }
    });

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

  // Also return averaged parent features for UI components to use
  const averagedFeatures = useMemo(() => {
    if (!manifest?.global) return {};

    const averaged = {};
    const feature_angles = manifest.global.display.feature_angles.filter(f => f !== 'instrumentalness');

    Object.keys(manifest).forEach(genreKey => {
      if (genreKey === 'global' || genreKey === 'build') return;

      const genre = manifest[genreKey];
      if (!genre.subgenres) return;

      // Collect all subgenre features
      const subgenreFeatures = Object.keys(genre.subgenres)
        .map(subKey => genre.subgenres[subKey].features)
        .filter(f => f != null);

      if (subgenreFeatures.length === 0) return;

      // Average each feature across all subgenres
      const avgFeatures = {};
      feature_angles.forEach(feat => {
        const values = subgenreFeatures
          .map(f => f[feat])
          .filter(v => v != null && !isNaN(v));

        if (values.length > 0) {
          avgFeatures[feat] = values.reduce((sum, v) => sum + v, 0) / values.length;
        }
      });

      averaged[genreKey] = avgFeatures;
    });

    return averaged;
  }, [manifest]);

  return { positions, averagedParentFeatures: averagedFeatures };
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

  // POSITIONING ANGLES: Must match main useFeatureMap calculation above
  // (See main function comment for full details on angle system)
  const numFeatures = feature_angles.length;
  const featureAngleStep = (Math.PI * 2) / numFeatures;
  const featureAngles = feature_angles.reduce((acc, feature, i) => {
    acc[feature] = i * featureAngleStep; // Distribute features evenly around full circle
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
