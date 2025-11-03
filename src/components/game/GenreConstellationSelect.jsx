import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';

/**
 * GenreConstellationSelect
 * Interactive genre tree → pick a genre/subgenre/track, then launch.
 * Difficulty selection is kept as state but the UI is commented out for now.
 */
export function GenreConstellationSelect({ onLaunch }) {
  // manifest + load state
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // one-time intro
  const [showIntro, setShowIntro] = useState(true);
  useEffect(() => {
    if (sessionStorage.getItem('ht_seen_intro') === '1') setShowIntro(false);
  }, []);
  const dismissIntro = () => {
    sessionStorage.setItem('ht_seen_intro', '1');
    setShowIntro(false);
  };

  // navigation + selection
  const [navigationPath, setNavigationPath] = useState([]); // e.g. ['hip hop']
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [launchAnimation, setLaunchAnimation] = useState(false);

  // keep difficulty in state, pass to onLaunch, UI is commented out
  const [difficulty, setDifficulty] = useState('medium');

  // ------------------------------------------
  // descriptions
  // ------------------------------------------
  const getGenreDescription = (name) => {
    const d = {
      rock: 'Guitars in front. Riffs, choruses, amps on the edge.',
      electronic: 'Machines on pulse. Drum programming, synth color, grid tightness.',
      'hip hop': 'Flow over drums. Sample craft, 808 weight, hook logic.',
      'r&b': 'Smooth vocals over pocketed drums and warm chords.',
      soul: 'Belting, call and response, church in the DNA.',
      funk: 'Syncopation and space. Bass leads, drums speak.',
      jazz: 'Improvisation over harmony. Swing feel, chord color.',
      country: 'Story first. Harmony vocals, twang, clean rhythm sections.',
      folk: 'Acoustic storytelling. Intimate delivery, lyric focus.',
      latin: 'Clave, dance, and melody from many regional traditions.',
      reggae: 'Laid-back groove, off-beat guitar, deep bass.',
      afrobeat: 'Polyrhythms, long vamps, call and response.',
      classical: 'Orchestral scale, written forms, dynamic shape.',
      experimental: 'Texture and process at the center. Form in flux.',
      // a few common subs (safe fallback)
      trap: '808s, stuttering hats, melodic minor motifs.',
      'boom bap': 'Swinging kicks and snares, chopped samples.',
      'neo soul': 'Modern soul harmony and hip hop pocket.'
    };
    return d[name?.toLowerCase?.()] ?? `A distinct palette of rhythm, timbre, and structure.`;
  };

  // ------------------------------------------
  // load manifest
  // ------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/genre_constellation_manifest.json');
        if (!res.ok) throw new Error(`Failed to load genre manifest`);
        const data = await res.json();
        setManifest(data);
        setLoading(false);
      } catch (e) {
        setError(e.message);
        setLoading(false);
      }
    })();
  }, []);

  // ------------------------------------------
  // tree helpers
  // ------------------------------------------
  const getCurrentNode = () => {
    if (!manifest) return null;
    if (navigationPath.length === 0) return manifest;
    let node = manifest;
    for (const key of navigationPath) {
      if (node[key]) node = node[key];
      else if (node.subgenres?.[key]) node = node.subgenres[key];
    }
    return node;
  };

  const getChildren = () => {
    const node = getCurrentNode();
    if (!node) return [];
    const out = [];
    // top-level style children
    Object.keys(node).forEach((k) => {
      if (k !== 'seeds' && k !== 'subgenres' && typeof node[k] === 'object') {
        out.push({ key: k, type: 'genre', data: node[k] });
      }
    });
    // nested subgenres
    if (node.subgenres) {
      Object.keys(node.subgenres).forEach((k) =>
        out.push({ key: k, type: 'subgenre', data: node.subgenres[k] })
      );
    }
    return out;
  };

  const getSeeds = () => getCurrentNode()?.seeds || [];

  // ------------------------------------------
  // launch + nav
  // ------------------------------------------
  const handleGenreClick = (key) => {
    setNavigationPath((p) => [...p, key]);
    setSelectedTrack(null);
    setTimeout(() => {
      setLaunchAnimation(true);
      setTimeout(() => setLaunchAnimation(false), 600);
    }, 60);
  };

  const handleTrackClick = (track) => {
    setSelectedTrack(track);
    setLaunchAnimation(true);
    setTimeout(() => setLaunchAnimation(false), 600);
  };

  const handleBack = () => {
    if (navigationPath.length === 0) return;
    setNavigationPath((p) => p.slice(0, -1));
    setSelectedTrack(null);
  };

  const canLaunch = () => {
    const seeds = getSeeds();
    return seeds.length > 0;
  };

  const handleLaunch = () => {
    const seeds = getSeeds();
    if (selectedTrack) {
      onLaunch([selectedTrack], difficulty);
      return;
    }
    if (seeds.length > 0) {
      onLaunch(seeds, difficulty);
    }
  };

  // ------------------------------------------
  // derived view data
  // ------------------------------------------
  const children = getChildren();
  const seeds = getSeeds();
  const currentGenre = navigationPath.length
    ? navigationPath[navigationPath.length - 1]
    : 'a genre';

  // ------------------------------------------
  // geometry so circles are tangent to the description ring
  // ------------------------------------------
  const CENTER_X = 400;
  const CENTER_Y = 300;
  const LAUNCH_R = 100;

  // description ring
  const TEXT_RING_R = LAUNCH_R + 18;  // centerline radius for the ring
  const TEXT_RING_STROKE = 14;        // keep this synced with the ring strokeWidth
  const TEXT_RING_OUTER_R = TEXT_RING_R + TEXT_RING_STROKE / 2;

  // node sizes adapt to count
  const count = children.length > 0 ? children.length : seeds.length;
  const genreNodeR = children.length > 0 ? Math.max(52, 88 - count * 2) : 70;
  const seedNodeR  = seeds.length    > 0 ? Math.max(60, 100 - count * 2) : 60;

  // tangent distance from ring outer edge, with a small pad
  const baseRadius = (children.length > 0)
    ? TEXT_RING_OUTER_R + genreNodeR + 8
    : TEXT_RING_OUTER_R + seedNodeR  + 8;

  const circleRadius = (children.length > 0) ? genreNodeR : seedNodeR;

  // back overlay width: stops at tangent of the outermost circle
  const leftStopPx = Math.max(0, CENTER_X - (baseRadius + circleRadius + 12));

  // orbiting text content and speed (slowed ~33%)
  const genreDescription = `${getGenreDescription(currentGenre)} • ${getGenreDescription(currentGenre)}`;
  const TICKER_MS = 18000;

  // precompute positions
  const items = useMemo(() => {
    const list = children.length > 0 ? children : seeds;
    if (list.length === 0) return [];
    const res = [];
    for (let i = 0; i < list.length; i++) {
      const angle = (i / list.length) * Math.PI * 2 - Math.PI / 2;
      res.push({
        item: list[i],
        cx: CENTER_X + Math.cos(angle) * baseRadius,
        cy: CENTER_Y + Math.sin(angle) * baseRadius,
      });
    }
    return res;
  }, [children, seeds, baseRadius]);

  // ------------------------------------------
  // loading / error
  // ------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Loading genres…</div>
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

  // ------------------------------------------
  // render
  // ------------------------------------------
  return (
    <div className="min-h-screen bg-zinc-950 text-white relative font-sans">
      {/* Intro modal */}
      {showIntro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70">
          <div className="w-full max-w-xl rounded-2xl bg-zinc-900 shadow-xl border border-zinc-800">
            <div className="p-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-3">Welcome to Hidden Tracks</h2>
              <p className="text-zinc-300 mb-2">
                See how recommendation systems think. Explore the logic behind algorithmic playlists and
                guess the other songs the model would queue next.
              </p>
              <p className="text-zinc-400 mb-4">
                Pick a genre, sub-genre, or a song you love, then launch your mix.
              </p>
              <p className="text-zinc-500 text-xs mb-6">
                Built with help from Anthropic’s Claude.
              </p>
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

      {/* Back overlay limited to tangent */}
      {navigationPath.length > 0 && (
        <button
          onClick={handleBack}
          className="fixed left-0 top-0 h-full z-20 group transition-colors"
          style={{
            width: `${leftStopPx}px`,
            background:
              'linear-gradient(90deg, rgba(16,185,129,0.35) 0%, rgba(16,185,129,0.15) 70%, rgba(0,0,0,0) 100%)',
          }}
          title="Back"
        >
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
            <ChevronLeft size={56} className="text-green-400" />
            <span className="text-green-400 text-xs font-bold tracking-wider rotate-[-90deg]">
              BACK
            </span>
          </div>
        </button>
      )}

      {/* Canvas */}
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="relative w-full max-w-4xl">
          <svg width="100%" height="600" viewBox="0 0 800 600" className="overflow-visible select-none">
            {/* center launch button */}
            <g className={launchAnimation ? 'animate-pulse' : ''}>
              <circle
                cx={CENTER_X}
                cy={CENTER_Y}
                r={LAUNCH_R}
                fill={canLaunch() ? '#22c55e' : '#27272a'}
                stroke={canLaunch() ? '#16a34a' : '#3f3f46'}
                strokeWidth="4"
                className={canLaunch() ? 'cursor-pointer' : 'cursor-not-allowed'}
                onClick={canLaunch() ? handleLaunch : undefined}
              />
              <text
                x={CENTER_X}
                y={CENTER_Y - 6}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={canLaunch() ? 'black' : '#a1a1aa'}
                fontSize="32"
                fontWeight="900"
                style={{ letterSpacing: '0.5px' }}
              >
                LAUNCH
              </text>
              <text
                x={CENTER_X}
                y={CENTER_Y + 22}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={canLaunch() ? 'black' : '#a1a1aa'}
                fontSize="18"
                fontWeight="600"
              >
                {currentGenre.charAt(0).toUpperCase() + currentGenre.slice(1)}
              </text>
            </g>

            {/* description ring (stroke width ties to geometry) */}
            <circle
              cx={CENTER_X}
              cy={CENTER_Y}
              r={TEXT_RING_R}
              fill="none"
              stroke="#0b1220"
              strokeOpacity="0.7"
              strokeWidth={TEXT_RING_STROKE}
            />

            {/* orbiting description text */}
            <defs>
              <path
                id="descPath"
                d={`
                  M ${CENTER_X} ${CENTER_Y}
                  m -${TEXT_RING_R}, 0
                  a ${TEXT_RING_R},${TEXT_RING_R} 0 1,1 ${TEXT_RING_R * 2},0
                  a ${TEXT_RING_R},${TEXT_RING_R} 0 1,1 -${TEXT_RING_R * 2},0
                `}
              />
            </defs>

            <g style={{ transformOrigin: `${CENTER_X}px ${CENTER_Y}px`, animation: `orbit ${TICKER_MS}ms linear infinite` }}>
              <text fontSize="16" fill="#b7f7cf" fontWeight="700" letterSpacing="0.5px">
                <textPath href="#descPath" startOffset="0%">
                  {genreDescription}
                </textPath>
              </text>
            </g>

            {/* nodes: children or seeds */}
            {items.map(({ item, cx, cy }, idx) => {
              const isSeed = !children.length;
              const r = isSeed ? seedNodeR : genreNodeR;
              const key = isSeed ? item.uri : item.key;
              const title = isSeed ? item.artist : item.key;
              const subtitle = isSeed ? item.name : '';

              return (
                <g
                  key={key}
                  onClick={() => (isSeed ? handleTrackClick(item) : handleGenreClick(item.key))}
                  className="cursor-pointer"
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="#18181b"
                    stroke="#22c55e"
                    strokeWidth="3"
                    className="hover:fill-zinc-800 transition-all"
                  />
                  <text
                    x={cx}
                    y={subtitle ? cy - 8 : cy + 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={isSeed ? 13 : 14}
                    fontWeight="700"
                  >
                    {title.length > 20 ? title.slice(0, 20) + '…' : title}
                  </text>
                  {subtitle && (
                    <text
                      x={cx}
                      y={cy + 14}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#a1a1aa"
                      fontSize="11"
                    >
                      {subtitle.length > 22 ? subtitle.slice(0, 22) + '…' : subtitle}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Difficulty selector UI — commented out as requested */}
        {/*
        <div className="mt-8">
          <div className="flex items-center justify-center gap-3">
            {['easy','medium','hard'].map(level => (
              <button
                key={level}
                onClick={() => setDifficulty(level)}
                className={`px-8 py-3 rounded-lg font-bold transition-all ${
                  difficulty === level
                    ? 'bg-green-500 text-black scale-110'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:scale-105'
                }`}
              >
                {level[0].toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>
        */}
      </div>

      {/* ticker animation keyframes */}
      <style>{`
        @keyframes orbit {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}


// function getGenreDescription(genreName) {
//   const map = {
//   // Roots
//     rock: 'Guitars forward, live drum feel, verse–chorus lift. Expect riffs, backbeat, and amp grit.',
//     electronic: 'Synths, drum machines, and grid-tight rhythm. Texture and pulse drive the form.',
//     'hip hop': 'Drum patterns and vocal rhythm lead. Kicks, snares, and flow sit in the pocket.',
//     'r&b': 'Smooth vocals over pocketed drums and warm chords. Melody glides and bass sings.',
//     soul: 'Powerful vocals, rich harmony, and groove-led rhythm sections.',
//     funk: 'Syncopated bass, clipped guitars, tight drums. The pocket is the hook.',
//     jazz: 'Improvisation, extended harmony, acoustic or electric ensembles, swing or straight.',
//     country: 'Story-first songs, steady backbeat, twang color. Choruses land clean.',
//     folk: 'Acoustic instruments, intimate vocals, lyric focus, simple harmonic movement.',
//     latin: 'Percussive rhythm languages, clave patterns, dance forms, bright hooks.',
//     reggae: 'Off-beat skank guitar, deep bass, laid-back groove, spacious mix.',
//     afrobeat: 'Polyrhythms, long vamps, horn punches, call and response.',
//     classical: 'Orchestral or chamber instruments, formal structures, dynamic range.',
//     experimental: 'Form and timbre as a playground. Expect rule-bending structures.',

//     // Rock subs
//     metal: 'High-gain guitars, aggressive drums, extended techniques, darker harmony.',
//     'thrash metal': 'Fast tempos, palm-muted riffs, double kick, shouted vocals.',
//     'doom metal': 'Slow, heavy, sustained chords, bleak atmosphere.',
//     'sludge metal': 'Thick, dirty tones, hardcore energy, dragging groove.',
//     'black metal': 'Tremolo picking, blast beats, raw textures, icy harmony.',
//     'death metal': 'Low tunings, complex riffing, growled vocals, relentless drums.',
//     'progressive metal': 'Odd meters, long forms, technical playing, melodic complexity.',
//     'nu metal': 'Down-tuned riffs, hip hop influence, simple grooves, angst-driven hooks.',
//     punk: 'Fast, raw, direct. Power chords, shouted hooks, minimal ornament.',
//     'post-punk': 'Angular guitars, groove-led bass, moody vocals, experimental edges.',
//     emo: 'Melodic guitars, dynamic swings, confessional vocals.',
//     'alternative rock': 'Guitar rock with left-field choices, off-center hooks.',
//     'indie rock': 'Looser feel, character vocals, textural guitars, DIY polish.',
//     shoegaze: 'Wall of guitars, heavy reverb, buried vocals, floating harmony.',
//     grunge: 'Thick distortion, mid-tempo grind, dynamic quiet–loud forms.',
//     'post-rock': 'Crescendo architecture, repetitive motifs, timbre-as-melody.',
//     'classic rock': 'Blues-based riffs, big choruses, radio-ready structures.',
//     'garage rock': 'Raw takes, energetic tempos, simple changes, live feel.',
//     'psychedelic rock': 'Extended jams, swirling effects, modal or droning harmony.',
//     'hard rock': 'Big amps, tight grooves, soaring vocals, riff-forward writing.',

//     // Electronic subs
//     house: 'Four-on-the-floor, warm bass, looped chords, long builds.',
//     'deep house': 'Subtle grooves, jazzy chords, smooth vocals, late-night feel.',
//     'tech house': 'Minimal harmony, punchy drums, techy textures, steady drive.',
//     'progressive house': 'Melodic arcs, evolving layers, long tension and release.',
//     'acid house': 'Squelchy 303 lines, repetitive patterns, hypnotic drums.',
//     techno: 'Machine pulse and evolving timbre. Functional rhythm for movement.',
//     'minimal techno': 'Sparse elements, micro-variation, surgical low end.',
//     trance: 'Big melodic leads, saw stacks, euphoric drops, long phrases.',
//     'progressive trance': 'Smoother leads, deeper builds, patient phrasing.',
//     psytrance: 'Psychedelic textures, fast tempos, rolling basslines.',
//     'drum and bass': 'Fast breakbeats, deep subs, chopped samples, fierce momentum.',
//     jungle: 'Amen breaks, ragga influence, raw sampling, swingy chaos.',
//     dubstep: 'Half-time lurch, wobble bass, stark space between hits.',
//     brostep: 'Maximalist sound design, heavy drops, midrange aggression.',
//     'melodic dubstep': 'Lyrical leads, cinematic chords, gentle drops.',
//     edm: 'Festival-scale builds, big drops, high-impact hooks.',
//     electro: 'Syncopated synth bass, robotic hits, tight grooves.',
//     synthwave: 'Retro synth tones, 80s drum machines, neon mood.',
//     ambient: 'Beatless or soft pulse, long sustains, atmosphere first.',

//     // Hip hop subs
//     rap: 'Bars over drums, cadence and rhyme carry the hook.',
//     trap: 'Fast hats, 808 subs, sparse melodies, minor-key pads.',
//     drill: 'Sliding 808s, triplet hats, gritty narratives.',
//     'gangsta rap': 'Street narratives, heavy low end, blunt delivery.',
//     'boom bap': 'Dusty breaks, chopped samples, head-nod swing.',
//     'east coast hip hop': 'Sample-heavy beats, lyrical density, tight snares.',
//     'west coast rap': 'Laid-back swing, sine bass, talkbox or synth color.',
//     'southern hip hop': 'Club bounce, sub pressure, chant hooks.',
//     'conscious hip hop': 'Lyric focus, social commentary, soulful backdrops.',
//     'alternative hip hop': 'Left-field production, genre blends, experimental forms.',
//     'underground hip hop': 'Lo-fi grit, crate-dig aesthetics, bar focus.',
//     phonk: 'Memphis tape grit, cowbells, distorted 808s.',
//     'cloud rap': 'Airy pads, reverb-washed drums, floaty vocals.',

//     // R&B subs
//     'contemporary r&b': 'Modern drums, glossy layers, melisma and tight stacks.',
//     'neo soul': 'Organic grooves, jazz harmony, intimate delivery.',
//     'quiet storm': 'Slow tempo, lush arrangements, late-night mood.',

//     // Soul subs
//     motown: 'Tight rhythm section, string sweetening, call-and-response hooks.',
//     disco: 'Four-on-the-floor, octave bass, string lines, party focus.',

//     // Funk subs
//     'funk rock': 'Rock guitars over syncopated funk rhythm sections.',
//     boogie: 'Early 80s drum machines, slap bass, glossy synths.',

//     // Jazz subs
//     bebop: 'Fast tempos, complex changes, agile lines.',
//     'cool jazz': 'Relaxed tempos, soft timbre, arranged interplay.',
//     'hard bop': 'Blues influence, punchy drums, soulful heads.',
//     swing: 'Walking bass, ride cymbal swing, horn sections.',
//     'jazz fusion': 'Electric instruments, rock energy, odd meters.',
//     'smooth jazz': 'Polished tone, gentle grooves, melody first.',
//     'vocal jazz': 'Standards, close mic, phrasing and nuance.',
//     'nu jazz': 'Electronic textures with jazz harmony and rhythm.',
//     'avant-garde jazz': 'Free rhythm, extended techniques, open forms.',

//     // Country subs
//     'classic country': 'Two-step rhythms, pedal steel, narrative lyrics.',
//     'outlaw country': 'Rough edges, bar band swing, anti-Nashville stance.',
//     bluegrass: 'Acoustic speed, banjo and fiddle leads, tight harmonies.',
//     'country rock': 'Rock backbeat, twang guitars, road-song feel.',
//     'southern rock': 'Dual leads, blues harmony, swaggering grooves.',
//     'roots rock': 'American folk and country influences in a rock frame.',

//     // Folk subs
//     americana: 'Roots palette, lyrical storytelling, band-in-a-room feel.',

//     // Latin subs
//     reggaeton: 'Dembow groove, synth hooks, call-and-response vocals.',
//     'latin pop': 'Bright melodies, modern production, crossover hooks.',
//     salsa: 'Clave-driven percussion, horn stabs, montuno piano.',
//     bachata: 'Guitar arpeggios, romantic vocals, syncopated step.',
//     cumbia: 'Shuffle feel, accordion or synth leads, communal dance.',
//     merengue: 'Fast two-beat, horns and tambora, party energy.',
//     tropical: 'Caribbean rhythm blends, bright percussion, festive tone.',
//     mambo: 'Big band horns, syncopated riffs, dance-floor drive.',
//     'bossa nova': 'Soft swing, jazz chords on nylon guitar, intimate vocals.',

//     // Reggae subs
//     dub: 'Stripped mixes, heavy delay and reverb, bass as lead.',
//     ska: 'Upstroke guitars on the off-beat, brisk tempos, horn lines.',
//     dancehall: 'Digital riddims, toasting vocals, club focus.',

//     // Afrobeat subs
//     afropop: 'Modern pop forms with African rhythm and melody shapes.',
//     amapiano: 'Log drum bass, relaxed tempo, piano riffs, SA groove.',
//     soca: 'Carnival energy, bright percussion, chantable hooks.',

//     // Classical subs
//     baroque: 'Figured bass, counterpoint, ornate lines.',
//     romantic: 'Expansive themes, rich harmony, dramatic dynamics.',
//     'modern classical': '20th-century language, new textures and forms.',
//     soundtrack: 'Cinematic themes, leitmotifs, orchestration for scene.',
//     'new age': 'Meditative textures, slow evolution, soothing harmonies.',
//     minimalism: 'Repetition, phase shifts, gradual change.',
//     drone: 'Sustained tones, harmonic stasis, focus on timbre.',

//     // Experimental subs
//     'avant-garde': 'Rule-breaking form, extended techniques, concept focus.',
//     noise: 'Distortion, feedback, texture as primary material.',
//     glitch: 'Digital artifacts as rhythm and color, micro-edits.',
//     'lo-fi': 'Intentional roughness, tape hiss, intimate immediacy.',
//   };
//   const key = String(genreName || '').toLowerCase();
//   return map[key] || 'A distinct palette of rhythm, timbre, and structure. Listen for the signature groove and texture choices.';
// }
