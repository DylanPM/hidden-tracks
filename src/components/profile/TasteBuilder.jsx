// import React from 'react';
// import { GENRE_TREE } from '../../constants/gameConfig';
// import { createTasteProfile } from '../../constants/profiles';

// export function TasteBuilder({ round, path, onPick }) {
//   const getCurrentOptions = () => {
//     if (round === 1) {
//       return GENRE_TREE.round1.options;
//     } else if (round === 2) {
//       const lastPick = path[path.length - 1];
//       return GENRE_TREE.round2[lastPick]?.options || GENRE_TREE.round1.options;
//     } else if (round === 3) {
//       return GENRE_TREE.round3.options;
//     } else if (round === 4) {
//       const lastPick = path[path.length - 1];
//       return GENRE_TREE.round4[lastPick]?.options || GENRE_TREE.round3.options;
//     } else if (round === 5) {
//       return GENRE_TREE.round5.options;
//     }
//     return [];
//   };

//   const getPrompt = () => {
//     if (round === 1) return GENRE_TREE.round1.prompt;
//     else if (round === 2) {
//       const lastPick = path[path.length - 1];
//       return GENRE_TREE.round2[lastPick]?.prompt || "Pick your favorite";
//     } else if (round === 3) return GENRE_TREE.round3.prompt;
//     else if (round === 4) {
//       const lastPick = path[path.length - 1];
//       return GENRE_TREE.round4[lastPick]?.prompt || "Pick your favorite";
//     } else if (round === 5) return GENRE_TREE.round5.prompt;
//     return '';
//   };

//   const options = getCurrentOptions();
//   const prompt = getPrompt();

//   return (
//     <div className="min-h-screen bg-black p-8">
//       <div className="max-w-4xl mx-auto">
//         <h2 className="text-3xl font-bold text-white mb-2 text-center">{prompt}</h2>
//         <p className="text-zinc-400 text-center mb-8">Question {round}/5</p>
        
//         <div className="grid grid-cols-2 gap-4 mb-6">
//           {options.map((genre, idx) => (
//             <button
//               key={idx}
//               onClick={() => onPick(genre)}
//               className="p-6 bg-zinc-900 border-2 border-zinc-700 rounded-lg hover:border-green-500 hover:bg-zinc-800 transition text-left"
//             >
//               <p className="text-white font-bold text-lg capitalize">{genre.replace(/-/g, ' ')}</p>
//             </button>
//           ))}
//         </div>

//         {path.length > 0 && (
//           <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
//             <p className="text-zinc-500 text-xs mb-2">Your picks so far:</p>
//             <div className="flex flex-wrap gap-2">
//               {path.map((pick, idx) => (
//                 <span key={idx} className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full text-xs capitalize">
//                   {pick.replace(/-/g, ' ')}
//                 </span>
//               ))}
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// export const buildProfileFromPath = (path) => {
//   const genres = path.filter(g => !['high-energy', 'chill', 'melancholy', 'uplifting'].includes(g));
  
//   let energy = [0.3, 0.7];
//   let valence = [0.3, 0.7];
//   let danceability = [0.4, 0.7];
//   let tempo = [90, 130];
//   let acousticness = [0.2, 0.6];
//   let descriptor = 'Eclectic Explorer';
  
//   if (path.includes('high-energy')) {
//     energy = [0.7, 1.0];
//     valence = [0.5, 0.9];
//     danceability = [0.6, 0.9];
//     tempo = [120, 180];
//     descriptor = 'High Octane Hero';
//   } else if (path.includes('chill')) {
//     energy = [0.1, 0.4];
//     valence = [0.3, 0.6];
//     danceability = [0.3, 0.6];
//     tempo = [60, 100];
//     acousticness = [0.4, 0.8];
//     descriptor = 'Chill Vibes Curator';
//   } else if (path.includes('melancholy')) {
//     energy = [0.2, 0.5];
//     valence = [0.1, 0.4];
//     danceability = [0.3, 0.6];
//     tempo = [70, 110];
//     descriptor = 'Melancholy Muse';
//   } else if (path.includes('uplifting')) {
//     energy = [0.5, 0.8];
//     valence = [0.7, 1.0];
//     danceability = [0.6, 0.85];
//     tempo = [110, 150];
//     descriptor = 'Upbeat Enthusiast';
//   }
  
//   const avgEnergy = (energy[0] + energy[1]) / 2;
//   const avgValence = (valence[0] + valence[1]) / 2;
//   const avgDanceability = (danceability[0] + danceability[1]) / 2;
//   const avgTempo = (tempo[0] + tempo[1]) / 2;
//   const avgAcousticness = (acousticness[0] + acousticness[1]) / 2;
  
//   return createTasteProfile({
//     name: 'Your Custom Taste',
//     source: 'custom',
//     descriptor,
//     genres,
//     energy,
//     valence,
//     danceability,
//     acousticness,
//     tempo,
//     popularity: [20, 90],
//     audioFeatureAverages: {
//       acousticness: avgAcousticness,
//       danceability: avgDanceability,
//       energy: avgEnergy,
//       instrumentalness: 0.1,
//       key: 5,
//       liveness: 0.12,
//       loudness: -8,
//       mode: avgValence > 0.5 ? 1 : 0,
//       speechiness: 0.06,
//       tempo: avgTempo,
//       time_signature: 4,
//       valence: avgValence,
//     },
//   });
// };