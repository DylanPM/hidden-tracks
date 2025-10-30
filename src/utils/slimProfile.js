// src/utils/slimProfile.js

export function makeColIndex(cols) {
  const map = new Map();
  cols.forEach((k, i) => map.set(k, i));
  return map;
}

// Dequantizers
export const deq = {
  x10: (v) => (v == null ? null : v / 10),
  x100: (v) => (v == null ? null : v / 100),
  x1000: (v) => (v == null ? null : v / 1000),
};

// Bitfield flags → booleans
export function decodeFlags(bits = 0) {
  return {
    explicit: !!(bits & 1),
    feat: !!(bits & 2),
    remix: !!(bits & 4),
    live: !!(bits & 8),
    instrumental: !!(bits & 16),
    cover: !!(bits & 32),
    demo: !!(bits & 64),
  };
}

// Turn a single row into a friendly object
export function rowToObj(row, col, dict) {
  const get = (key) => row[col.get(key)];

  const artistIdx = get("a");
  const simc = get("simc") || {};

  return {
    id: get("id"),
    uri: get("uri"),
    name: get("t"),
    artistIndex: artistIdx,
    artist: Array.isArray(dict?.artists) ? dict.artists[artistIdx] : null,

    year: get("y"),
    popularity: get("pop"),
    duration_ms: get("dur_ms"),

    key: get("k"),
    mode: get("m"),
    time_signature: get("ts"),

    tempo: deq.x10(get("tempo_x10")),
    loudness_db: deq.x10(get("loud_x10")),

    danceability: deq.x100(get("dan_x100")),
    energy: deq.x100(get("ene_x100")),
    valence: deq.x100(get("val_x100")),
    acousticness: deq.x100(get("aco_x100")),
    instrumentalness: deq.x100(get("ins_x100")),
    liveness: deq.x100(get("liv_x100")),
    speechiness: deq.x100(get("spe_x100")),

    flags: decodeFlags(get("flags")),
    era_distance: get("era_dist"),
    same_artist: !!get("same_artist"),

    sim_overall: deq.x1000(get("sim_overall_x1000")),
    radio_fit: deq.x1000(get("radio_fit_x1000")),
    clarity: deq.x1000(get("clarity_x1000")),

    // component similarity values are already stored as 0..1000 ints
    // convert to 0..1 for easier reasoning
    sim_components: Object.fromEntries(
      Object.entries(simc).map(([k, v]) => [k, deq.x1000(v)])
    ),
  };
}

// Convenience to map all rows
export function mapRows(profile) {
  const col = makeColIndex(profile.cols);
  return profile.rows.map((r) => rowToObj(r, col, profile.dict));
}

// Filtering helpers for gameplay
export function filterByThreshold(tracks, key, minVal) {
  return tracks.filter((t) => (t[key] ?? -Infinity) >= minVal);
}

export function topNBy(tracks, key, n) {
  return [...tracks].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0)).slice(0, n);
}
