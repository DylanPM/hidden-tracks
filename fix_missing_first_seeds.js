const fs = require('fs');
const m = require('./public/genre_constellation_manifest.json');

// Move ryan-bingham to first position in outlaw country
const outlawSeeds = m.country.subgenres['outlaw country'].seeds;
const ryanSeed = outlawSeeds.find(s => s.filename === 'ryan-bingham_southside-of-heaven.json');
const otherOutlaw = outlawSeeds.filter(s => s.filename !== 'ryan-bingham_southside-of-heaven.json');
m.country.subgenres['outlaw country'].seeds = [ryanSeed, ...otherOutlaw];

// Move charlotte-day-wilson to first position in contemporary r&b
const rbSeeds = m['r&b / soul / funk'].subgenres['r&b'].subgenres['contemporary r&b'].seeds;
const charlotteSeed = rbSeeds.find(s => s.filename === 'charlotte-day-wilson_work.json');
const otherRb = rbSeeds.filter(s => s.filename !== 'charlotte-day-wilson_work.json');
m['r&b / soul / funk'].subgenres['r&b'].subgenres['contemporary r&b'].seeds = [charlotteSeed, ...otherRb];

// Save
fs.writeFileSync('./public/genre_constellation_manifest.json', JSON.stringify(m, null, 2));

console.log('✅ Fixed first seeds for:');
console.log('  - outlaw country: now', m.country.subgenres['outlaw country'].seeds[0].filename);
console.log('  - contemporary r&b: now', m['r&b / soul / funk'].subgenres['r&b'].subgenres['contemporary r&b'].seeds[0].filename);
