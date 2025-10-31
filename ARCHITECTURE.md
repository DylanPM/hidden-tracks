# Radio Puzzle Game - Architecture Documentation

## Overview
A music guessing game where users draft a "seed song" + 3 challenges, then guess which songs would appear on a radio station playlist based on that seed. Currently in **DEMO_MODE** - uses pre-generated profile JSON files instead of live Spotify data.

---

## Core Architecture

### Data Flow
```
Constellation Select → Draft Phase → Loading → Guess Phase → Score Phase
      ↓                    ↓            ↓           ↓            ↓
  Select tracks      Pick seed+     Load         Make         Review
  from genre         challenges    profile      guesses       results
  constellation                     JSON
```

---

## Critical Data Structures

### Profile JSON Format (Source of Truth)
Located in `/public/profiles/*.json`. These are **pre-computed** and contain all track data, similarity scores, and correctness flags.

**Profile Structure:**
```json
{
  "seed": {
    "id": "spotify:track:...",
    "name": "Song Name",
    "artists": ["Artist Name"],  // ⚠️ ALWAYS AN ARRAY
    "year": 2019,
    "popularity": 60,
    "genres": ["genre"],
    "danceability": 0.514,
    "energy": 0.956,
    "valence": 0.489,
    // ... all Spotify audio features
  },
  "tracks": [
    {
      "id": "...",
      "name": "...",
      "artists": ["..."],  // ⚠️ ALWAYS AN ARRAY
      "correct": true,     // ⚠️ Pre-computed correctness flag
      "pools": ["easy", "medium", "hard"],  // Which difficulty pools include this track
      "radio_fit": 0.95,   // Pre-computed similarity score
      "audio_sim": 0.87,   // Audio feature similarity
      "genre_sim": 0.5,    // Genre overlap
      "era_dist": 2,       // Years apart
      "tier": 1,           // Similarity tier (1=closest, 5=furthest)
      // ... all audio features
    }
  ]
}
```

**⚠️ CRITICAL DATA HANDLING RULES:**
1. **NEVER normalize or transform profile data** - use as-is
2. **Artists are ALWAYS arrays** - use `.join(', ')` for display
3. **Correctness is pre-computed** - check `track.correct === true`
4. **Tracks contain similarity scores** - use for feedback

---

## State Management

### useGameState Hook (`src/hooks/useGameState.js`)
Central game state managed via useReducer. **This is the single source of truth for game data.**

**State Structure:**
```javascript
{
  seed: null,                      // Selected seed track object
  challenges: [null, null, null],  // 3 challenge objects
  radioPlaylist: [],               // Array of correct tracks from profile
  guesses: [],                     // Player's guess history
  guessedTracks: Set,              // Set of "artist-trackname" strings
  challengePlacements: [null, null, null],  // Which guess satisfies each challenge
  multipleChoiceOptions: [],       // Current 4 options to choose from
  seedHints: [],                   // 3 hints about the seed
  revealedHints: [false, false, false],  // Which hints are shown
  usedHints: [false, false, false]       // Which challenge hints used
}
```

**Available Actions:**
```javascript
gameState.setSeed(track)
gameState.setChallenge(index, challenge)
gameState.removeSeed()
gameState.removeChallenge(index)
gameState.setRadioPlaylist(tracks)
gameState.setSeedHints(hints)
gameState.revealHint(index)
gameState.useHint(index)
gameState.addGuess(guess, trackKey)
gameState.setMultipleChoice(options)
gameState.setChallengePlacements(placements)
gameState.resetGame()
```

---

## Game Phases (src/RadioPuzzleGame.jsx)

### Phase Flow
Controlled by `phase` state variable:

1. **'constellation'**: Select tracks from genre constellation
   - Component: `GenreConstellationSelect`
   - User picks 1-5 tracks from available profiles
   - Picks difficulty (easy/medium/hard)
   - Calls: `handleConstellationLaunch(tracks, difficulty)`

2. **'draft'**: Pick seed + 3 challenges
   - Component: `DraftPhase`
   - Shows current seed + 3 challenge slots
   - Generates random card pairs (song/challenge/remove)
   - User picks cards until draft complete (1 seed + 3 challenges)
   - When complete, calls: `loadProfileForSeed(seed)`

3. **'loading'**: Load profile JSON
   - Shows spinner
   - Fetches `/profiles/{seed.filename}`
   - Parses profile, builds difficulty pools
   - Sets radioPlaylist from correct tracks in selected difficulty
   - Transitions to 'guess'

4. **'guess'**: Main gameplay
   - Component: `GuessPhase`
   - Shows 4 multiple choice options + text search (disabled)
   - Player makes guesses (max 6)
   - Each guess checked against profile's `correct` flag
   - Auto-transitions to 'score' when out of guesses

5. **'score'**: Show results
   - Component: `ScorePhase`
   - Display all guesses with scores
   - Challenge placements and bonuses
   - Option to play again

---

## Key Functions in RadioPuzzleGame.jsx

### handleConstellationLaunch(tracks, selectedDifficulty)
- Converts constellation tracks to game format
- Sets `selectedTracks` and `difficulty`
- Transitions to 'draft' phase
- **Data passed:** tracks array with `{uri, name, artist, filename}`

### loadProfileForSeed(seed)
- **Critical function** - loads profile JSON
- Fetches from `/profiles/{seed.filename}`
- Validates profile structure
- Builds difficulty pools by filtering `track.pools` array
- Sets `radioPlaylist` from correct tracks in selected difficulty
- **⚠️ Uses profile data directly - NO normalization**

### generateChoice()
- Creates draft card options
- Determines if need seed or challenges
- Generates 2 random cards (song/challenge/remove)
- When draft complete, calls `loadProfileForSeed()`

### generateMultipleChoice()
- Creates 4 options for current guess round
- Mix of correct/incorrect based on difficulty:
  - Easy: 2-3 correct, 1-2 incorrect
  - Medium: 1-3 correct (variable)
  - Hard: 1-2 correct, 2-3 incorrect
- Filters out already guessed tracks
- **Uses profile pools directly**

### handleGuess(song)
- Validates guess (not duplicate, not seed)
- Creates track key: `artists.join(', ')-track_name`
- Checks `song.correct === true` or `song.isCorrect === true`
- If wrong: generates feedback using similarity scores
- If correct: calculates points + challenge matches
- Calls `autoAssignChallenges()` to match guesses to challenges

### autoAssignChallenges(guesses)
- For each challenge, tests each correct guess
- Uses challenge's `.check(song, seed)` function
- Auto-assigns best matches to challenge slots
- Updates `challengePlacements`

### generateFeedback(song, seed)
- Creates feedback for incorrect guesses
- Uses pre-computed similarity scores from profile:
  - `audio_sim`, `genre_sim`, `era_dist`, `tier`, `radio_fit`
- Returns array of feedback strings

---

## Components

### GenreConstellationSelect (`src/components/game/GenreConstellationSelect.jsx`)
**Props:** `onLaunch(tracks, difficulty)`
- Shows available profiles grouped by genre
- User selects 1-5 tracks + difficulty
- Calls onLaunch with selected tracks

### DraftPhase (`src/components/game/DraftPhase.jsx`)
**Props:**
```javascript
{
  seed,                // Current seed object or null
  challenges,          // Array of 3 challenges
  currentChoice,       // {optionA, optionB} card objects
  removeMode,          // Boolean - in remove mode?
  seedIsLocked,        // Boolean - can't remove seed?
  onSelectCard(option),  // User picks a card
  onRemoveSlot(type, index)  // User removes seed/challenge
}
```
- Displays current draft state
- Shows 2 card options
- Handles card selection and removal

### GuessPhase (`src/components/game/GuessPhase.jsx`)
**Props:**
```javascript
{
  seed,                    // Seed track object
  seedHints,               // Array of 3 hint strings
  revealedHints,           // Array of 3 booleans
  challenges,              // Array of 3 challenge objects
  challengePlacements,     // Array of 3 guess IDs
  multipleChoiceOptions,   // Array of 4 track objects
  textInput,               // String (unused - search disabled)
  textMatchedSong,         // Object (unused - search disabled)
  errorMessage,            // String error to display
  guesses,                 // Array of guess objects
  guessesLeft,             // Number
  debugMode,               // Boolean - show debug info
  onRevealHint(index),     // Reveal seed hint
  onGetHint(challengeIdx), // Show example tracks for challenge
  onGuess(song),           // Make a guess
  onRefreshCandidates(),   // Regenerate 4 options
  onTextInput(e),          // Unused
  onSeeScore()             // Go to score phase
}
```
- Main gameplay UI
- Shows seed, hints, challenges
- 4 multiple choice options + refresh button
- Guess history with feedback
- Debug overlay (when DEBUG_MODE=true)

### ScorePhase (`src/components/game/ScorePhase.jsx`)
**Props:**
```javascript
{
  guesses,              // Array of guess objects
  challengePlacements,  // Array of 3 guess IDs
  challenges,           // Array of 3 challenge objects
  onPlayAgain()         // Reset and return to constellation
}
```
- Shows final score breakdown
- Challenge bonuses
- Play again button

---

## Track Key System

**Critical for deduplication:** Tracks are identified by `"artist-trackname"` string.

**Creating track keys:**
```javascript
// Profile data has artists as array
const artistStr = Array.isArray(track.artists)
  ? track.artists.join(', ')
  : track.artists;
const trackKey = `${artistStr}-${track.track_name}`;
```

**Stored in:** `gameState.state.guessedTracks` (Set)

---

## Challenge System

### Challenge Object Structure (`src/constants/gameConfig.js`)
```javascript
{
  id: 'mega-hit',
  name: 'Mega Hit',
  description: 'Everyone knows this one',
  check: (song, seed) => song.popularity > 75  // Function returns boolean
}
```

**Available Challenges:**
- Mega Hit: popularity > 75
- Deep Cut: popularity < 25
- Cult Classic: popularity 25-50
- High Energy: energy > 0.7
- Chill Vibes: energy < 0.3
- Dance Floor: danceability > 0.7
- Feel Good: valence > 0.7
- Melancholy: valence < 0.3
- Unplugged: acousticness > 0.6
- Fast & Furious: tempo > 140
- Slow Burn: tempo < 90

**Challenge Checking:**
- Each guess is tested against all 3 challenges
- Scores stored in `guess.challengeScores[0-2]`
- Auto-assignment picks best matches

---

## Utility Functions

### generateSeedHints(seedSong) (`src/utils/gameUtils.js`)
- Creates 3 hints about the seed
- Hint 1: Vague vibe description
- Hint 2: Genre + production style
- Hint 3: Algorithmic attributes
- Returns array of 3 strings

---

## Important Configuration

### RadioPuzzleGame.jsx Constants
```javascript
const DEMO_MODE = true;    // Use profile JSONs, not Spotify OAuth
const DEBUG_MODE = true;   // Show debug button in GuessPhase
```

### Difficulty Settings
- **easy**: More correct answers in multiple choice (2-3 of 4)
- **medium**: Balanced (1-3 of 4)
- **hard**: Fewer correct answers (1-2 of 4)

Difficulty also determines which pool from profile is used:
```javascript
const pool = profile.pools[difficulty] || profile.pools.medium;
```

---

## Data Passing Between Files

### RadioPuzzleGame.jsx → Components
**All data flows down via props.** Components are stateless UI - they call callbacks to modify parent state.

**DO NOT:**
- ❌ Modify track objects in components
- ❌ Transform artist arrays in components
- ❌ Calculate correctness in components

**DO:**
- ✅ Display data as received
- ✅ Call parent callbacks with selections
- ✅ Handle UI-only state (like hover, modals)

### Profile JSON → Game State
**Loaded once in `loadProfileForSeed()`:**
1. Fetch profile JSON
2. Extract seed with all properties
3. Filter tracks by `pools` array for difficulty
4. Filter correct tracks: `track.correct === true`
5. Store in `gameState.radioPlaylist`

**Never transform or normalize this data.**

### Track Object Properties (from profile)
```javascript
{
  track_id: string,        // Or just 'id'
  track_name: string,      // Or just 'name'
  artists: string[],       // ALWAYS array
  year: number,
  popularity: number,
  genres: string[],
  correct: boolean,        // Pre-computed correctness
  pools: string[],         // ['easy', 'medium', 'hard']
  radio_fit: number,       // 0-1 similarity score
  audio_sim: number,       // 0-1 audio similarity
  genre_sim: number,       // 0-1 genre similarity
  era_dist: number,        // Years apart from seed
  tier: number,            // 1-5, 1=closest
  // Spotify audio features:
  danceability: number,    // 0-1
  energy: number,          // 0-1
  valence: number,         // 0-1
  acousticness: number,    // 0-1
  instrumentalness: number,// 0-1
  liveness: number,        // 0-1
  speechiness: number,     // 0-1
  tempo: number,           // BPM
  loudness: number,        // dB
  mode: number,            // 0 or 1
  key: number,             // 0-11
  time_signature: number   // 3, 4, 5, 7
}
```

---

## Common Pitfalls & Solutions

### Problem: Artists not displaying
**Cause:** Treating artists as string when it's an array
**Solution:**
```javascript
const artistStr = Array.isArray(track.artists)
  ? track.artists.join(', ')
  : track.artists;
```

### Problem: Track incorrectly marked as wrong
**Cause:** Not checking profile's `correct` flag
**Solution:**
```javascript
const isCorrect = song.correct === true || song.isCorrect === true;
```

### Problem: Duplicate guesses not prevented
**Cause:** Track key doesn't match format in Set
**Solution:** Always create keys the same way:
```javascript
const trackKey = `${Array.isArray(artists) ? artists.join(', ') : artists}-${track_name}`;
```

### Problem: No tracks in difficulty pool
**Cause:** Profile not loaded or wrong difficulty key
**Solution:** Always fallback to medium:
```javascript
const pool = profile.pools[difficulty] || profile.pools.medium || [];
```

### Problem: Challenge hints showing wrong tracks
**Cause:** Not handling artist arrays in display
**Solution:**
```javascript
const hint = matches.map(s => {
  const artistStr = Array.isArray(s.artists) ? s.artists.join(', ') : s.artists;
  return `${artistStr} - ${s.track_name}`;
}).join('\n');
```

---

## Development Checklist

When making changes, verify:
- [ ] Artists displayed correctly (handle arrays)
- [ ] Profile data not transformed/normalized
- [ ] Track keys created consistently
- [ ] Correctness checked via `track.correct` flag
- [ ] Difficulty pool fallback to medium exists
- [ ] useGameState used for all game data
- [ ] Components only receive props, don't mutate
- [ ] Callbacks used to update parent state

---

## File Reference

**Core Files:**
- `src/RadioPuzzleGame.jsx` - Main game orchestrator, phase management
- `src/hooks/useGameState.js` - Central state management
- `src/constants/gameConfig.js` - Challenges and constants

**Phase Components:**
- `src/components/game/GenreConstellationSelect.jsx` - Track selection
- `src/components/game/DraftPhase.jsx` - Seed + challenge drafting
- `src/components/game/GuessPhase.jsx` - Main gameplay
- `src/components/game/ScorePhase.jsx` - Results

**Utilities:**
- `src/utils/gameUtils.js` - Hint generation, similarity (deprecated)
- `public/profiles/*.json` - Pre-computed track data (source of truth)

---

## Quick Reference: Making a Guess

```javascript
// 1. User clicks option in GuessPhase
onGuess(song)

// 2. RadioPuzzleGame.handleGuess() validates
const artistStr = Array.isArray(song.artists) ? song.artists.join(', ') : song.artists;
const trackKey = `${artistStr}-${song.track_name}`;

// Check not duplicate
if (gameState.state.guessedTracks.has(trackKey)) return;

// 3. Check correctness from profile
const isCorrect = song.correct === true || song.isCorrect === true;

// 4. If wrong, generate feedback
if (!isCorrect) {
  const feedback = generateFeedback(song, gameState.state.seed);
  gameState.addGuess({
    id: Date.now(),
    artist: artistStr,
    song: song.track_name,
    incorrect: true,
    feedback
  }, trackKey);
}

// 5. If correct, calculate points
else {
  const challengeScores = gameState.state.challenges.map(c =>
    c && c.check(song, gameState.state.seed) ? Math.random() * 100 : 0
  );

  gameState.addGuess({
    id: Date.now(),
    artist: artistStr,
    song: song.track_name,
    basePoints: 10,
    challengeScores,
    incorrect: false
  }, trackKey);

  // 6. Auto-assign to challenges
  autoAssignChallenges([...gameState.state.guesses, newGuess]);
}

// 7. Generate new options
generateMultipleChoice();
```

---

## End of Architecture Document
