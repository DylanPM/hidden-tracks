import { useReducer } from 'react';

const initialState = {
  seed: null,
  challenges: [null, null],
  radioPlaylist: [],
  guesses: [],
  guessedTracks: new Set(),
  challengePlacements: [null, null],
  multipleChoiceOptions: [],
  seedHints: [],
  revealedHints: [false, false, false],
  usedHints: [false, false, false],
  difficultyTier: 'medium',
};

const gameReducer = (state, action) => {
  switch (action.type) {
      case 'SET_DIFFICULTY_TIER':
      return { ...state, difficultyTier: action.payload };
    
      case 'SET_SEED':
      return { ...state, seed: action.payload };
    
    case 'SET_CHALLENGE':
      const newChallenges = [...state.challenges];
      newChallenges[action.index] = action.payload;
      return { ...state, challenges: newChallenges };
    
    case 'REMOVE_SEED':
      return { ...state, seed: null };
    
    case 'REMOVE_CHALLENGE':
      const updatedChallenges = [...state.challenges];
      updatedChallenges[action.index] = null;
      return { ...state, challenges: updatedChallenges };
    
    case 'SET_RADIO_PLAYLIST':
      return { ...state, radioPlaylist: action.payload };
    
    case 'SET_SEED_HINTS':
      return { ...state, seedHints: action.payload };
    
    case 'REVEAL_HINT':
      const newRevealed = [...state.revealedHints];
      newRevealed[action.index] = true;
      return { ...state, revealedHints: newRevealed };
    
    case 'USE_HINT':
      const newUsed = [...state.usedHints];
      newUsed[action.index] = true;
      return { ...state, usedHints: newUsed };
    
    case 'ADD_GUESS':
      return {
        ...state,
        guesses: [...state.guesses, action.payload],
        guessedTracks: new Set(state.guessedTracks).add(action.trackKey),
      };
    
    case 'SET_MULTIPLE_CHOICE':
      return { ...state, multipleChoiceOptions: action.payload };
    
    case 'SET_CHALLENGE_PLACEMENTS':
      return { ...state, challengePlacements: action.payload };
    
    case 'RESET_GAME':
      //return initialState;
      return { ...initialState, guessedTracks: new Set() };
    
    default:
      return state;
  }
};

export const useGameState = () => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  
  return {
    state,
    setDifficultyTier: (difficultyTier) => dispatch({ type: 'SET_DIFFICULTY_TIER', payload: difficultyTier }),
    setSeed: (seed) => dispatch({ type: 'SET_SEED', payload: seed }),
    setChallenge: (index, challenge) => dispatch({ type: 'SET_CHALLENGE', index, payload: challenge }),
    removeSeed: () => dispatch({ type: 'REMOVE_SEED' }),
    removeChallenge: (index) => dispatch({ type: 'REMOVE_CHALLENGE', index }),
    setRadioPlaylist: (playlist) => dispatch({ type: 'SET_RADIO_PLAYLIST', payload: playlist }),
    setSeedHints: (hints) => dispatch({ type: 'SET_SEED_HINTS', payload: hints }),
    revealHint: (index) => dispatch({ type: 'REVEAL_HINT', index }),
    useHint: (index) => dispatch({ type: 'USE_HINT', index }),
    addGuess: (guess, trackKey) => dispatch({ type: 'ADD_GUESS', payload: guess, trackKey }),
    setMultipleChoice: (options) => dispatch({ type: 'SET_MULTIPLE_CHOICE', payload: options }),
    setChallengePlacements: (placements) => dispatch({ type: 'SET_CHALLENGE_PLACEMENTS', payload: placements }),
    resetGame: () => dispatch({ type: 'RESET_GAME' }),
  };
};