const fs = require('fs');
const m = require('./public/genre_constellation_manifest.json');

function auditNode(node, path = []) {
  const results = [];

  if (node.seeds && node.seeds.length > 0) {
    const firstSeed = node.seeds[0];
    const filePath = `./public/profiles/${firstSeed.filename}`;
    const exists = fs.existsSync(filePath);

    results.push({
      path: path.join(' > '),
      filename: firstSeed.filename,
      exists,
      artist: firstSeed.artist,
      name: firstSeed.name
    });
  }

  if (node.subgenres) {
    Object.keys(node.subgenres).forEach(key => {
      results.push(...auditNode(node.subgenres[key], [...path, key]));
    });
  }

  return results;
}

const allResults = [];
Object.keys(m).forEach(key => {
  if (key === 'global' || key === 'build') return;
  allResults.push(...auditNode(m[key], [key]));
});

const missing = allResults.filter(r => !r.exists);
const working = allResults.filter(r => r.exists);

console.log(`\n📊 AUDIT RESULTS:`);
console.log(`✅ ${working.length} genres can launch`);
console.log(`❌ ${missing.length} genres CANNOT launch\n`);

if (missing.length > 0) {
  console.log(`❌ GENRES THAT CANNOT LAUNCH:\n`);
  missing.forEach(m => {
    console.log(`  ${m.path}`);
    console.log(`    Missing: ${m.filename}`);
    console.log(`    Track: ${m.artist} - ${m.name}\n`);
  });
}
