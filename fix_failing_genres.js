const fs = require('fs');
const m = require('./public/genre_constellation_manifest.json');

// Fix techno - move moderat to first
const technoSeeds = m.electronic.subgenres.techno.seeds;
const moderatSeed = technoSeeds.find(s => s.filename === 'moderat_a-new-error.json');
const otherTechno = technoSeeds.filter(s => s.filename !== 'moderat_a-new-error.json');
m.electronic.subgenres.techno.seeds = [moderatSeed, ...otherTechno];

// Fix quiet storm - move al-green to first
const qsSeeds = m['r&b / soul / funk'].subgenres['r&b'].subgenres['quiet storm'].seeds;
const alGreenSeed = qsSeeds.find(s => s.filename === 'al-green_love-and-happiness.json');
const otherQs = qsSeeds.filter(s => s.filename !== 'al-green_love-and-happiness.json');
m['r&b / soul / funk'].subgenres['r&b'].subgenres['quiet storm'].seeds = [alGreenSeed, ...otherQs];

// Fix latin - use Classic Dance seed for root
const classicDanceSeed = m.latin.subgenres['Classic Dance'].seeds[0];
m.latin.seeds = [classicDanceSeed, ...m.latin.seeds];

// Save
fs.writeFileSync('./public/genre_constellation_manifest.json', JSON.stringify(m, null, 2));

console.log('✅ Fixed failing genres:');
console.log('  - techno: now', m.electronic.subgenres.techno.seeds[0].filename);
console.log('  - quiet storm: now', m['r&b / soul / funk'].subgenres['r&b'].subgenres['quiet storm'].seeds[0].filename);
console.log('  - latin: now', m.latin.seeds[0].filename);
