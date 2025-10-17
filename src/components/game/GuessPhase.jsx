import React, { useState } from 'react';
import { Lightbulb, Shuffle } from 'lucide-react';
import PreviewPlayer from '../ui/PreviewPlayer';

function GuessPhase({
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
  onRevealHint,
  onGetHint,
  onGuess,
  onRefreshCandidates,
  onTextInput,
  onSeeScore
}) {
  const [showAnimation, setShowAnimation] = useState(null);

  const formatArtists = (artists) => {
    if (typeof artists === 'string') return artists;
    if (Array.isArray(artists)) return artists.join(', ');
    return 'Unknown Artist';
  };

  const handleGuessWithAnimation = (song) => {
    setShowAnimation(song.track_id);
    setTimeout(() => setShowAnimation(null), 1500);
    onGuess(song);
  };

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Guess the Playlist</h1>
          <p className="text-zinc-400">Which songs belong on a radio station built around this seed track?</p>
        </div>

        {/* Seed Track - Now with Preview */}
        <div className="bg-gradient-to-r from-green-500/10 to-green-500/5 rounded-lg p-6 mb-8 border border-green-500/30">
          <p className="text-sm text-green-400 font-semibold uppercase tracking-wide mb-2">
            Seed Track
          </p>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-grow min-w-0">
              <p className="text-white font-bold text-lg truncate">{formatArtists(seed.artists)}</p>
              <p className="text-green-300 text-sm truncate">{seed.track_name}</p>
            </div>
            <PreviewPlayer song={seed} compact={true} />
          </div>

          {/* Seed Hints */}
          <div className="mt-6 space-y-2 pt-6 border-t border-green-500/20">
            <p className="text-xs text-green-400 font-semibold uppercase">Hints (click to reveal):</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {seedHints.map((hint, idx) => (
                <button
                  key={idx}
                  onClick={() => onRevealHint(idx)}
                  disabled={revealedHints[idx]}
                  className={`text-left px-3 py-2 rounded text-sm transition ${
                    revealedHints[idx]
                      ? 'bg-green-500/20 text-green-100 cursor-default'
                      : 'bg-green-500/10 text-green-300 hover:bg-green-500/20'
                  }`}
                >
                  {revealedHints[idx] ? hint : `Hint ${idx + 1}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Multiple Choice Quiz */}
        <div className="bg-zinc-900 rounded-lg p-6 mb-8 border border-zinc-800">
          <h2 className="text-lg font-bold text-white mb-4">Pick one:</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {multipleChoiceOptions.map((song) => {
              const isAnimating = showAnimation === song.track_id;
              return (
                <button
                  key={song.track_id}
                  onClick={() => handleGuessWithAnimation(song)}
                  className={`relative group bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-lg p-4 border-2 transition transform ${
                    isAnimating
                      ? 'scale-105 border-green-500 bg-green-500/20 animate-pulse'
                      : 'border-zinc-700 hover:border-green-500'
                  }`}
                >
                  {/* Play button - positioned to not interfere with text */}
                  <div className="absolute top-3 right-3 z-20">
                    <PreviewPlayer song={song} compact={true} />
                  </div>

                  {/* Content with padding for play button */}
                  <div className="text-left pr-14">
                    <p className="text-white font-bold truncate">{formatArtists(song.artists)}</p>
                    <p className="text-zinc-300 text-sm truncate">{song.track_name}</p>
                  </div>

                  {/* Success animation */}
                  {isAnimating && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-green-500/30 pointer-events-none">
                      <div className="text-4xl animate-bounce">✓</div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Text Input Search */}
        <div className="bg-zinc-900 rounded-lg p-6 mb-8 border border-zinc-800">
          <h3 className="text-lg font-bold text-white mb-4">Or search manually:</h3>
          <input
            type="text"
            value={textInput}
            onChange={(e) => onTextInput(e.target.value)}
            placeholder="Artist or song name..."
            className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg border border-zinc-700 focus:border-green-500 focus:outline-none transition mb-3"
          />
          {textMatchedSong && (
            <button
              onClick={() => handleGuessWithAnimation(textMatchedSong)}
              className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-2 rounded-lg transition"
            >
              Guess: {formatArtists(textMatchedSong.artists)} - {textMatchedSong.track_name}
            </button>
          )}
          {errorMessage && (
            <p className="text-red-400 text-sm mt-2">{errorMessage}</p>
          )}
        </div>

        {/* Challenges */}
        <div className="bg-amber-500/10 rounded-lg p-6 mb-8 border border-amber-500/20">
          <h3 className="text-lg font-bold text-white mb-3">Challenges (bonus points)</h3>
          <p className="text-zinc-400 text-sm mb-4">
            Guess songs that match these criteria to earn extra points. Your guesses will automatically be matched if they qualify.
          </p>
          <div className="space-y-2">
            {challenges.map((challenge, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <Lightbulb className="text-amber-500 flex-shrink-0 mt-1" size={18} />
                <div>
                  <p className="text-white font-semibold">{challenge.name}</p>
                  <p className="text-amber-300 text-sm">{challenge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Guesses History */}
        {guesses.length > 0 && (
          <div className="bg-zinc-900 rounded-lg p-6 mb-8 border border-zinc-800">
            <h3 className="text-lg font-bold text-white mb-4">Your Guesses ({guesses.length})</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {guesses.map((guess, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-lg text-sm ${
                    guess.onPlaylist
                      ? 'bg-green-500/20 border border-green-500/50 text-green-100'
                      : 'bg-red-500/20 border border-red-500/50 text-red-100'
                  }`}
                >
                  <div>
                    <p className="font-semibold">{formatArtists(guess.artists)}</p>
                    <p className="text-xs opacity-75">{guess.track_name}</p>
                  </div>
                  <span className="font-bold">
                    {guess.onPlaylist ? '✓ On Playlist' : '✗ Wrong'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onRefreshCandidates}
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-lg transition"
          >
            <Shuffle size={18} />
            Refresh Choices (1 guess)
          </button>
          <button
            onClick={onSeeScore}
            className="flex-1 bg-green-500 hover:bg-green-400 text-black font-bold py-3 rounded-lg transition"
          >
            See Your Score
          </button>
        </div>

        {/* Guesses Left */}
        <div className="text-center mt-6 text-zinc-400">
          <p>Guesses left: <span className="font-bold text-white">{guessesLeft}</span></p>
        </div>
      </div>
    </div>
  );
}

export default GuessPhase;