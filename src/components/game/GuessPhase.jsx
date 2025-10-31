import React, { useState } from 'react';
import { Shuffle, Lightbulb, Bug } from 'lucide-react';
import { PreviewPlayer } from '../ui/PreviewPlayer.jsx';

export function GuessPhase({
  seed,
  seedHints,
  revealedHints,
  challenges,
  challengePlacements,
  multipleChoiceOptions,
  textInput,
  textMatchedSong,
  errorMessage,
  guesses,
  guessesLeft,
  debugMode = false,
  onRevealHint,
  onGetHint,
  onGuess,
  onRefreshCandidates,
  onTextInput,
  onSeeScore,
}) {
  const [showDebugFor, setShowDebugFor] = useState(null);

  const DebugOverlay = ({ track, onClose }) => (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-green-500 rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-white">Debug Info</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </div>
        <div className="space-y-2 text-sm font-mono">
          <div><span className="text-zinc-400">Track ID:</span> <span className="text-white">{track.track_id || track.id}</span></div>
          <div><span className="text-zinc-400">Name:</span> <span className="text-white">{track.track_name || track.name}</span></div>
          <div><span className="text-zinc-400">Artists:</span> <span className="text-white">{JSON.stringify(track.artists)}</span></div>
          <div><span className="text-zinc-400">Year:</span> <span className="text-white">{track.year}</span></div>
          <div><span className="text-zinc-400">Popularity:</span> <span className="text-white">{track.popularity}</span></div>
          <div><span className="text-zinc-400">Tier:</span> <span className="text-white">{track.tier}</span></div>
          <div><span className="text-zinc-400">Correct:</span> <span className={track.correct ? "text-green-400" : "text-red-400"}>{String(track.correct)}</span></div>
          <div><span className="text-zinc-400">isCorrect flag:</span> <span className={track.isCorrect ? "text-green-400" : "text-red-400"}>{String(track.isCorrect)}</span></div>
          <div><span className="text-zinc-400">Pools:</span> <span className="text-white">{JSON.stringify(track.pools)}</span></div>
          <div><span className="text-zinc-400">Radio Fit:</span> <span className="text-white">{track.radio_fit?.toFixed(4)}</span></div>
          <div><span className="text-zinc-400">Audio Sim:</span> <span className="text-white">{track.audio_sim?.toFixed(4)}</span></div>
          <div><span className="text-zinc-400">Genre Sim:</span> <span className="text-white">{track.genre_sim?.toFixed(4)}</span></div>
          <div><span className="text-zinc-400">Energy:</span> <span className="text-white">{track.energy?.toFixed(2)}</span></div>
          <div><span className="text-zinc-400">Valence:</span> <span className="text-white">{track.valence?.toFixed(2)}</span></div>
          <div><span className="text-zinc-400">Danceability:</span> <span className="text-white">{track.danceability?.toFixed(2)}</span></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-zinc-900 rounded-lg p-5 mb-6 border border-zinc-800">
          <h3 className="text-2xl font-bold text-white mb-3">Seed Track</h3>
          <div className="bg-green-500/10 p-4 rounded-lg border border-green-500/30 flex items-start justify-between">
            <div className="flex-1">
              <p className="text-white text-xl font-bold">{seed.artists}</p>
              <p className="text-zinc-300 text-lg">{seed.track_name}</p>
            </div>
            <div className="flex items-center gap-2">
              {debugMode && (
                <button
                  onClick={() => setShowDebugFor(seed)}
                  className="p-2 bg-yellow-500/20 hover:bg-yellow-500/30 rounded-full transition"
                  title="Show debug info"
                >
                  <Bug className="w-5 h-5 text-yellow-400" />
                </button>
              )}
              <PreviewPlayer song={seed} />
            </div>
          </div>

          <div className="mt-4 p-4 bg-green-500/10 rounded-lg border border-green-500/30">
            <p className="text-white text-sm font-semibold mb-2">Seed Hints (click to reveal):</p>
            <div className="space-y-2">
              {seedHints.map((hint, idx) => (
                <button
                  key={idx}
                  onClick={() => onRevealHint(idx)}
                  disabled={revealedHints[idx]}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                    revealedHints[idx]
                      ? 'bg-green-500/20 text-white cursor-default'
                      : 'bg-green-500/30 text-white hover:bg-green-500/40 cursor-pointer'
                  }`}
                >
                  {revealedHints[idx] ? hint : `Hint ${idx + 1} (click to reveal)`}
                </button>
              ))}
            </div>
          </div>

          <h3 className="text-2xl font-bold text-white mt-5 mb-3">Challenges</h3>
          <div className="grid grid-cols-3 gap-3">
            {challenges.map((challenge, idx) => (
              <div 
                key={idx}
                className="p-3 rounded-lg border-2 min-h-[100px] bg-blue-500/20 border-blue-500"
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="text-white font-semibold text-sm">{challenge.name}</p>
                  <button
                    onClick={() => onGetHint(idx)}
                    className="hover:scale-110 transition"
                  >
                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                  </button>
                </div>
                <p className="text-zinc-400 text-xs">{challenge.description}</p>
                {challengePlacements[idx] && (
                  <div className="mt-2 pt-2 border-t border-blue-500/30">
                    <p className="text-green-400 text-xs font-semibold">
                      {guesses.find(g => g.id === challengePlacements[idx])?.artist}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 rounded-lg p-5 mb-4 border border-zinc-800">
          <p className="text-white text-center text-lg mb-3">What other songs would be on a radio station for this song?</p>
          
          {multipleChoiceOptions.length > 0 && (
            <div className="mb-4">
              <div className="grid grid-cols-2 gap-2">
                {multipleChoiceOptions.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => onGuess(option)}
                    className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-green-500 text-left p-3 rounded-lg transition flex items-start justify-between gap-2 relative"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm">{option.artists}</p>
                      <p className="text-zinc-400 text-xs truncate">{option.track_name}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {debugMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDebugFor(option);
                          }}
                          className="p-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 rounded-full transition"
                          title="Show debug info"
                        >
                          <Bug className="w-4 h-4 text-yellow-400" />
                        </button>
                      )}
                      <PreviewPlayer song={option} compact />
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={onRefreshCandidates}
                className="w-full mt-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-lg text-sm transition flex items-center justify-center gap-2"
              >
                <Shuffle className="w-4 h-4" />
                Refresh Candidates
              </button>
            </div>
          )}

          <div className="relative">
            <input
              type="text"
              value={textInput}
              onChange={onTextInput}
              placeholder="Or type an artist or song name..."
              className="w-full px-4 py-3 rounded-lg bg-zinc-800 text-white placeholder-zinc-500 border border-zinc-700 focus:border-green-500 focus:outline-none"
            />
            {textMatchedSong && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-800 border border-green-500 rounded-lg p-3 flex items-start justify-between gap-2 z-10">
                <button
                  onClick={() => onGuess(textMatchedSong)}
                  className="flex-1 text-left"
                >
                  <p className="text-white font-semibold text-sm">{textMatchedSong.artists}</p>
                  <p className="text-zinc-400 text-xs">{textMatchedSong.track_name}</p>
                </button>
                <PreviewPlayer song={textMatchedSong} compact />
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded-lg">
              <p className="text-red-300 text-sm">{errorMessage}</p>
            </div>
          )}

          <div className="mt-4 text-center">
            <p className="text-zinc-400 text-sm">Guesses left: {guessesLeft}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 mb-6">
          {[...guesses].reverse().map(guess => {
            const placedChallenges = challengePlacements
              .map((gId, cIdx) => gId === guess.id ? cIdx : null)
              .filter(c => c !== null);
            
            return (
              <div
                key={guess.id}
                className={`p-3 rounded-lg border transition ${
                  guess.incorrect 
                    ? 'bg-red-500/10 border-red-500' 
                    : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <p className={`font-semibold text-sm ${guess.incorrect ? 'text-red-300' : 'text-white'}`}>
                  {guess.artist} - {guess.song}
                </p>
                {guess.incorrect ? (
                  <div className="mt-2">
                    <p className="text-red-300/90 text-xs font-semibold mb-1">Not on playlist. Why?</p>
                    <ul className="text-red-300/70 text-xs space-y-1">
                      {guess.feedback.map((fb, idx) => (
                        <li key={idx}>• {fb}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <>
                    <p className="text-zinc-400 text-xs">Base: {guess.basePoints} pts</p>
                    {placedChallenges.length > 0 && (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {placedChallenges.map(challengeIdx => (
                          <div 
                            key={challengeIdx}
                            className="bg-green-500/30 border border-green-500 px-2 py-1 rounded text-xs text-white font-semibold"
                          >
                            {challenges[challengeIdx].name}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {guesses.length > 0 && (
          <button
            onClick={onSeeScore}
            className="w-full mt-4 bg-green-500 text-black py-3 rounded-lg font-bold text-lg hover:bg-green-400 transition"
          >
            See Your Score
          </button>
        )}
      </div>

      {showDebugFor && (
        <DebugOverlay track={showDebugFor} onClose={() => setShowDebugFor(null)} />
      )}
    </div>
  );
}
