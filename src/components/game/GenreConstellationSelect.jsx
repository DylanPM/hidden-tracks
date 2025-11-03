import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';

/**
 * GenreConstellationSelect
 * Interactive genre tree. Pick a genre or a seed track, then Launch.
 */
export function GenreConstellationSelect({ onLaunch }) {
  // manifest load
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // intro banner
  const [showIntro, setShowIntro] = useState(true);
  useEffect(() => {
    const seen = sessionStorage.getItem('ht_seen_intro') === '1';
    if (seen) setShowIntro(false);
  }, []);
  const dismissIntro = () => {
    sessionStorage.setItem('ht_seen_intro', '1');
    setShowIntro(false);
  };

  // navigation
  const [navigationPath, setNavigationPath] = useState([]); // e.g. ['rock', 'metal']
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [launchAnimation, setLaunchAnimation] = useState(false);

  // keep API the same, but difficulty UI is commented out below. Default to medium.
  const [difficulty, setDifficulty] = useState('medium');

  // -------- helpers ----------
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


  // load manifest on mount
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

  // current node utils
  const getCurrentNode = () => {
    if (!manifest) return null;
    if (navigationPath.length === 0) return manifest;
    let node = manifest;
    for (const key of navigationPath) {
      if (node[key]) node = node[key];
      else if (node.subgenres && node.subgenres[key]) node = node.subgenres[key];
    }
    return node;
  };

  const getChildren = () => {
    const node = getCurrentNode();
    if (!node) return [];
    const children = [];
    Object.keys(node).forEach(key => {
      if (key !== 'seeds' && key !== 'subgenres' && typeof node[key] === 'object') {
        children.push({ key, type: 'genre', data: node[key] });
      }
    });
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

  // click handlers
  const handleGenreClick = (key) => {
    setNavigationPath(prev => [...prev, key]);
    setSelectedTrack(null);
    setTimeout(() => {
      setLaunchAnimation(true);
      setTimeout(() => setLaunchAnimation(false), 600);
    }, 100);
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

  const canLaunch = () => getSeeds().length > 0;

  // loading and error states
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

  // derived view data
  const children = getChildren();
  const seeds = getSeeds();
  const currentGenre = navigationPath.length ? navigationPath[navigationPath.length - 1] : 'a genre';
  const genreDescription = `${getGenreDescription(currentGenre)} • ${getGenreDescription(currentGenre)}`;

  // -------- geometry constants for layout --------
  const CENTER_X = 400;
  const CENTER_Y = 300;
  const LAUNCH_R = 100;

  // ring closer to center per your note
  const TEXT_RING_R = LAUNCH_R + 18;

  // node radii
  const count = children.length > 0 ? children.length : seeds.length;
  const genreNodeR = children.length > 0 ? Math.max(45, 85 - count * 2) : 70;
  const seedNodeR = seeds.length > 0 ? Math.max(55, 95 - count * 2) : 60;

  // make nodes tangent to text ring
  const childrenOrbitR = TEXT_RING_R + genreNodeR + 0.5;
  const seedsOrbitR = TEXT_RING_R + seedNodeR + 0.5;
  const outerOrbitR = children.length > 0 ? childrenOrbitR + genreNodeR : seedsOrbitR + seedNodeR;

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative font-spotify">
      {showIntro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70">
          <div className="w-full max-w-xl rounded-2xl bg-zinc-900 shadow-xl border border-zinc-800 animate-fadeIn">
            <div className="p-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-3">Welcome to Hidden Tracks</h2>
              <p className="text-zinc-300 mb-2">
                See how recommendation systems “think.” Explore the logic behind algorithmic playlists and
                guess the other songs the machine would queue up next.
              </p>
              <p className="text-zinc-400 mb-4">
                Pick a genre, sub genre, or a song you love, then launch your mix.
              </p>
              <p className="text-zinc-500 text-xs mb-6">
                Built with the help of Anthropic’s Claude.
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

      {/* Back zone ends tangentially at outermost node edge */}
      {navigationPath.length > 0 && (
        <button
          onClick={handleBack}
          style={{ width: `${CENTER_X - outerOrbitR}px` }}
          className="fixed left-0 top-0 h-full 
                     bg-gradient-to-r from-green-900/70 via-green-900/30 to-transparent
                     flex items-center justify-start pl-10
                     hover:from-green-700/70 hover:via-green-700/40
                     transition-all duration-300 z-20 group"
        >
          <div className="flex flex-col items-center gap-3">
            <ChevronLeft
              size={80}
              className="text-green-400 group-hover:text-green-300 transition-colors animate-pulse"
            />
            <span className="text-green-400 group-hover:text-green-300 text-sm font-bold rotate-[-90deg] tracking-wider">
              BACK
            </span>
          </div>
        </button>
      )}

      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="relative w-full max-w-4xl">
          <svg width="100%" height="600" viewBox="0 0 800 600" className="overflow-visible">
            {/* Launch button */}
            <g className={launchAnimation ? 'animate-bounce-subtle' : ''}>
              <circle
                cx={CENTER_X}
                cy={CENTER_Y}
                r={LAUNCH_R}
                fill={canLaunch() ? '#22c55e' : '#27272a'}
                stroke={canLaunch() ? '#16a34a' : '#3f3f46'}
                strokeWidth="4"
                className={canLaunch() ? 'cursor-pointer transition-all' : 'cursor-not-allowed transition-all'}
                onClick={canLaunch() ? handleLaunch : undefined}
                style={{
                  transform: launchAnimation ? 'scale(1.1)' : 'scale(1)',
                  transformOrigin: `${CENTER_X}px ${CENTER_Y}px`,
                  transition: 'transform 0.3s ease-out'
                }}
              />
              <text
                x={CENTER_X}
                y={CENTER_Y - 10}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={canLaunch() ? 'black' : '#a1a1aa'}
                fontSize="28"
                fontWeight="800"
                className="pointer-events-none uppercase"
              >
                LAUNCH
              </text>
              <text
                x={CENTER_X}
                y={CENTER_Y + 18}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={canLaunch() ? 'black' : '#a1a1aa'}
                fontSize="16"
                className="pointer-events-none capitalize"
              >
                {currentGenre}
              </text>
            </g>

            {/* Text ring path closer to center */}
            <path
              id="ringPath"
              d={`M ${CENTER_X} ${CENTER_Y} m -${TEXT_RING_R},0 a ${TEXT_RING_R},${TEXT_RING_R} 0 1,1 ${TEXT_RING_R*2},0 a ${TEXT_RING_R},${TEXT_RING_R} 0 1,1 -${TEXT_RING_R*2},0`}
              fill="none"
              stroke="#1f2937"
              strokeWidth="2"
            />

            {/* Animated ticker */}
            <text className="fill-green-200 font-spotify" style={{ fontSize: 15, letterSpacing: 0.6 }}>
              <textPath href="#ringPath" startOffset="0%">
                <animate attributeName="startOffset" from="0%" to="100%" dur="13.3s" repeatCount="indefinite" />
                {`${genreDescription}  •  ${genreDescription}`}
              </textPath>
            </text>

            {/* Genre or subgenre orbit */}
            {children.length > 0 &&
              children.map((child, index) => {
                const angle = (index / children.length) * 2 * Math.PI - Math.PI / 2;
                const cx = CENTER_X + Math.cos(angle) * childrenOrbitR;
                const cy = CENTER_Y + Math.sin(angle) * childrenOrbitR;

                const words = child.key.split(' ');
                const lines = [];
                let currentLine = '';
                words.forEach(w => {
                  const test = (currentLine ? `${currentLine} ${w}` : w).trim();
                  if (test.length > 12) {
                    if (currentLine) lines.push(currentLine);
                    currentLine = w;
                  } else {
                    currentLine = test;
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

            {/* Leaf seeds orbit */}
            {seeds.length > 0 &&
              children.length === 0 &&
              seeds.map((track, index) => {
                const angle = (index / seeds.length) * 2 * Math.PI - Math.PI / 2;
                const cx = CENTER_X + Math.cos(angle) * seedsOrbitR;
                const cy = CENTER_Y + Math.sin(angle) * seedsOrbitR;
                const isSelected = selectedTrack?.uri === track.uri;

                const artistText =
                  track.artist.length > 16 ? track.artist.slice(0, 16) + '…' : track.artist;
                const songText = track.name.length > 18 ? track.name.slice(0, 18) + '…' : track.name;

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
                      fill={isSelected ? '#22c55e' : '#18181b'}
                      stroke="#22c55e"
                      strokeWidth={isSelected ? '4' : '3'}
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

        {/* Info below canvas */}
        {canLaunch() && (
          <div className="mt-8 text-center animate-fade-in">
            <div className="text-2xl font-bold mb-2">
              Launch {currentGenre.charAt(0).toUpperCase() + currentGenre.slice(1)} Puzzle
            </div>
            <div className="text-zinc-300 text-lg mb-3 italic">
              {getGenreDescription(currentGenre)}
            </div>

            {/* Difficulty selector temporarily hidden */}
            {/*
            <div className="flex items-center justify-center gap-3">
              {['easy', 'medium', 'hard'].map(level => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={`px-8 py-3 rounded-lg font-bold transition-all ${
                    difficulty === level
                      ? 'bg-green-500 text-black scale-110'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:scale-105'
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
            */}
          </div>
        )}
      </div>
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
