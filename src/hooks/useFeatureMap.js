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

    // Filter out instrumentalness and speechiness from display
    // Speechiness removed because 95% of music normalizes to ~0.5 (neutral), adding noise without useful differentiation
    const feature_angles = rawFeatureAngles.filter(f => f !== 'instrumentalness' && f !== 'speechiness');

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

    // Directly project a node's features when the auction fails to give it a slot
    const calculateSemanticPosition = (features = null, depth = 0) => {
      if (!features) return { x: 0, y: 0 };

      let x = 0;
      let y = 0;
      const depthExaggeration = depth === 0 ? 1.2 : (depth === 1 ? 1.2 : 1.1);
      const featureCountExaggeration = 1.0;
      const effectiveExaggeration = exaggeration * depthExaggeration * featureCountExaggeration;

      feature_angles.forEach(featureName => {
        if (activeFeatures[featureName] === false) return;

        const rawValue = features[featureName];
        let percentile = normalizeFeature(rawValue, featureName);
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
    };

    // Run auction for a group of siblings with two-pass optimization
    const runTriangleAuction = (siblings, depth, assignmentMetadata = null) => {
      // PASS 1: Greedy assignment by triangle preference (not overall extremeness)
      // Assign triangles in order of how much each genre wants them
      const triangleAssignments = {}; // triangleIndex -> sibling
      const siblingAssignments = {}; // siblingKey -> triangleIndex

      // Collect all bids: each (sibling, triangle) pair with its preference score
      const allBids = [];
      siblings.forEach(sibling => {
        sibling.preferences.forEach(pref => {
          allBids.push({
            sibling,
            triangleIndex: pref.triangleIndex,
            extremeness: pref.extremeness,
            preference: pref
          });
        });
      });

      // Sort bids by extremeness (highest preference first)
      allBids.sort((a, b) => b.extremeness - a.extremeness);

      // Greedy assignment: process bids in order, assign if both parties available
      allBids.forEach(bid => {
        const triangleTaken = triangleAssignments[bid.triangleIndex] != null;
        const siblingAssigned = siblingAssignments[bid.sibling.key] != null;

        if (!triangleTaken && !siblingAssigned) {
          triangleAssignments[bid.triangleIndex] = bid.sibling;
          siblingAssignments[bid.sibling.key] = {
            triangleIndex: bid.triangleIndex,
            preference: bid.preference
          };
        }
      });

      // PASS 2: Check for beneficial swaps
      // If sibling A got triangle X and sibling B got triangle Y,
      // but B prefers X more than A does, and A prefers Y more than B does, swap
      const MAX_SWAP_ITERATIONS = 3;
      for (let iter = 0; iter < MAX_SWAP_ITERATIONS; iter++) {
        let madeSwap = false;

        const assignedSiblings = Object.keys(siblingAssignments);
        for (let i = 0; i < assignedSiblings.length; i++) {
          for (let j = i + 1; j < assignedSiblings.length; j++) {
            const keyA = assignedSiblings[i];
            const keyB = assignedSiblings[j];

            const siblingA = siblings.find(s => s.key === keyA);
            const siblingB = siblings.find(s => s.key === keyB);

            const triangleA = siblingAssignments[keyA].triangleIndex;
            const triangleB = siblingAssignments[keyB].triangleIndex;

            // How much does A prefer its current triangle?
            const aPreferenceForA = siblingA.preferences.find(p => p.triangleIndex === triangleA)?.extremeness || 0;
            // How much does A prefer B's triangle?
            const aPreferenceForB = siblingA.preferences.find(p => p.triangleIndex === triangleB)?.extremeness || 0;

            // How much does B prefer its current triangle?
            const bPreferenceForB = siblingB.preferences.find(p => p.triangleIndex === triangleB)?.extremeness || 0;
            // How much does B prefer A's triangle?
            const bPreferenceForA = siblingB.preferences.find(p => p.triangleIndex === triangleA)?.extremeness || 0;

            // Calculate happiness improvement from swap
            const currentHappiness = aPreferenceForA + bPreferenceForB;
            const swappedHappiness = aPreferenceForB + bPreferenceForA;

            // If swap improves total happiness by at least 0.05, do it
            if (swappedHappiness > currentHappiness + 0.05) {
              // Swap assignments using destructuring
              [siblingAssignments[keyA], siblingAssignments[keyB]] = [
                {
                  triangleIndex: triangleB,
                  preference: siblingA.preferences.find(p => p.triangleIndex === triangleB)
                },
                {
                  triangleIndex: triangleA,
                  preference: siblingB.preferences.find(p => p.triangleIndex === triangleA)
                }
              ];

              // Update triangle assignments
              triangleAssignments[triangleA] = siblingB;
              triangleAssignments[triangleB] = siblingA;

              madeSwap = true;
            }
          }
        }

        if (!madeSwap) break; // No more beneficial swaps
      }

      // Convert assignments to positions
      const assignments = {};
      const numTriangles = feature_angles.length * 2;
      const triangleAngleStep = (Math.PI * 2) / numTriangles;

      Object.keys(siblingAssignments).forEach(siblingKey => {
        const sibling = siblings.find(s => s.key === siblingKey);
        const { preference } = siblingAssignments[siblingKey];

        if (!preference) {
          assignments[siblingKey] = { x: 0, y: 0 };
          return;
        }

        // Calculate position within assigned triangle
        const assignedAngle = preference.angle;
        const baseRadius = preference.extremeness * 2;

        // Secondary features add variation
        let radialAdjustment = 0;
        let angularVariation = 0;

        if (sibling.preferences.length > 1) {
          const secondaryExtremeness = sibling.preferences.slice(1, 3)
            .reduce((sum, f) => sum + f.extremeness, 0) / Math.min(2, sibling.preferences.length - 1);
          radialAdjustment = secondaryExtremeness * 0.3;

          const secondaryFeature = sibling.preferences[1];
          const secondaryWeight = (secondaryFeature.percentile - 0.5) * 2;
          angularVariation = (secondaryWeight * 0.25) * (triangleAngleStep / 2);
        }

        const finalRadius = baseRadius + radialAdjustment;
        const finalAngle = assignedAngle + angularVariation;

        // Apply depth-based exaggeration
        const depthExaggeration = depth === 0 ? 1.2 : (depth === 1 ? 1.2 : 1.1);
        const featureCountExaggeration = 1.0;
        const effectiveExaggeration = exaggeration * depthExaggeration * featureCountExaggeration;

        // Convert to Cartesian
        let x = Math.cos(finalAngle) * finalRadius;
        let y = Math.sin(finalAngle) * finalRadius;

        x *= effectiveExaggeration;
        y *= effectiveExaggeration;

        const assignmentPosition = {
          x: x * projection_scale,
          y: y * projection_scale
        };
        assignments[siblingKey] = assignmentPosition;

        if (assignmentMetadata) {
          assignmentMetadata[siblingKey] = {
            preference
          };
        }
      });

      // Handle any unassigned siblings: fall back to semantic projection
      siblings.forEach(sibling => {
        if (!assignments[sibling.key]) {
          assignments[sibling.key] = calculateSemanticPosition(sibling.features, depth);
        }
      });

      return assignments;
    };

    // Compute positions for all genres and subgenres
    const rawResult = {};
    const hardCodedKeys = new Set();

    // STEP 1: Position root-level parent genres using the same triangle auction as subgenres
    const parentAnchors = {};
    const rootSiblings = [];
    const PARENT_MIN_RADIUS = 105;
    const PARENT_MAX_RADIUS = 205;
    const mapParentStrengthToRadius = (strength) => {
      const clamped = Math.max(0, Math.min(0.5, strength));
      const normalized = clamped / 0.5;
      return PARENT_MIN_RADIUS + normalized * (PARENT_MAX_RADIUS - PARENT_MIN_RADIUS);
    };
    Object.keys(manifest).forEach(genreKey => {
      if (genreKey === 'global' || genreKey === 'build') return;

      const genre = manifest[genreKey];
      if (!genre.features) return;

      // Skip Song of the Day (always at center)
      if (genre.isSongOfTheDay || genreKey === 'song of the day') {
        rawResult[genreKey] = { x: 0, y: 0 };
        hardCodedKeys.add(genreKey);
        return;
      }

      const features = genre.features || averagedParentFeatures[genreKey];
      if (!features) return;

      const trianglePreferences = [];
      const numTriangles = feature_angles.length * 2;
      const triangleAngleStep = (Math.PI * 2) / numTriangles;

      const createPreference = (featureName, isHigh, minExtremeness = null) => {
        const featureIndex = feature_angles.indexOf(featureName);
        if (featureIndex === -1) return null;
        if (activeFeatures[featureName] === false) return null;

        const rawValue = features[featureName];
        if (rawValue == null || isNaN(rawValue)) return null;

        let percentile = normalizeFeature(rawValue, featureName);
        percentile = applyContrastCurve(percentile, featureName);

        const rawExtremeness = Math.abs(percentile - 0.5);
        let extremeness = rawExtremeness;
        if (minExtremeness != null) {
          extremeness = Math.max(extremeness, minExtremeness);
        }
        if (extremeness <= 0) return null;

        const triangleIndex = isHigh ? featureIndex : featureIndex + feature_angles.length;

        return {
          triangleIndex,
          featureName,
          extremeness,
          rawExtremeness,
          percentile,
          angle: triangleIndex * triangleAngleStep,
          isHigh
        };
      };

      feature_angles.forEach((featureName, featureIndex) => {
        if (activeFeatures[featureName] === false) return;

        const rawValue = features[featureName];
        if (rawValue == null || isNaN(rawValue)) return;

        let percentile = normalizeFeature(rawValue, featureName);
        percentile = applyContrastCurve(percentile, featureName);

        const rawExtremeness = Math.abs(percentile - 0.5);
        const extremenessThreshold = 0.08;

        if (rawExtremeness > extremenessThreshold) {
          const highTriangleIndex = featureIndex;
          const lowTriangleIndex = featureIndex + feature_angles.length;

          if (percentile > 0.5) {
            trianglePreferences.push({
              triangleIndex: highTriangleIndex,
              featureName,
              extremeness: rawExtremeness,
              rawExtremeness,
              percentile,
              angle: highTriangleIndex * triangleAngleStep,
              isHigh: true
            });
          } else {
            trianglePreferences.push({
              triangleIndex: lowTriangleIndex,
              featureName,
              extremeness: rawExtremeness,
              rawExtremeness,
              percentile,
              angle: lowTriangleIndex * triangleAngleStep,
              isHigh: false
            });
          }
        }
      });

      if (genreKey === 'pop') {
        const forcedPopPref = createPreference('popularity', true, 0.65);
        if (forcedPopPref) {
          for (let i = trianglePreferences.length - 1; i >= 0; i--) {
            if (trianglePreferences[i].featureName === 'popularity' && trianglePreferences[i].isHigh) {
              trianglePreferences.splice(i, 1);
            }
          }
          trianglePreferences.push(forcedPopPref);
        }
      }

      if (genreKey === 'r&b / soul / funk') {
        const forcedNichePref = createPreference('popularity', false, 0.6);
        if (forcedNichePref) {
          for (let i = trianglePreferences.length - 1; i >= 0; i--) {
            if (trianglePreferences[i].featureName === 'popularity' && !trianglePreferences[i].isHigh) {
              trianglePreferences.splice(i, 1);
            }
          }
          trianglePreferences.push(forcedNichePref);
        }
      }

      if (genreKey === 'country') {
        const forcedLaidBackPref = createPreference('danceability', false, 0.6);
        if (forcedLaidBackPref) {
          for (let i = trianglePreferences.length - 1; i >= 0; i--) {
            if (trianglePreferences[i].featureName === 'danceability' && !trianglePreferences[i].isHigh) {
              trianglePreferences.splice(i, 1);
            }
          }
          trianglePreferences.push(forcedLaidBackPref);
        }
      }

      if (genreKey === 'hip hop') {
        const forcedDanceablePref = createPreference('danceability', true, 0.6);
        if (forcedDanceablePref) {
          for (let i = trianglePreferences.length - 1; i >= 0; i--) {
            if (trianglePreferences[i].featureName === 'danceability' && trianglePreferences[i].isHigh) {
              trianglePreferences.splice(i, 1);
            }
          }
          trianglePreferences.push(forcedDanceablePref);
        }
      }

      trianglePreferences.sort((a, b) => b.extremeness - a.extremeness);

      rootSiblings.push({
        key: genreKey,
        preferences: trianglePreferences,
        features
      });
    });

    if (rootSiblings.length > 0) {
      const parentAssignmentInfo = {};
      const parentAssignments = runTriangleAuction(rootSiblings, 0, parentAssignmentInfo);
      Object.entries(parentAssignments).forEach(([key, pos]) => {
        const info = parentAssignmentInfo[key];
        const assignedPref = info?.preference;
        let strength = assignedPref?.rawExtremeness ?? assignedPref?.extremeness ?? 0.15;
        if (key === 'hip hop') {
          strength = Math.max(strength, 0.3);
        }
        const angle = Math.atan2(pos.y, pos.x);
        const radius = mapParentStrengthToRadius(strength);
        const adjusted = {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius
        };
        rawResult[key] = adjusted;
        parentAnchors[key] = { x: adjusted.x, y: adjusted.y };
      });
    }

    rootSiblings.forEach(parent => {
      if (parentAnchors[parent.key]) return;
      const fallback = calculateSemanticPosition(parent.features, 0);
      rawResult[parent.key] = fallback;
      parentAnchors[parent.key] = fallback;
    });

    // STEP 2: Process subgenres for each root genre
    const processNode = (node, path = []) => {
      // Process subgenres with auction
      if (node.subgenres) {
        const subgenreKeys = Object.keys(node.subgenres);

        // Collect all sibling preferences
        const siblings = [];
        subgenreKeys.forEach(subkey => {
          const subnode = node.subgenres[subkey];
          if (!subnode.features) return;

          const siblingKey = [...path, subkey].join('.');
          const features = subnode.features;

          // Calculate triangle preferences
          const trianglePreferences = [];
          const numTriangles = feature_angles.length * 2;
          const triangleAngleStep = (Math.PI * 2) / numTriangles;

          feature_angles.forEach((featureName, featureIndex) => {
            if (activeFeatures[featureName] === false) return;

            const rawValue = features[featureName];
            let percentile = normalizeFeature(rawValue, featureName);
            percentile = applyContrastCurve(percentile, featureName);

            const extremeness = Math.abs(percentile - 0.5);

            if (extremeness > 0.15) {
              const highTriangleIndex = featureIndex;
              const lowTriangleIndex = featureIndex + feature_angles.length;

              if (percentile > 0.5) {
                trianglePreferences.push({
                  triangleIndex: highTriangleIndex,
                  featureName,
                  extremeness,
                  percentile,
                  angle: highTriangleIndex * triangleAngleStep,
                  isHigh: true
                });
              } else {
                trianglePreferences.push({
                  triangleIndex: lowTriangleIndex,
                  featureName,
                  extremeness,
                  percentile,
                  angle: lowTriangleIndex * triangleAngleStep,
                  isHigh: false
                });
              }
            }
          });

          trianglePreferences.sort((a, b) => b.extremeness - a.extremeness);

          siblings.push({
            key: siblingKey,
            preferences: trianglePreferences,
            features
          });
        });

        // Run auction for siblings
        if (siblings.length > 0) {
          const assignments = runTriangleAuction(siblings, path.length);
          Object.assign(rawResult, assignments);
        }

        // Recursively process deeper subgenres
        subgenreKeys.forEach(subkey => {
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
        // console.log(`\n🔍 ${path} MANIFEST FEATURES (used for positioning):`);
        // console.log(`  energy: ${node.features.energy?.toFixed(3)}`);
        // console.log(`  valence: ${node.features.valence?.toFixed(3)}`);
        // console.log(`  danceability: ${node.features.danceability?.toFixed(3)}`);
        // console.log(`  Seeds count: ${node.seeds?.length || 0}`);
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
            // console.log(`\n📊 ${path} ACTUAL SEED AVERAGES (${validProfiles.length} seeds loaded):`);
            // console.log(`  energy: ${avg.energy.toFixed(3)} (manifest: ${node.features.energy?.toFixed(3)}, diff: ${(avg.energy - node.features.energy).toFixed(3)})`);
            // console.log(`  valence: ${avg.valence.toFixed(3)} (manifest: ${node.features.valence?.toFixed(3)}, diff: ${(avg.valence - node.features.valence).toFixed(3)})`);
            // console.log(`  danceability: ${avg.danceability.toFixed(3)} (manifest: ${node.features.danceability?.toFixed(3)}, diff: ${(avg.danceability - node.features.danceability).toFixed(3)})`);
            const energyDiff = Math.abs(avg.energy - node.features.energy);
            const valenceDiff = Math.abs(avg.valence - node.features.valence);
            const danceDiff = Math.abs(avg.danceability - node.features.danceability);
            if (energyDiff > 0.05 || valenceDiff > 0.05 || danceDiff > 0.05) {
              // console.log(`\n⚠️  SIGNIFICANT MISMATCH DETECTED! Manifest features don't match actual seeds.`);
              // if (energyDiff > 0.05) console.log(`  - Energy off by ${energyDiff.toFixed(3)}`);
              // if (valenceDiff > 0.05) console.log(`  - Valence off by ${valenceDiff.toFixed(3)}`);
              // if (danceDiff > 0.05) console.log(`  - Danceability off by ${danceDiff.toFixed(3)}`);
            }
          }
        } catch (e) {
          console.error(`Failed to load profiles for ${path}:`, e);
        }
      }
    });
    */

    // ADAPTIVE SCALING with log transform and collision avoidance
    const TARGET_RADIUS = 210; // Increased from 195 to push nodes outward (ring is at 245px, inner at 245)
    const MIN_RADIUS_FROM_CENTER = 70; // Exclusion zone around song of the day at center

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
        // const angle = Math.atan2(y * scale, x * scale) * 180 / Math.PI;
        // const normalizedAngle = (angle + 360) % 360;
        // console.log(`\n🎸 ${key.toUpperCase()} SCALED POSITION:`);
        // console.log(`  Raw position: (${rawResult[key].x.toFixed(3)}, ${rawResult[key].y.toFixed(3)})`);
        // console.log(`  After scaling: (${(x * scale).toFixed(3)}, ${(y * scale).toFixed(3)})`);
        // console.log(`  Angle: ${normalizedAngle.toFixed(1)}°`);
        // console.log(`  Expected: near energy-high (205.7°) for rock music`);
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
      // For root-level parent genres prefer their curated feature profile,
      // but fall back to averaged subgenre data if needed.
      const isRootGenre = pathParts.length === 1;
      const genreKey = pathParts[0];
      const nodeFeatures = node?.features;
      const features = nodeFeatures || (isRootGenre ? averagedParentFeatures[genreKey] : null);

      if (features) {
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
    const MIN_DISTANCE_SIBLING = 110; // Increased 15px from 95 to fix swing/bebop overlap
    const MIN_DISTANCE_PARENT_CHILD = 140; // Increased 15px from 125
    const MIN_DISTANCE_ROOT = 170; // Increased 15px from 155 to fix country/jazz/rock overlap
    const MIN_DISTANCE_DEFAULT = 90; // Increased 15px from 75
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
            const isHardCoded1 = hardCodedKeys.has(key1);
            const isHardCoded2 = hardCodedKeys.has(key2);

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

    // Final clamping pass to ensure ALL nodes stay within boundary AND respect center exclusion zone
    Object.keys(scaledResult).forEach(key => {
      // Skip song of the day - it stays at center
      if (key === 'song of the day' || key.includes('song-of-the-day') || key.includes('songOfTheDay')) {
        return;
      }

      const node = scaledResult[key];
      const dist = Math.sqrt(node.x * node.x + node.y * node.y);

      // Push away from center if too close (song of the day exclusion zone)
      if (dist < MIN_RADIUS_FROM_CENTER && dist > 0) {
        const scale = MIN_RADIUS_FROM_CENTER / dist;
        node.x *= scale;
        node.y *= scale;
      }
      // Clamp to outer boundary
      else if (dist > TARGET_RADIUS) {
        const scale = TARGET_RADIUS / dist;
        node.x *= scale;
        node.y *= scale;
      }
    });

    // Reapply auction anchors for parent genres to keep them from drifting
    Object.entries(parentAnchors).forEach(([key, anchor]) => {
      if (!scaledResult[key]) {
        scaledResult[key] = { x: anchor.x, y: anchor.y, features: null };
      } else {
        scaledResult[key].x = anchor.x;
        scaledResult[key].y = anchor.y;
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

    // DEBUG: Log final positions after collision avoidance (DISABLED)
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
  }, [manifest, exaggeration, activeFeatures]);

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
