import React from 'react';
import { Music, Target, Trash2 } from 'lucide-react';
import { PreviewPlayer } from '../ui/PreviewPlayer.jsx';

export function DraftPhase({ 
  seed, 
  challenges, 
  currentChoice, 
  removeMode, 
  onSelectCard, 
  onRemoveSlot 
}) {
  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-white mb-4 text-center">Draft Your Puzzle</h2>
        
        {removeMode && (
          <div className="bg-red-500/20 backdrop-blur rounded-lg p-4 mb-6 text-center border border-red-500/50">
            <p className="text-white font-semibold">Click a slot to remove it</p>
          </div>
        )}

        <div className="bg-zinc-900 rounded-lg p-6 mb-8 border border-zinc-800">
          <div className="grid grid-cols-4 gap-4">
            <div 
              onClick={() => removeMode && seed && onRemoveSlot('seed')}
              className={`p-4 rounded-lg border-2 ${
                removeMode && seed ? 'bg-red-500/20 border-red-500 cursor-pointer' : 
                seed ? 'bg-green-500/20 border-green-500' : 'bg-zinc-800 border-zinc-700'
              } min-h-[120px] flex items-center justify-center transition`}
            >
              {seed ? (
                <div className="text-center">
                  <Music className="w-6 h-6 text-white mx-auto mb-2" />
                  <p className="text-white text-sm font-semibold">{seed.artists}</p>
                  <p className="text-zinc-400 text-xs">{seed.track_name}</p>
                </div>
              ) : (
                <p className="text-zinc-500 text-sm">Seed</p>
              )}
            </div>
            
            {challenges.map((challenge, idx) => (
              <div 
                key={idx}
                onClick={() => removeMode && challenge && onRemoveSlot('challenge', idx)}
                className={`p-4 rounded-lg border-2 ${
                  removeMode && challenge ? 'bg-red-500/20 border-red-500 cursor-pointer' :
                  challenge ? 'bg-green-500/20 border-green-500' : 'bg-zinc-800 border-zinc-700'
                } min-h-[120px] flex items-center justify-center transition`}
              >
                {challenge ? (
                  <div className="text-center">
                    <Target className="w-6 h-6 text-white mx-auto mb-2" />
                    <p className="text-white text-sm font-semibold">{challenge.name}</p>
                    <p className="text-zinc-400 text-xs mt-1">{challenge.description}</p>
                  </div>
                ) : (
                  <p className="text-zinc-500 text-sm">Challenge {idx + 1}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {currentChoice && (
          <div className="grid grid-cols-2 gap-6">
            {[currentChoice.optionA, currentChoice.optionB].map((option, idx) => (
              <button
                key={idx}
                onClick={() => onSelectCard(option)}
                className={`p-8 rounded-lg border-2 hover:scale-105 transition ${
                  option.type === 'song' 
                    ? 'bg-green-500/10 border-green-500 hover:bg-green-500/20' 
                    : option.type === 'challenge'
                    ? 'bg-blue-500/10 border-blue-500 hover:bg-blue-500/20'
                    : 'bg-red-500/10 border-red-500 hover:bg-red-500/20'
                }`}
              >
                {option.type === 'song' ? (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <Music className="w-12 h-12 text-white" />
                      <PreviewPlayer song={option.data} />
                    </div>
                    <p className="text-white text-xl font-bold mb-2">{option.data.artists}</p>
                    <p className="text-zinc-300 text-lg">{option.data.track_name}</p>
                  </div>
                ) : option.type === 'challenge' ? (
                  <div className="text-center">
                    <Target className="w-12 h-12 text-white mx-auto mb-4" />
                    <p className="text-white text-xl font-bold mb-2">{option.data.name}</p>
                    <p className="text-zinc-300 text-sm">{option.data.description}</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Trash2 className="w-12 h-12 text-white mx-auto mb-4" />
                    <p className="text-white text-xl font-bold">Remove</p>
                    <p className="text-zinc-300 text-sm">Clear a slot</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}