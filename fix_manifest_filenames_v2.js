/**
 * Fix Manifest Filenames v2
 *
 * The actual file format is: slugified-artist_slugified-song.json
 * We need to rebuild filenames using the artist and name fields
 */

const fs = require('fs');

// Load manifest
const manifestPath = './public/genre_constellation_manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Simple slugify function (lowercase, replace spaces/special chars with hyphens)
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/['']/g, '') // Remove apostrophes
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

let fixCount = 0;
let alreadyCorrect = 0;

// Recursively fix filenames in seeds
function fixNode(node) {
  if (node.seeds && Array.isArray(node.seeds)) {
    node.seeds.forEach(seed => {
      if (seed.artist && seed.name) {
        const artistSlug = slugify(seed.artist);
        const nameSlug = slugify(seed.name);
        const correctFilename = `${artistSlug}_${nameSlug}.json`;

        if (seed.filename !== correctFilename) {
          console.log(`Fix: ${seed.filename || 'MISSING'} -> ${correctFilename}`);
          seed.filename = correctFilename;
          fixCount++;
        } else {
          alreadyCorrect++;
        }
      }
    });
  }

  if (node.subgenres) {
    Object.values(node.subgenres).forEach(subgenre => {
      fixNode(subgenre);
    });
  }
}

// Process all root genres
Object.keys(manifest).forEach(key => {
  if (key === 'global' || key === 'build') return;
  fixNode(manifest[key]);
});

// Save updated manifest
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`\n✅ Fixed ${fixCount} filenames`);
console.log(`✓  ${alreadyCorrect} filenames were already correct`);
