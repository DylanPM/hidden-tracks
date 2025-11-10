const fs = require('fs');
const m = require('./public/genre_constellation_manifest.json');

function getAllSeeds(node) {
  let seeds = [];
  if (node.seeds) seeds.push(...node.seeds);
  if (node.subgenres) {
    Object.values(node.subgenres).forEach(sub => seeds.push(...getAllSeeds(sub)));
  }
  return seeds;
}

const allSeeds = [];
Object.keys(m).forEach(k => {
  if (k === 'global' || k === 'build') return;
  allSeeds.push(...getAllSeeds(m[k]));
});

const missing = [];
const checked = new Set();

allSeeds.forEach(seed => {
  if (checked.has(seed.filename)) return;
  checked.add(seed.filename);

  const path = `./public/profiles/${seed.filename}`;
  if (!fs.existsSync(path)) {
    missing.push({ filename: seed.filename, artist: seed.artist, name: seed.name });
  }
});

console.log(`Missing ${missing.length} profile files:\n`);
missing.forEach(m => {
  console.log(`  ${m.filename}`);
  console.log(`    ${m.artist} - ${m.name}`);
});
