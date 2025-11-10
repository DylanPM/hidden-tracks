const descriptions = {
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
  metal: 'High-gain guitars, aggressive drums, extended techniques, darker harmony.',
  punk: 'Fast, raw, direct. Power chords, shouted hooks, minimal ornament.',
  house: 'Four-on-the-floor, warm bass, looped chords, long builds.',
  techno: 'Machine pulse and evolving timbre. Functional rhythm for movement.',
  trance: 'Big melodic leads, saw stacks, euphoric drops, long phrases.',
  dubstep: 'Half-time lurch, wobble bass, stark space between hits.',
  rap: 'Bars over drums, cadence and rhyme carry the hook.',
  trap: 'Fast hats, 808 subs, sparse melodies, minor-key pads.',
  'cool jazz': 'Relaxed tempos, lighter tone, contrapuntal arrangements. West Coast restraint.',
  'nu jazz': 'Electronic textures meet jazz harmony. Broken beats and ambient drift.',
  bebop: 'Fast tempos, complex changes, virtuosic solos. Head-solo-head form.',
  'hard bop': 'Gospel and blues inflections added to bebop language. Groovier, earthier.',
  'smooth jazz': 'Radio-friendly melodies, steady grooves, polished production. Easy flow.',
  'jazz fusion': 'Electric instruments, rock/funk energy, extended soloing over vamps.',
  swing: 'Big band arrangements, danceable pulse, riff-based melodies.',
  'bossa nova': 'Samba rhythms slowed, whisper-close vocals, jazz chords, gentle movement.',
  'alternative rock': 'Indie spirit, wider palette than classic rock. Hooks with bite.',
  'indie rock': 'DIY ethos, melodic focus, jangly guitars, earnest delivery.',
  shoegaze: 'Wall-of-sound guitars, buried vocals, texture over clarity, dreamy wash.',
  'classic rock': 'Blues-based riffs, anthem choruses, guitar solos. Stadium-ready.',
  'garage rock': 'Raw, lo-fi, energetic. Three chords and attitude.',
  'psychedelic rock': 'Effects-heavy, extended jams, modal harmony, consciousness expansion.',
  'hard rock': 'Louder, heavier blues rock. Big riffs, powerful vocals.',
  'roots rock': 'Back to basics, Americana influence, organic feel, honest lyrics.',
  'southern rock': 'Blues and country blend, dual guitars, regional pride.',
  'stoner metal': 'Downtuned, fuzzy, groove-heavy. Desert rock meets Black Sabbath.',
  'death metal': 'Extreme vocals, blast beats, complex riffing, dark themes.',
  'nu metal': 'Hip-hop rhythms, downtuned guitars, angst-driven vocals.',
  emo: 'Emotional lyrics, dynamic shifts, melodic hardcore roots, confessional tone.',
  'deep house': 'Warm, soulful, subtle. Jazz and soul samples over steady kick.',
  'tech house': 'Minimal, techy, stripped-back. Focus on groove and rhythm.',
  'progressive house': 'Long builds, layered melodies, journey-focused arrangements.',
  'drum and bass': 'Breakbeats at 170+ BPM, heavy bass, jungle energy.',
  'uk garage': '2-step rhythms, shuffled hi-hats, bass pressure, nocturnal vibe.',
  synthwave: 'Retro-futuristic, 80s nostalgia, analog synths, neon aesthetics.',
  ambient: 'Atmospheric, minimal rhythm, sound design focus, immersive space.',
  pop: 'Hook-first songwriting, radio-ready production, universal appeal.',
  'dance pop': 'Four-on-floor beats, catchy vocals, club-ready energy.',
  'indie pop': 'Jangly, melodic, DIY charm, lighter touch than indie rock.',
  electropop: 'Synth-driven pop, bright production, electronic textures.',
  drill: 'Dark, aggressive, sliding 808s, street narratives, ominous atmosphere.',
  'gangsta rap': 'Hard-hitting beats, street life stories, West Coast G-funk or East Coast boom-bap.',
  'east coast hip hop': 'Sample-heavy, boom-bap drums, lyrical focus, NYC swagger.',
  'west coast rap': 'G-funk synths, laid-back grooves, melodic bass, California sun.',
  'southern hip hop': 'Crunk energy or chopped & screwed, regional slang, 808 bass.',
  'conscious hip hop': 'Socially aware lyrics, jazz/soul samples, message-driven.',
  'underground hip hop': 'Independent, experimental, lyrical depth, anti-commercial.',
  phonk: 'Memphis rap samples, dark aesthetic, cowbell hits, lo-fi crunch.',
  'cloud rap': 'Ethereal beats, Auto-Tuned flows, spacious mix, dreamy atmosphere.',
  disco: 'Four-on-the-floor, string sections, funk bass, dance floor euphoria.',
  motown: 'Polished pop-soul, tambourine backbeat, call-response vocals, Detroit sound.',
  'neo soul': 'Vintage soul modernized, live instrumentation, introspective lyrics.',
  'quiet storm': 'Late-night smooth R&B, mellow grooves, romantic themes.',
  reggaeton: 'Dembow rhythm, Spanish vocals, reggae/dancehall roots, Latin fusion.',
  dancehall: 'Digital riddims, DJ toasts, upbeat energy, Jamaican patois.',
  ska: 'Upstroke guitars, walking bass, horn sections, precursor to reggae.',
  dub: 'Remix culture, heavy reverb/delay, bass emphasis, stripped-down versions.',
  salsa: 'Clave-driven, horn sections, piano montunos, Afro-Cuban roots.',
  cumbia: 'Colombian rhythms, accordion or synths, dancing groove, infectious pulse.',
  mambo: 'Big band Latin jazz, syncopated brass, dance-floor energy.',
  merengue: 'Fast 2/4 rhythm, accordion, tambora drums, Dominican dance music.',
  'latin pop': 'Pop structures with Latin rhythms, crossover appeal, Spanish or bilingual.',
  tropical: 'Caribbean and Latin dance rhythms, bright production, summer vibes.',
  afropop: 'African rhythms meet pop production, joyful energy, pan-African fusion.',
  amapiano: 'South African house, log drum bass, jazzy keys, laid-back groove.',
  'modern classical': 'Contemporary composition, extended techniques, film score aesthetics.',
  romantic: 'Emotional expression, rich orchestration, 19th century European tradition.',
  'classic country': 'Honky-tonk piano, steel guitar, traditional songwriting, Nashville sound.',
  'country rock': 'Electric guitars, rock energy, country storytelling, Southern California vibe.',
  'outlaw country': 'Anti-Nashville, rough edges, rebellious spirit, Willie & Waylon.',
  blues: 'Twelve-bar form, call and response, bent notes, emotional catharsis.',
  bluegrass: 'Acoustic strings, high lonesome vocals, virtuosic picking, Appalachian roots.',
  'indie folk': 'Acoustic intimacy, poetic lyrics, folk traditions modernized, lo-fi warmth.',
};

const tooLong = [];
const good = [];

Object.entries(descriptions).forEach(([name, desc]) => {
  if (desc.length > 65) {
    tooLong.push({ name, desc, len: desc.length });
  } else {
    good.push({ name, len: desc.length });
  }
});

console.log(`✅ ${good.length} descriptions are 65 chars or less`);
console.log(`❌ ${tooLong.length} descriptions need rewriting:\n`);

tooLong.sort((a, b) => b.len - a.len);
tooLong.forEach(({ name, desc, len }) => {
  console.log(`${name} (${len} chars):`);
  console.log(`  "${desc}"`);
  console.log();
});
