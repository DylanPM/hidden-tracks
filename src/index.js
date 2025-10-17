import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import RadioPuzzleGame from './RadioPuzzleGame';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<RadioPuzzleGame />);

console.log("Build:", import.meta.env.VERCEL_GIT_COMMIT_SHA);
