
  const formatArtists = (artists) => {
    if (typeof artists === 'string') return artists;
    if (Array.isArray(artists)) return artists.join(', ');
    return 'Unknown Artist';
  };

  const renderCard = (card, side) => {
    if (!card) return null;

    if (card.type === 'song') {
      const song = card.data;
      return (
        <button
          onClick={() => onSelectCard(card)}
          className="relative group w-full bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-lg p-6 border-2 border-zinc-700 hover:border-green-500 transition cursor-pointer overflow-hidden"
        >
          {/* Prevent clicks on the button from bubbling */}
          <div className="absolute top-3 right-3 z-20">
            <PreviewPlayer song={song} compact={true} />
          </div>

          <div className="flex gap-4 items-start pr-16">
            <Music className="text-green-500 flex-shrink-0 mt-1" size={24} />
            <div className="text-left flex-grow min-w-0">
              <p className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-1">
                Seed Song
              </p>
              <p className="text-white font-bold truncate">{formatArtists(song.artists)}</p>
              <p className="text-zinc-300 text-sm truncate">{song.track_name}</p>
            </div>
          </div>
        </button>
      );
    }

    if (card.type === 'challenge') {
      const challenge = card.data;
      return (
        <button
          onClick={() => onSelectCard(card)}
          className="w-full bg-gradient-to-br from-amber-900/30 to-amber-950/30 rounded-lg p-6 border-2 border-amber-700/50 hover:border-amber-500 transition cursor-pointer"
        >
          <div className="flex gap-4 items-start">
            <Target className="text-amber-500 flex-shrink-0 mt-1" size={24} />
            <div className="text-left flex-grow">
              <p className="text-sm font-semibold text-amber-400 uppercase tracking-wide mb-1">
                Challenge
              </p>
              <p className="text-white font-bold">{challenge.name}</p>
              <p className="text-zinc-300 text-sm">{challenge.description}</p>
            </div>
          </div>
        </button>
      );
    }

    if (card.type === 'remove') {
      return (
        <button
          onClick={() => onSelectCard(card)}
          className="w-full bg-gradient-to-br from-red-900/30 to-red-950/30 rounded-lg p-6 border-2 border-red-700/50 hover:border-red-500 transition cursor-pointer"
        >
          <div className="flex gap-4 items-center">
            <Trash2 className="text-red-500 flex-shrink-0" size={24} />
            <div className="text-left">
              <p className="text-sm font-semibold text-red-400 uppercase tracking-wide">
                Remove Slot
              </p>
              <p className="text-zinc-300 text-sm">Clear a selection</p>
            </div>
          </div>
        </button>
      );
    }
  };

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Draft Your Puzzle</h1>
          <p className="text-zinc-400">Pick a seed song and 3 challenges. The game will find 25 similar songs for you to guess from.</p>
        </div>

        {/* Selections Display */}
        <div className="bg-zinc-950 rounded-lg p-6 mb-8 border border-zinc-800">
          <h2 className="text-lg font-bold text-white mb-4">Your Selections</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Seed Slot */}
            <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/30 min-h-24 flex items-center justify-center">
              {seed ? (
                <div
                  onClick={() => removeMode && onRemoveSlot('seed')}
                  className={removeMode ? 'cursor-pointer opacity-75 hover:opacity-100' : ''}
                >
                  <p className="text-sm text-green-400 font-semibold mb-1">Seed:</p>
                  <p className="text-white font-bold">{formatArtists(seed.artists)}</p>
                  <p className="text-green-300 text-sm">{seed.track_name}</p>
                </div>
              ) : (
                <p className="text-zinc-500 text-sm italic">Pick a seed song</p>
              )}
            </div>

            {/* Challenge Slots */}
            <div className="space-y-2">
              {challenges.map((challenge, idx) => (
                <div
                  key={idx}
                  onClick={() => removeMode && onRemoveSlot(`challenge-${idx}`)}
                  className={`bg-amber-500/10 rounded-lg p-3 border border-amber-500/30 min-h-16 flex items-center justify-center ${
                    removeMode ? 'cursor-pointer opacity-75 hover:opacity-100' : ''
                  }`}
                >
                  {challenge ? (
                    <div>
                      <p className="text-sm text-amber-400 font-semibold">Challenge:</p>
                      <p className="text-white font-bold">{challenge.name}</p>
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm italic">Pick a challenge</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Choice Cards */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-white mb-4">Choose one:</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {currentChoice && (
              <>
                {renderCard(currentChoice.optionA, 'A')}
                {renderCard(currentChoice.optionB, 'B')}
              </>
            )}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => onRemoveSlot(null)}
            className={`flex-1 py-3 rounded-lg font-bold transition ${
              removeMode
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-zinc-800 text-white hover:bg-zinc-700'
            }`}
          >
            {removeMode ? '✓ Remove Mode ON' : 'Remove Selection'}
          </button>
        </div>
      </div>
    </div>
  );
}

export { DraftPhase };