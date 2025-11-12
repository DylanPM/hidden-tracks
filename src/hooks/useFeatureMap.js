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

      // TOP-N DISTINCTIVE FEATURES APPROACH
      // Instead of using all features (which averages away distinctiveness),
      // use only the N most extreme features. This positions genres where their
      // distinctive characteristics are, not at some averaged midpoint.
      //
      // Example: K-pop has high energy + high valence + moderate everything else
      //   Old approach: Positioned near energy (averaged with moderate features)
      //   New approach: Positioned BETWEEN energy and valence (its 2 distinctive traits)
      //
      // TOP_N = 3 allows similar genres (like jazz subgenres) to separate on their
      // 3rd-most distinctive feature when their top 2 are identical
      const TOP_N_FEATURES = 3; // Use the 3 most extreme features per genre

      // First, calculate all weights
      const featureWeights = [];
      feature_angles.forEach(featureName => {
        if (activeFeatures[featureName] === false) return;

        const rawValue = features[featureName];
        let percentile = normalizeFeature(rawValue, featureName);
        percentile = applyContrastCurve(percentile, featureName);

        // Simple weight: positive = toward axis, negative = away from axis
        const weight = (percentile - 0.5) * 2; // Range: -1 to +1

        featureWeights.push({
          name: featureName,
          weight: weight,
          absWeight: Math.abs(weight),
          angle: featureAngles[featureName],
          percentile: percentile
        });
      });

      // Sort by absolute weight (most extreme first) and take top N
      featureWeights.sort((a, b) => b.absWeight - a.absWeight);
      const topFeatures = featureWeights.slice(0, TOP_N_FEATURES);

      // Calculate position using ONLY the top N most distinctive features
      topFeatures.forEach(feat => {
        x += feat.weight * Math.cos(feat.angle);
        y += feat.weight * Math.sin(feat.angle);
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

    // HARD-CODED OPTIMAL REGION ASSIGNMENTS
    // Root-level parent genres positioned by semantic fit to feature axes
    // Format: { genreKey: { region: 'feature-direction', position: 'single'|'outer'|'inner' } }
    const hardCodedAssignments = {
      'pop': { region: 'popularity-high', position: 'single' },
      'country': { region: 'energy-low', position: 'single' },
      'Caribbean & African': { region: 'danceability-high', position: 'single' },
      'classical': { region: 'acousticness-high', position: 'outer' },
      'jazz': { region: 'acousticness-high', position: 'inner' },
      'hip hop': { region: 'speechiness-high', position: 'single' },
      'electronic': { region: 'energy-high', position: 'single' },
      'rock': { region: 'danceability-low', position: 'single' },
      'latin': { region: 'valence-high', position: 'outer' },
      'r&b / soul / funk': { region: 'valence-high', position: 'inner' }
    };

    // Calculate position from region assignment
    const getHardCodedPosition = (assignment) => {
      const [feature, direction] = assignment.region.split('-');
      const baseAngle = featureAngles[feature];
      const angle = direction === 'high' ? baseAngle : (baseAngle + Math.PI) % (Math.PI * 2);

      // Radius based on position type
      let radius;
      if (assignment.position === 'outer') {
        radius = 185; // Outer radius (5% inward from original 195)
      } else if (assignment.position === 'inner') {
        radius = 100; // Inner radius (closer to center for better visual separation)
      } else {
        radius = 185; // Single position uses outer radius
      }

      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      };
    };

    // Compute positions for all genres and subgenres
    const rawResult = {};
    const hardCodedKeys = new Set(); // Track which nodes have hard-coded positions

    const processNode = (node, path = []) => {
      const key = path.join('.');
      const depth = path.length - 1; // Root genres have depth 0
      const genreKey = path[0];

      if (node.features) {
        // SPECIAL CASE: Song of the Day at center (0, 0) to evoke mystery
        if (node.isSongOfTheDay || genreKey === 'song of the day') {
          // console.log('🎵 Song of the Day detected:', key, 'isSongOfTheDay:', node.isSongOfTheDay);
          rawResult[key] = { x: 0, y: 0 };
          hardCodedKeys.add(key); // Mark as hard-coded to skip scaling
        }
        // HARD-CODED POSITIONING: Root-level parent genres use optimal semantic placement
        else {
          const isRootGenre = depth === 0;
          if (isRootGenre && hardCodedAssignments[genreKey]) {
            rawResult[key] = getHardCodedPosition(hardCodedAssignments[genreKey]);
            hardCodedKeys.add(key); // Mark as hard-coded to skip scaling
          }
          // DYNAMIC POSITIONING: Subgenres and tracks use feature-based calculation
          // For root-level parent genres not in hard-coded map, use averaged features
          else {
            const features = (isRootGenre && averagedParentFeatures[genreKey])
              ? averagedParentFeatures[genreKey]
              : node.features;

            // DEBUG: Log specific genres to show top-N features approach
            const debugKeys = ['pop.Regional.k-pop', 'pop.k-pop', 'pop.kpop'];
            if (debugKeys.includes(key)) {
              console.log(`\n🔍 TOP-N FEATURES DEBUG: ${key}`);
              console.log(`  Raw features:`, features);

              // Calculate all weights like projectTo2D does
              const debugWeights = [];
              feature_angles.forEach((fname, idx) => {
                const rawVal = features?.[fname];
                const q = quantiles[fname];
                let percentile = 0.5;
                if (rawVal != null && q) {
                  if (rawVal <= q.p10) percentile = 0.1;
                  else if (rawVal <= q.p50) percentile = 0.1 + 0.4 * ((rawVal - q.p10) / (q.p50 - q.p10));
                  else if (rawVal <= q.p90) percentile = 0.5 + 0.4 * ((rawVal - q.p50) / (q.p90 - q.p50));
                  else percentile = 0.9 + 0.1 * Math.min(1, (rawVal - q.p90) / (q.p90 - q.p50));
                }
                const weight = (percentile - 0.5) * 2;
                const angle = (idx * (Math.PI * 2) / feature_angles.length) * 180 / Math.PI;
                debugWeights.push({ name: fname, raw: rawVal, percentile, weight, absWeight: Math.abs(weight), angle });
              });

              // Sort by absolute weight
              debugWeights.sort((a, b) => b.absWeight - a.absWeight);

              console.log(`  Using TOP 3 features only (most distinctive):`);
              debugWeights.slice(0, 3).forEach((f, i) => {
                console.log(`    ✓ ${i+1}. ${f.name}: weight=${f.weight.toFixed(3)} at ${f.angle.toFixed(1)}°`);
              });
              console.log(`  Excluded (moderate):`);
              debugWeights.slice(3).forEach(f => {
                console.log(`    ✗ ${f.name}: weight=${f.weight.toFixed(3)}`);
              });
            }

            rawResult[key] = projectTo2D(features, depth);

            // Show final position for debug genres
            if (debugKeys.includes(key)) {
              const pos = rawResult[key];
              const finalAngle = (Math.atan2(pos.y, pos.x) * 180 / Math.PI + 360) % 360;
              console.log(`  Final position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) at ${finalAngle.toFixed(1)}°`);
              console.log(`  🎯 Should be between energy (51.4°) and happy (205.7°)`);
            }
          }
        }
      }

      // ALWAYS process subgenres regardless of how parent was positioned
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

    // DEBUG: Manifest feature comparison (commented out)
    // Uncomment to verify manifest features match actual seed profiles
    /*
    const debugGenres = [
      'hip hop.Trap & Bass.trap',
      'hip hop.Alternative Hip Hop',
      'hip hop.Regional Hip Hop.west coast rap'
    ];
    const slugify = (text) => {
      return text
        .toLowerCase()
        .replace(/['']/g, '-')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    };
    debugGenres.forEach(async (path) => {
      const pathParts = path.split('.');
      let node = manifest;
      for (const part of pathParts) {
        if (node[part]) node = node[part];
        else if (node.subgenres?.[part]) node = node.subgenres[part];
        else return;
      }
      if (node && node.features && node.seeds) {
        console.log(`\n🔍 ${path} MANIFEST FEATURES (used for positioning):`);
        console.log(`  energy: ${node.features.energy?.toFixed(3)}`);
        console.log(`  valence: ${node.features.valence?.toFixed(3)}`);
        console.log(`  danceability: ${node.features.danceability?.toFixed(3)}`);
        console.log(`  Seeds count: ${node.seeds?.length || 0}`);
        try {
          const profiles = await Promise.all(
            node.seeds.map(async (seed) => {
              const artistSlug = slugify(seed.artist);
              const nameSlug = slugify(seed.name);
              const filename = `${artistSlug}_${nameSlug}.json`;
              try {
                const res = await fetch(`/profiles/${filename}`);
                if (!res.ok) return null;
                const profile = await res.json();
                const trackData = profile.tracks?.[0];
                if (!trackData) return null;
                const tempo_norm = Math.max(0, Math.min(1, (trackData.tempo - 60) / 120));
                return {
                  energy: trackData.energy,
                  valence: trackData.valence,
                  danceability: trackData.danceability,
                  acousticness: trackData.acousticness,
                  speechiness: trackData.speechiness,
                  tempo_norm: tempo_norm,
                  popularity: trackData.popularity
                };
              } catch (e) {
                console.warn(`Failed to load: ${filename}`);
                return null;
              }
            })
          );
          const validProfiles = profiles.filter(p => p !== null);
          if (validProfiles.length > 0) {
            const avg = {
              energy: validProfiles.reduce((sum, p) => sum + p.energy, 0) / validProfiles.length,
              valence: validProfiles.reduce((sum, p) => sum + p.valence, 0) / validProfiles.length,
              danceability: validProfiles.reduce((sum, p) => sum + p.danceability, 0) / validProfiles.length,
              acousticness: validProfiles.reduce((sum, p) => sum + p.acousticness, 0) / validProfiles.length,
              speechiness: validProfiles.reduce((sum, p) => sum + p.speechiness, 0) / validProfiles.length,
              tempo_norm: validProfiles.reduce((sum, p) => sum + p.tempo_norm, 0) / validProfiles.length,
              popularity: validProfiles.reduce((sum, p) => sum + p.popularity, 0) / validProfiles.length
            };
            console.log(`\n📊 ${path} ACTUAL SEED AVERAGES (${validProfiles.length} seeds loaded):`);
            console.log(`  energy: ${avg.energy.toFixed(3)} (manifest: ${node.features.energy?.toFixed(3)}, diff: ${(avg.energy - node.features.energy).toFixed(3)})`);
            console.log(`  valence: ${avg.valence.toFixed(3)} (manifest: ${node.features.valence?.toFixed(3)}, diff: ${(avg.valence - node.features.valence).toFixed(3)})`);
            console.log(`  danceability: ${avg.danceability.toFixed(3)} (manifest: ${node.features.danceability?.toFixed(3)}, diff: ${(avg.danceability - node.features.danceability).toFixed(3)})`);
            const energyDiff = Math.abs(avg.energy - node.features.energy);
            const valenceDiff = Math.abs(avg.valence - node.features.valence);
            const danceDiff = Math.abs(avg.danceability - node.features.danceability);
            if (energyDiff > 0.05 || valenceDiff > 0.05 || danceDiff > 0.05) {
              console.log(`\n⚠️  SIGNIFICANT MISMATCH DETECTED! Manifest features don't match actual seeds.`);
              if (energyDiff > 0.05) console.log(`  - Energy off by ${energyDiff.toFixed(3)}`);
              if (valenceDiff > 0.05) console.log(`  - Valence off by ${valenceDiff.toFixed(3)}`);
              if (danceDiff > 0.05) console.log(`  - Danceability off by ${danceDiff.toFixed(3)}`);
            }
          }
        } catch (e) {
          console.error(`Failed to load profiles for ${path}:`, e);
        }
      }
    });
    */

    // ADAPTIVE SCALING with log transform and collision avoidance
    const TARGET_RADIUS = 195; // Reduced from 220 to add padding (ring is at 245px, inner at 245)

    // Find maximum distance from center (INCLUDE hard-coded positions to keep scale factor consistent)
    // We include them in calculation but won't scale them later
    let maxRadius = 0;
    Object.keys(rawResult).forEach(key => {
      const pos = rawResult[key];
      const distance = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      if (distance > maxRadius) maxRadius = distance;
    });

    // Calculate adaptive scale factor
    const adaptiveScale = maxRadius > 0 ? TARGET_RADIUS / maxRadius : 1;

    // Apply power curve scaling to spread outer nodes more (use more of the ring)
    // This uncrowds nodes by giving more space to nodes further from center
    // Using x^0.6 power curve (REVERTED from x^0.5 - subgenres were working fine before)
    const applyRadialSpread = (distance, maxDist) => {
      if (maxDist === 0) return 0;
      const normalized = distance / maxDist; // 0 to 1
      // Apply power curve: x^0.6 pushes nodes outward moderately
      const spread = Math.pow(normalized, 0.6);
      return spread * maxDist;
    };

    // First pass: apply adaptive scaling with radial spread
    const scaledResult = {};
    Object.keys(rawResult).forEach(key => {
      // HARD-CODED POSITIONS: Apply directly without scaling
      if (hardCodedKeys.has(key)) {
        scaledResult[key] = {
          x: rawResult[key].x,
          y: rawResult[key].y,
          features: null
        };
        return;
      }

      // DYNAMIC POSITIONS: Apply adaptive scaling and radial spread
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

      // DEBUG: Rock subgenre positioning (after scaling)
      const rockSubgenres = ['rock.Heavy.punk', 'rock.Heavy.metal', 'rock.Heavy.hard rock'];
      if (rockSubgenres.includes(key)) {
        const angle = Math.atan2(y * scale, x * scale) * 180 / Math.PI;
        const normalizedAngle = (angle + 360) % 360;
        console.log(`\n🎸 ${key.toUpperCase()} SCALED POSITION:`);
        console.log(`  Raw position: (${rawResult[key].x.toFixed(3)}, ${rawResult[key].y.toFixed(3)})`);
        console.log(`  After scaling: (${(x * scale).toFixed(3)}, ${(y * scale).toFixed(3)})`);
        console.log(`  Angle: ${normalizedAngle.toFixed(1)}°`);
        console.log(`  Expected: near energy-high (205.7°) for rock music`);
      }


      // DEBUG: Store initial scaled position for first track (before collision avoidance)
      if (key === window.__firstTrackKey && !window.__firstTrackInitialPos) {
        window.__firstTrackInitialPos = { x: x * scale, y: y * scale };
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

        const featurePercentiles = [];

        // Calculate percentile for ALL features
        feature_angles.forEach(feat => {
          const value = nodeFeatures[feat];
          if (value == null || isNaN(value)) return;

          const percentile = normalizeFeature(value, feat);

          featurePercentiles.push({
            feature: feat,
            angle: featureAngles[feat],
            percentile
          });
        });

        // Sort by percentile (weakest first) and keep the 2 weakest
        // ALWAYS create exclusion zones for the 2 weakest features, regardless of absolute percentile
        featurePercentiles.sort((a, b) => a.percentile - b.percentile);
        const weakestFeatures = featurePercentiles.slice(0, 2);

        // Create wider exclusion zones (±45° around each weak feature axis)
        zones[key] = weakestFeatures.map(f => ({
          feature: f.feature,
          centerAngle: f.angle,
          minAngle: (f.angle - Math.PI / 4 + Math.PI * 2) % (Math.PI * 2), // ±45°
          maxAngle: (f.angle + Math.PI / 4) % (Math.PI * 2),
          percentile: f.percentile
        }));
      });

      return zones;
    };

    const exclusionZones = calculateExclusionZones();

    // DEBUG: Log exclusion zones for key genres (COMMENTED OUT - too verbose)
    // console.log('\n🚫 EXCLUSION ZONES (top 2 weakest features to avoid):');
    // ['country', 'jazz', 'electronic', 'hip hop', 'rock'].forEach(key => {
    //   if (exclusionZones[key] && exclusionZones[key].length > 0) {
    //     console.log(`  ${key}:`);
    //     exclusionZones[key].forEach(zone => {
    //       const degrees = (zone.centerAngle * 180 / Math.PI).toFixed(1);
    //       console.log(`    ${zone.feature} @ ${degrees}° (±45°) - percentile: ${zone.percentile.toFixed(3)}`);
    //     });
    //   } else {
    //     console.log(`  ${key}: No weak features (all > 15th percentile)`);
    //   }
    // });

    // COLLISION AVOIDANCE: Push overlapping nodes using radial separation
    // Relationship-aware minimum distances provide better separation for related nodes
    const MIN_DISTANCE_SIBLING = 95; // Increased another 10px from 85
    const MIN_DISTANCE_PARENT_CHILD = 125; // Increased another 10px from 115
    const MIN_DISTANCE_ROOT = 155; // Increased another 10px from 145
    const MIN_DISTANCE_DEFAULT = 75; // Increased another 10px from 65
    const PUSH_STRENGTH = 0.35; // Gentler push to preserve semantic positioning
    const MAX_ITERATIONS = 6; // Fewer iterations to reduce cumulative drift
    const DAMPING = 0.85; // Faster damping to limit total movement

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

      // If all candidates are in exclusion zones, find angle toward STRONGEST feature
      // This is semantically better than pushing into a weak area
      const nodeFeatures = scaledResult[nodeKey]?.features;
      if (nodeFeatures) {
        let strongestFeature = null;
        let maxPercentile = -1;

        feature_angles.forEach(feat => {
          const value = nodeFeatures[feat];
          if (value == null || isNaN(value)) return;

          const percentile = normalizeFeature(value, feat);
          if (percentile > maxPercentile) {
            maxPercentile = percentile;
            strongestFeature = feat;
          }
        });

        if (strongestFeature) {
          // Push toward the strongest feature axis
          return featureAngles[strongestFeature];
        }
      }

      // Final fallback: use base angle
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

          // SKIP collision avoidance for hard-coded root-level parent genres
          // They are optimally placed and should not be moved by collision detection
          const isHardCoded1 = isRoot1 && hardCodedAssignments[key1];
          const isHardCoded2 = isRoot2 && hardCodedAssignments[key2];
          if (isHardCoded1 && isHardCoded2) {
            continue; // Both hard-coded, skip collision resolution
          }

          // SKIP collision avoidance for subgenres from different parents
          // They are never visible at the same time, so they shouldn't interact
          // Only allow collisions between: siblings, parent-child, or root parents
          const bothSubgenres = !isRoot1 && !isRoot2;
          if (bothSubgenres && relationship === 'unrelated') {
            continue; // Different parent genres, never visible together
          }

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

            // Only push non-hard-coded nodes
            // If one is hard-coded, push the other away with double strength
            if (!isHardCoded1) {
              const multiplier = isHardCoded2 ? 2 : 1; // Double push if colliding with hard-coded
              node1.x += push1X * multiplier;
              node1.y += push1Y * multiplier;
            }
            if (!isHardCoded2) {
              const multiplier = isHardCoded1 ? 2 : 1; // Double push if colliding with hard-coded
              node2.x += push2X * multiplier;
              node2.y += push2Y * multiplier;
            }

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

    // DEBUG: Collision avoidance checks (commented out)
    /*
    if (scaledResult['electronic.ambient']) {
      const pos = scaledResult['electronic.ambient'];
      const angle = Math.atan2(pos.y, pos.x) * 180 / Math.PI;
      const normalizedAngle = (angle + 360) % 360;
      console.log(`\n🎯 AMBIENT AFTER COLLISION AVOIDANCE:`);
      console.log(`  Final position: (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)})`);
      console.log(`  Final angle: ${normalizedAngle.toFixed(1)}°`);
      console.log(`  Change from initial: ${normalizedAngle.toFixed(1)}° vs 115.7° = ${(normalizedAngle - 115.7).toFixed(1)}° shift`);
    }
    if (window.__firstTrackKey && scaledResult[window.__firstTrackKey]) {
      const finalPos = scaledResult[window.__firstTrackKey];
      const initialPos = window.__firstTrackInitialPos;
      if (initialPos) {
        const moved = Math.sqrt(
          Math.pow(finalPos.x - initialPos.x, 2) +
          Math.pow(finalPos.y - initialPos.y, 2)
        );
        if (moved > 1) {
          console.log(`\n🎵 TRACK MOVED BY COLLISION:`);
          console.log(`  Track: ${window.__firstTrackKey}`);
          console.log(`  Moved ${moved.toFixed(1)}px from semantic position`);
          console.log(`  Initial: (${initialPos.x.toFixed(1)}, ${initialPos.y.toFixed(1)})`);
          console.log(`  Final: (${finalPos.x.toFixed(1)}, ${finalPos.y.toFixed(1)})`);
        }
      }
    }
    */

    // MANUAL POSITIONING ADJUSTMENTS for overlapping genres
    // Applied after collision avoidance to handle edge cases where semantic similarity
    // creates overlaps that generic collision avoidance can't resolve well

    // Helper: Get feature axis angles for reference
    const acousticAngle = featureAngles['acousticness'];
    const speechAngle = featureAngles['speechiness'];
    const energyAngle = featureAngles['energy'];
    const tempoAngle = featureAngles['tempo_norm'];
    const valenceAngle = featureAngles['valence'];

    /* ========================================================================
       MANUAL POSITIONING INTERVENTIONS (DISABLED FOR TESTING TOP-N APPROACH)
       ========================================================================
       These manual fixes were added to address overlaps and positioning issues
       with the old vector-sum approach. With the new top-N distinctive features
       approach, these may no longer be needed. Keeping them here commented out
       so we can selectively re-enable if specific issues remain.
       ======================================================================== */

    /*
    // 3a. JAZZ SUBGENRES: Targeted manual adjustments
    // Jazz fusion: Move backwards toward center
    if (scaledResult['jazz.jazz fusion']) {
      const fusion = scaledResult['jazz.jazz fusion'];
      const distance = Math.sqrt(fusion.x * fusion.x + fusion.y * fusion.y);
      const angle = Math.atan2(fusion.y, fusion.x);
      // Move inward by one node diameter (27px) plus text width (~60px) = 87px
      const newDistance = distance - 87;
      fusion.x = Math.cos(angle) * newDistance;
      fusion.y = Math.sin(angle) * newDistance;
    }

    // Bebop: Move up towards laid back (low danceability)
    if (scaledResult['jazz.bebop']) {
      const bebop = scaledResult['jazz.bebop'];
      const danceabilityAngle = featureAngles['danceability'];
      const laidBackAngle = danceabilityAngle + Math.PI; // Opposite direction (low danceability)
      const shiftAmount = 13.5; // Half a node diameter
      bebop.x += Math.cos(laidBackAngle) * shiftAmount;
      bebop.y += Math.sin(laidBackAngle) * shiftAmount;
    }

    // 3b. PUNK AND METAL: Push apart
    if (scaledResult['rock.Heavy.punk'] && scaledResult['rock.Heavy.metal']) {
      const punk = scaledResult['rock.Heavy.punk'];
      const metal = scaledResult['rock.Heavy.metal'];
      const dx = metal.x - punk.x;
      const dy = metal.y - punk.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const MIN_SEPARATION = 100; // Minimum distance between punk and metal (increased from 60)

      if (dist < MIN_SEPARATION) {
        const pushDist = (MIN_SEPARATION - dist) / 2;
        const angle = Math.atan2(dy, dx);
        punk.x -= Math.cos(angle) * pushDist;
        punk.y -= Math.sin(angle) * pushDist;
        metal.x += Math.cos(angle) * pushDist;
        metal.y += Math.sin(angle) * pushDist;
      }
    }

    // 3c. EAST COAST AND SOUTHERN HIP HOP: Push apart and adjust east coast left
    // Move east coast rap left (towards wordy/niche, 9 o'clock direction)
    if (scaledResult['hip hop.Regional Hip Hop.east coast hip hop']) {
      const eastCoast = scaledResult['hip hop.Regional Hip Hop.east coast hip hop'];
      const leftAngle = Math.PI * 1.05; // Roughly 9 o'clock (189°)
      const shiftAmount = 40; // Width of genre title box
      eastCoast.x += Math.cos(leftAngle) * shiftAmount;
      eastCoast.y += Math.sin(leftAngle) * shiftAmount;
    }

    if (scaledResult['hip hop.Regional Hip Hop.east coast hip hop'] && scaledResult['hip hop.Regional Hip Hop.southern hip hop']) {
      const eastCoast = scaledResult['hip hop.Regional Hip Hop.east coast hip hop'];
      const southern = scaledResult['hip hop.Regional Hip Hop.southern hip hop'];
      const dx = southern.x - eastCoast.x;
      const dy = southern.y - eastCoast.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const MIN_SEPARATION = 70; // Increased from 50

      if (dist < MIN_SEPARATION) {
        const pushDist = (MIN_SEPARATION - dist) / 2;
        const angle = Math.atan2(dy, dx);
        eastCoast.x -= Math.cos(angle) * pushDist;
        eastCoast.y -= Math.sin(angle) * pushDist;
        southern.x += Math.cos(angle) * pushDist;
        southern.y += Math.sin(angle) * pushDist;
      }
    }

    // 3e. COUNTRY SUBGENRES: Fine positioning adjustments
    if (scaledResult['country.southern rock']) {
      const southernRock = scaledResult['country.southern rock'];
      const shiftAmount = 20;
      southernRock.x += Math.cos(energyAngle) * shiftAmount;
      southernRock.y += Math.sin(energyAngle) * shiftAmount;
    }

    if (scaledResult['country.classic country']) {
      const classicCountry = scaledResult['country.classic country'];
      const shiftAmount = 20;
      classicCountry.x += Math.cos(valenceAngle + Math.PI) * shiftAmount;
      classicCountry.y += Math.sin(valenceAngle + Math.PI) * shiftAmount;
    }

    if (scaledResult['country.indie folk']) {
      const indieFolk = scaledResult['country.indie folk'];
      const shiftAmount = 20;
      indieFolk.x += Math.cos(valenceAngle + Math.PI) * shiftAmount;
      indieFolk.y += Math.sin(valenceAngle + Math.PI) * shiftAmount;
    }

    // 3f. TECHNO: Move towards fast
    if (scaledResult['electronic.Subgenres.techno']) {
      const techno = scaledResult['electronic.Subgenres.techno'];
      const shiftAmount = 30;
      techno.x += Math.cos(tempoAngle) * shiftAmount;
      techno.y += Math.sin(tempoAngle) * shiftAmount;
    }

    // 3g. KPOP: Move away from sad
    if (scaledResult['pop.Regional.k-pop']) {
      const kpop = scaledResult['pop.Regional.k-pop'];
      const shiftAmount = 40;
      kpop.x += Math.cos(valenceAngle) * shiftAmount;
      kpop.y += Math.sin(valenceAngle) * shiftAmount;
    }
    */

    // DEBUG: Log final positions after collision avoidance (COMMENTED OUT - too verbose)
    // console.log('\n🎯 FINAL POSITIONS (after collision avoidance):');
    // ['country', 'jazz', 'electronic', 'hip hop', 'rock'].forEach(key => {
    //   if (scaledResult[key]) {
    //     const pos = scaledResult[key];
    //     const angle = Math.atan2(pos.y, pos.x);
    //     const angleDegrees = (angle * 180 / Math.PI + 360) % 360;
    //
    //     // Find nearest feature axis
    //     let nearestFeature = null;
    //     let minDiff = Infinity;
    //     feature_angles.forEach((feature, i) => {
    //       const featureAngle = featureAngles[feature];
    //       let diff = Math.abs(angle - featureAngle);
    //       if (diff > Math.PI) diff = Math.PI * 2 - diff;
    //       if (diff < minDiff) {
    //         minDiff = diff;
    //         nearestFeature = feature;
    //       }
    //     });
    //
    //     // Also show the node's actual feature value for that axis
    //     const nodeFeatures = scaledResult[key].features;
    //     const featureValue = nodeFeatures?.[nearestFeature];
    //     const featureValueStr = featureValue != null ? featureValue.toFixed(3) : 'N/A';
    //
    //     console.log(`  ${key}: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) at ${angleDegrees.toFixed(0)}° → nearest axis: ${nearestFeature} (value: ${featureValueStr})`);
    //   }
    // });

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
