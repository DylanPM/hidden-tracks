import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';

/**
 * GenreConstellationSelect
 * 
 * Interactive genre tree for profile selection.
 * Users navigate through genres → subgenres → tracks, then launch with difficulty.
 * 
 * Expects:
 *   - /genre_constellation_manifest.json with shape matching your current code:
 *       { rock: {...}, electronic: {...}, ... }
 *       nodes may have: subgenres: {...}, seeds: [{ uri, name, artist, filename }, ...]
 */
export function GenreConstellationSelect({ onLaunch }) {
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Intro overlay (once per session)
  const [showIntro, setShowIntro] = useState(true);
  useEffect(() => {
    const seen = sessionStorage.getItem('ht_seen_intro') === '1';
    if (seen) setShowIntro(false);
  }, []);
  const dismissIntro = () => {
    sessionStorage.setItem('ht_seen_intro', '1');
    setShowIntro(false);
  };

  // Navigation + selection
  const [navigationPath, setNavigationPath] = useState([]); // e.g. ['hip hop', 'boom bap']
  const [selectedTrack, setSelectedTrack] = useState(null); // leaf selection
  const [difficulty, setDifficulty] = useState('medium');   // easy | medium | hard
  const [launchAnimation, setLaunchAnimation] = useState(false);

  // Load manifest
  useEffect(() => {
    fetch('/genre_constellation_manifest.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load genre manifest');
        return res.json();
      })
      .then(data => {
        setManifest(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // --- Helpers that match your existing structure ---

  const getCurrentNode = () => {
    if (!manifest) return null;
    if (navigationPath.length === 0) return manifest;

    let node = manifest;
    for (const key of navigationPath) {
      if (node[key]) {
        node = node[key];
      } else if (node.subgenres && node.subgenres[key]) {
        node = node.subgenres[key];
      }
    }
    return node;
  };

  const getChildren = () => {
    const node = getCurrentNode();
    if (!node) return [];

    const children = [];
    // direct genre children at this level
    Object.keys(node).forEach(key => {
      if (key !== 'seeds' && key !== 'subgenres' && typeof node[key] === 'object') {
        children.push({ key, type: 'genre', data: node[key] });
      }
    });
    // nested subgenres
    if (node.subgenres) {
      Object.keys(node.subgenres).forEach(key => {
        children.push({ key, type: 'subgenre', data: node.subgenres[key] });
      });
    }
    return children;
  };

  const getSeeds = () => {
    const node = getCurrentNode();
    return node?.seeds || [];
  };

  const handleGenreClick = (key) => {
    setNavigationPath(prev => [...prev, key]);
    setSelectedTrack(null);
    setLaunchAnimation(true);
    setTimeout(() => setLaunchAnimation(false), 600);
  };

  const handleTrackClick = (track) => {
    setSelectedTrack(track);
    setLaunchAnimation(true);
    setTimeout(() => setLaunchAnimation(false), 600);
  };

  const handleBack = () => {
    if (navigationPath.length === 0) return;
    setNavigationPath(navigationPath.slice(0, -1));
    setSelectedTrack(null);
  };

  const canLaunch = () => {
    const seeds = getSeeds();
    return seeds.length > 0;
  };

  // Normalize outgoing tracks for RadioPuzzleGame (id, artists[])
  const normalizeTracks = (tracks) =>
    tracks.map((track) => ({
      id: track.uri,
      name: track.name,
      artists: Array.isArray(track.artist) ? track.artist : [track.artist],
      filename: track.filename,
    }));

  const handleLaunch = () => {
    const seeds = getSeeds();

    if (selectedTrack) {
      onLaunch(normalizeTracks([selectedTrack]), difficulty);
      return;
    }
    if (seeds.length > 0) {
      onLaunch(normalizeTracks(seeds), difficulty);
    }
  };

    // Orbit geometry
  const CENTER_X = 400;
  const CENTER_Y = 300;
  const LAUNCH_R = 90;          // center button
  const DESC_R   = 130;         // circular text path
  const RING_OUTER_R = 150;     // faint outer ring
  const GAP = 16;               // space between rings and node circles
  const CHIP_SAFE_R = 185;      // anything below this risks hitting difficulty chips

  // // --- UI derived values ---
  // const children = getChildren();
  // const seeds = getSeeds();
  // const currentGenre =
  //   navigationPath.length > 0 ? navigationPath[navigationPath.length - 1] : 'a genre';

  // // geometry


  // const numCircles = children.length > 0 ? children.length : seeds.length;
  // const baseRadius = Math.min(220, 160 + numCircles * 5); // orbit radius
  // const circleRadius = children.length > 0
  //   ? Math.max(45, 85 - numCircles * 2)  // genre circle size
  //   : Math.max(55, 95 - numCircles * 2); // track circle size

  // How many nodes at this level
  const children = getChildren();
  const seeds = getSeeds();
  // ADD THESE LINES
const currentGenre = navigationPath.length
  ? navigationPath[navigationPath.length - 1]
  : 'a genre';

  // Node sizes
  const genreNodeR = Math.max(48, 90 - (children.length * 1.5)); // parent/subgenre nodes
  const seedNodeR  = Math.max(56, 96 - (seeds.length * 1.5));    // track nodes

  // Orbits
  // For genres/subgenres: tangent to the outer text ring, plus a margin
  const childrenOrbitR = Math.max(
    RING_OUTER_R + genreNodeR + GAP,
    CHIP_SAFE_R + genreNodeR // guarantee clearance from difficulty chips
  );

  // For leaf nodes: push farther so labels never collide with chips
  const seedsOrbitR = Math.max(
    RING_OUTER_R + seedNodeR + GAP + 28,
    CHIP_SAFE_R + seedNodeR + 20
  );


  // description for SVG ring text (better than your previous “explore the sounds of …”)
  const genreDescription = `${getGenreDescription(currentGenre)} • ${getGenreDescription(currentGenre)}`;


  // --- Render ---

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Loading genres...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative">
      {/* Once-per-session intro */}
      {showIntro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70">
          <div className="w-full max-w-xl rounded-2xl bg-zinc-900 shadow-xl border border-zinc-800">
            <div className="p-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-3">Welcome to Hidden Tracks</h2>
              <p className="text-zinc-300 mb-2">
                See how recommendation systems think. Explore the logic behind algorithmic playlists and
                guess the other songs the machine would queue up next.
              </p>
              <p className="text-zinc-400 mb-4">
                Pick a genre, sub-genre, or song you love, set a difficulty, then launch your mix.
              </p>
              <p className="text-zinc-500 text-xs mb-6">Built with the help of Anthropic’s Claude.</p>
              <button
                onClick={dismissIntro}
                className="px-5 py-2 rounded-lg font-semibold bg-green-500 text-black hover:bg-green-400 transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wider Back zone */}
      {navigationPath.length > 0 && (
        <button
          onClick={handleBack}
          className="fixed left-0 top-0 h-full w-1/3
                     bg-gradient-to-r from-green-900/70 via-green-900/30 to-transparent
                     flex items-center justify-start pl-10
                     hover:from-green-700/70 hover:via-green-700/40
                     transition-all duration-300 z-20 group"
          aria-label="Back"
        >
          <div className="flex flex-col items-center gap-3 pointer-events-none">
            <ChevronLeft size={80} className="text-green-400 group-hover:text-green-300 transition-colors" />
            <span className="text-green-400 group-hover:text-green-300 text-sm font-bold rotate-[-90deg] tracking-wider">
              BACK
            </span>
          </div>
        </button>
      )}

      {/* Canvas */}
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="relative w-full max-w-4xl">
          <svg width="100%" height="600" viewBox="0 0 800 600" className="overflow-visible">
            {/* Center ring + circular description + launch */}
            <g className={launchAnimation ? 'animate-bounce-subtle' : ''}>
              {/* circular text path and rings */}
              <defs>
                {/* description text runs around DESC_R */}
                <path id="ringPath" d={`M${CENTER_X},${CENTER_Y} m-${DESC_R},0 a${DESC_R},${DESC_R} 0 1,1 ${DESC_R*2},0 a${DESC_R},${DESC_R} 0 1,1 -${DESC_R*2},0`} />
              </defs>

              {/* faint outer ring */}
              <circle
                cx={CENTER_X}
                cy={CENTER_Y}
                r={RING_OUTER_R}
                fill="none"
                stroke="#16a34a"
                strokeWidth="2"
                opacity="0.35"
              />

              {/* animated ticker description */}
              <text className="fill-green-200" style={{ fontSize: 10, letterSpacing: 0.5 }}>
                <textPath href="#ringPath" startOffset="0%">
                  <animate attributeName="startOffset" from="0%" to="100%" dur="10s" repeatCount="indefinite" />
                  {genreDescription}
                </textPath>
              </text>

              {/* launch button */}
              <circle
                 cx={CENTER_X}
                 cy={CENTER_Y}
                 r={LAUNCH_R}
                fill={canLaunch() ? "#22c55e" : "#27272a"}
                stroke={canLaunch() ? "#16a34a" : "#3f3f46"}
                strokeWidth="4"
                className={canLaunch() ? "cursor-pointer transition-all" : "cursor-not-allowed transition-all"}
                onClick={canLaunch() ? handleLaunch : undefined}
                style={{
                  transform: launchAnimation ? 'scale(1.08)' : 'scale(1)',
                  transformOrigin: '400px 300px',
                  transition: 'transform 0.25s ease-out'
                }}
              />
              <text
                x="400"
                y="292"
                textAnchor="middle"
                dominantBaseline="middle"
                fill={canLaunch() ? "black" : "#a1a1aa"}
                fontSize="22"
                fontWeight="800"
                className="pointer-events-none uppercase"
              >
                Launch
              </text>
              <text
                x="400"
                y="318"
                textAnchor="middle"
                dominantBaseline="middle"
                fill={canLaunch() ? "black" : "#a1a1aa"}
                fontSize="14"
                className="pointer-events-none capitalize"
              >
                {currentGenre}
              </text>

              {/* orbiting difficulty chips (bottom half) */}
              {renderDifficultyChip(400 - 120, 360, 'easy', difficulty, setDifficulty)}
              {renderDifficultyChip(400,       390, 'medium', difficulty, setDifficulty)}
              {renderDifficultyChip(400 + 120, 360, 'hard', difficulty, setDifficulty)}
            </g>

            {/* --- GENRE / SUBGENRE ORBIT --- */}
            {children.length > 0 && children.map((child, index) => {
              const angle = (index / children.length) * 2 * Math.PI - Math.PI / 2;
              const cx = CENTER_X + Math.cos(angle) * childrenOrbitR;
              const cy = CENTER_Y + Math.sin(angle) * childrenOrbitR;

              // word-wrap genre label
              const words = child.key.split(' ');
              const lines = [];
              let currentLine = '';
              words.forEach(w => {
                if ((currentLine + ' ' + w).trim().length > 12) {
                  if (currentLine) lines.push(currentLine);
                  currentLine = w;
                } else {
                  currentLine = currentLine ? `${currentLine} ${w}` : w;
                }
              });
              if (currentLine) lines.push(currentLine);

              return (
                <g
                  key={child.key}
                  onClick={() => handleGenreClick(child.key)}
                  className="cursor-pointer transition-all"
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={genreNodeR}
                    fill="#18181b"
                    stroke="#22c55e"
                    strokeWidth="3"
                    className="hover:fill-zinc-800 hover:stroke-green-400 transition-all"
                  />
                  {lines.map((ln, i) => (
                    <text
                      key={i}
                      x={cx}
                      y={cy - (lines.length - 1) * 7 + i * 14}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="13"
                      fontWeight="500"
                      className="pointer-events-none"
                    >
                      {ln}
                    </text>
                  ))}
                </g>
              );
            })}

            {/* --- LEAF-LEVEL SEEDS / TRACKS ORBIT --- */}
            {seeds.length > 0 && children.length === 0 && seeds.map((track, index) => {
              const angle = (index / seeds.length) * 2 * Math.PI - Math.PI / 2;
              const cx = CENTER_X + Math.cos(angle) * seedsOrbitR;
              const cy = CENTER_Y + Math.sin(angle) * seedsOrbitR;
              const isSelected = selectedTrack?.uri === track.uri;

              // truncate long artist / title
              const artistText =
                track.artist.length > 16 ? track.artist.slice(0, 16) + '…' : track.artist;
              const songText =
                track.name.length > 18 ? track.name.slice(0, 18) + '…' : track.name;

              return (
                <g
                  key={track.uri}
                  onClick={() => handleTrackClick(track)}
                  className="cursor-pointer transition-all"
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={seedNodeR}
                    fill={isSelected ? "#22c55e" : "#18181b"}
                    stroke="#22c55e"
                    strokeWidth={isSelected ? "4" : "3"}
                    className="hover:fill-zinc-800 transition-all"
                  />
                  <text
                    x={cx}
                    y={cy - 14}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="13"
                    fontWeight="600"
                    className="pointer-events-none"
                  >
                    {artistText}
                  </text>
                  <text
                    x={cx}
                    y={cy + 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#a1a1aa"
                    fontSize="11"
                    className="pointer-events-none"
                  >
                    {songText}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers: difficulty chip, genre descriptions ---------- */

function renderDifficultyChip(x, y, level, current, setDifficulty) {
  const active = current === level;
  const classes = active
    ? 'fill-green-600 stroke-green-300'
    : 'fill-zinc-900 stroke-zinc-700';
  const textFill = active ? 'black' : '#d4d4d8';

  return (
    <g
      className="cursor-pointer transition"
      onClick={() => setDifficulty(level)}
      transform={`translate(${x - 32}, ${y - 32})`} // center a 64x64 circle
    >
      <circle cx="32" cy="32" r="32" className={classes} strokeWidth="2" />
      <text
        x="32"
        y="36"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={textFill}
        fontSize="11"
        fontWeight="800"
      >
        {level[0].toUpperCase() + level.slice(1)}
      </text>
    </g>
  );
}

function getGenreDescription(genreName) {
  const map = {
  // Roots
    rock: 'Guitars forward, live drum feel, verse–chorus lift. Expect riffs, backbeat, and amp grit.',
    electronic: 'Synths, drum machines, and grid-tight rhythm. Texture and pulse drive the form.',
    'hip hop': 'Drum patterns and vocal rhythm lead. Kicks, snares, and flow sit in the pocket.',
    'r&b': 'Smooth vocals over pocketed drums and warm chords. Melody glides and bass sings.',
    soul: 'Powerful vocals, rich harmony, and groove-led rhythm sections.',
    funk: 'Syncopated bass, clipped guitars, tight drums. The pocket is the hook.',
    jazz: 'Improvisation, extended harmony, acoustic or electric ensembles, swing or straight.',
    country: 'Story-first songs, steady backbeat, twang color. Choruses land clean.',
    folk: 'Acoustic instruments, intimate vocals, lyric focus, simple harmonic movement.',
    latin: 'Percussive rhythm languages, clave patterns, dance forms, bright hooks.',
    reggae: 'Off-beat skank guitar, deep bass, laid-back groove, spacious mix.',
    afrobeat: 'Polyrhythms, long vamps, horn punches, call and response.',
    classical: 'Orchestral or chamber instruments, formal structures, dynamic range.',
    experimental: 'Form and timbre as a playground. Expect rule-bending structures.',

    // Rock subs
    metal: 'High-gain guitars, aggressive drums, extended techniques, darker harmony.',
    'thrash metal': 'Fast tempos, palm-muted riffs, double kick, shouted vocals.',
    'doom metal': 'Slow, heavy, sustained chords, bleak atmosphere.',
    'sludge metal': 'Thick, dirty tones, hardcore energy, dragging groove.',
    'black metal': 'Tremolo picking, blast beats, raw textures, icy harmony.',
    'death metal': 'Low tunings, complex riffing, growled vocals, relentless drums.',
    'progressive metal': 'Odd meters, long forms, technical playing, melodic complexity.',
    'nu metal': 'Down-tuned riffs, hip hop influence, simple grooves, angst-driven hooks.',
    punk: 'Fast, raw, direct. Power chords, shouted hooks, minimal ornament.',
    'post-punk': 'Angular guitars, groove-led bass, moody vocals, experimental edges.',
    emo: 'Melodic guitars, dynamic swings, confessional vocals.',
    'alternative rock': 'Guitar rock with left-field choices, off-center hooks.',
    'indie rock': 'Looser feel, character vocals, textural guitars, DIY polish.',
    shoegaze: 'Wall of guitars, heavy reverb, buried vocals, floating harmony.',
    grunge: 'Thick distortion, mid-tempo grind, dynamic quiet–loud forms.',
    'post-rock': 'Crescendo architecture, repetitive motifs, timbre-as-melody.',
    'classic rock': 'Blues-based riffs, big choruses, radio-ready structures.',
    'garage rock': 'Raw takes, energetic tempos, simple changes, live feel.',
    'psychedelic rock': 'Extended jams, swirling effects, modal or droning harmony.',
    'hard rock': 'Big amps, tight grooves, soaring vocals, riff-forward writing.',

    // Electronic subs
    house: 'Four-on-the-floor, warm bass, looped chords, long builds.',
    'deep house': 'Subtle grooves, jazzy chords, smooth vocals, late-night feel.',
    'tech house': 'Minimal harmony, punchy drums, techy textures, steady drive.',
    'progressive house': 'Melodic arcs, evolving layers, long tension and release.',
    'acid house': 'Squelchy 303 lines, repetitive patterns, hypnotic drums.',
    techno: 'Machine pulse and evolving timbre. Functional rhythm for movement.',
    'minimal techno': 'Sparse elements, micro-variation, surgical low end.',
    trance: 'Big melodic leads, saw stacks, euphoric drops, long phrases.',
    'progressive trance': 'Smoother leads, deeper builds, patient phrasing.',
    psytrance: 'Psychedelic textures, fast tempos, rolling basslines.',
    'drum and bass': 'Fast breakbeats, deep subs, chopped samples, fierce momentum.',
    jungle: 'Amen breaks, ragga influence, raw sampling, swingy chaos.',
    dubstep: 'Half-time lurch, wobble bass, stark space between hits.',
    brostep: 'Maximalist sound design, heavy drops, midrange aggression.',
    'melodic dubstep': 'Lyrical leads, cinematic chords, gentle drops.',
    edm: 'Festival-scale builds, big drops, high-impact hooks.',
    electro: 'Syncopated synth bass, robotic hits, tight grooves.',
    synthwave: 'Retro synth tones, 80s drum machines, neon mood.',
    ambient: 'Beatless or soft pulse, long sustains, atmosphere first.',

    // Hip hop subs
    rap: 'Bars over drums, cadence and rhyme carry the hook.',
    trap: 'Fast hats, 808 subs, sparse melodies, minor-key pads.',
    drill: 'Sliding 808s, triplet hats, gritty narratives.',
    'gangsta rap': 'Street narratives, heavy low end, blunt delivery.',
    'boom bap': 'Dusty breaks, chopped samples, head-nod swing.',
    'east coast hip hop': 'Sample-heavy beats, lyrical density, tight snares.',
    'west coast rap': 'Laid-back swing, sine bass, talkbox or synth color.',
    'southern hip hop': 'Club bounce, sub pressure, chant hooks.',
    'conscious hip hop': 'Lyric focus, social commentary, soulful backdrops.',
    'alternative hip hop': 'Left-field production, genre blends, experimental forms.',
    'underground hip hop': 'Lo-fi grit, crate-dig aesthetics, bar focus.',
    phonk: 'Memphis tape grit, cowbells, distorted 808s.',
    'cloud rap': 'Airy pads, reverb-washed drums, floaty vocals.',

    // R&B subs
    'contemporary r&b': 'Modern drums, glossy layers, melisma and tight stacks.',
    'neo soul': 'Organic grooves, jazz harmony, intimate delivery.',
    'quiet storm': 'Slow tempo, lush arrangements, late-night mood.',

    // Soul subs
    motown: 'Tight rhythm section, string sweetening, call-and-response hooks.',
    disco: 'Four-on-the-floor, octave bass, string lines, party focus.',

    // Funk subs
    'funk rock': 'Rock guitars over syncopated funk rhythm sections.',
    boogie: 'Early 80s drum machines, slap bass, glossy synths.',

    // Jazz subs
    bebop: 'Fast tempos, complex changes, agile lines.',
    'cool jazz': 'Relaxed tempos, soft timbre, arranged interplay.',
    'hard bop': 'Blues influence, punchy drums, soulful heads.',
    swing: 'Walking bass, ride cymbal swing, horn sections.',
    'jazz fusion': 'Electric instruments, rock energy, odd meters.',
    'smooth jazz': 'Polished tone, gentle grooves, melody first.',
    'vocal jazz': 'Standards, close mic, phrasing and nuance.',
    'nu jazz': 'Electronic textures with jazz harmony and rhythm.',
    'avant-garde jazz': 'Free rhythm, extended techniques, open forms.',

    // Country subs
    'classic country': 'Two-step rhythms, pedal steel, narrative lyrics.',
    'outlaw country': 'Rough edges, bar band swing, anti-Nashville stance.',
    bluegrass: 'Acoustic speed, banjo and fiddle leads, tight harmonies.',
    'country rock': 'Rock backbeat, twang guitars, road-song feel.',
    'southern rock': 'Dual leads, blues harmony, swaggering grooves.',
    'roots rock': 'American folk and country influences in a rock frame.',

    // Folk subs
    americana: 'Roots palette, lyrical storytelling, band-in-a-room feel.',

    // Latin subs
    reggaeton: 'Dembow groove, synth hooks, call-and-response vocals.',
    'latin pop': 'Bright melodies, modern production, crossover hooks.',
    salsa: 'Clave-driven percussion, horn stabs, montuno piano.',
    bachata: 'Guitar arpeggios, romantic vocals, syncopated step.',
    cumbia: 'Shuffle feel, accordion or synth leads, communal dance.',
    merengue: 'Fast two-beat, horns and tambora, party energy.',
    tropical: 'Caribbean rhythm blends, bright percussion, festive tone.',
    mambo: 'Big band horns, syncopated riffs, dance-floor drive.',
    'bossa nova': 'Soft swing, jazz chords on nylon guitar, intimate vocals.',

    // Reggae subs
    dub: 'Stripped mixes, heavy delay and reverb, bass as lead.',
    ska: 'Upstroke guitars on the off-beat, brisk tempos, horn lines.',
    dancehall: 'Digital riddims, toasting vocals, club focus.',

    // Afrobeat subs
    afropop: 'Modern pop forms with African rhythm and melody shapes.',
    amapiano: 'Log drum bass, relaxed tempo, piano riffs, SA groove.',
    soca: 'Carnival energy, bright percussion, chantable hooks.',

    // Classical subs
    baroque: 'Figured bass, counterpoint, ornate lines.',
    romantic: 'Expansive themes, rich harmony, dramatic dynamics.',
    'modern classical': '20th-century language, new textures and forms.',
    soundtrack: 'Cinematic themes, leitmotifs, orchestration for scene.',
    'new age': 'Meditative textures, slow evolution, soothing harmonies.',
    minimalism: 'Repetition, phase shifts, gradual change.',
    drone: 'Sustained tones, harmonic stasis, focus on timbre.',

    // Experimental subs
    'avant-garde': 'Rule-breaking form, extended techniques, concept focus.',
    noise: 'Distortion, feedback, texture as primary material.',
    glitch: 'Digital artifacts as rhythm and color, micro-edits.',
    'lo-fi': 'Intentional roughness, tape hiss, intimate immediacy.',
  };
  const key = String(genreName || '').toLowerCase();
  return map[key] || 'A distinct palette of rhythm, timbre, and structure. Listen for the signature groove and texture choices.';
}
