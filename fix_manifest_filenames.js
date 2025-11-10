/**
 * Fix Manifest Filenames
 *
 * The manifest has filenames like: artist-name-song-name.json (all hyphens)
 * But actual files on disk are:     artist-name_song-name.json (underscore separator)
 *
 * This script converts the last hyphen before .json to an underscore
 */

const fs = require('fs');

// Load manifest
const manifestPath = './public/genre_constellation_manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let fixCount = 0;

// Recursively fix filenames in seeds
function fixNode(node) {
  if (node.seeds && Array.isArray(node.seeds)) {
    node.seeds.forEach(seed => {
      if (seed.filename) {
        const oldFilename = seed.filename;

        // Find the last hyphen before .json and replace with underscore
        // Example: "a-perfect-circle-judith.json" -> "a-perfect-circle_judith.json"
        const newFilename = oldFilename.replace(/-([^-]+)\.json$/, '_$1.json');

        if (oldFilename !== newFilename) {
          seed.filename = newFilename;
          fixCount++;
          console.log(`Fixed: ${oldFilename} -> ${newFilename}`);
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

console.log(`\n✅ Fixed ${fixCount} filenames in manifest`);
