import React from 'react';
import { Music } from 'lucide-react';
import { PREMADE_PROFILES } from '../../constants/profiles';
import { CLIENT_ID, REDIRECT_URI, SCOPES } from '../../constants/gameConfig';

export function ProfileSelect({ onSelectProfile, onStartTasteBuilder, authError, spotifyToken }) {
  const initiateSpotifyAuth = async () => {
    const generateRandomString = (length) => {
      const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const values = crypto.getRandomValues(new Uint8Array(length));
      return values.reduce((acc, x) => acc + possible[x % possible.length], "");
    };
    
    const generateCodeChallenge = async (verifier) => {
      const encoder = new TextEncoder();
      const data = encoder.encode(verifier);
      const digest = await crypto.subtle.digest('SHA-256', data);
      const bytes = new Uint8Array(digest);
      let str = '';
      bytes.forEach(byte => str += String.fromCharCode(byte));
      return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };
    
    const codeVerifier = generateRandomString(128);
    localStorage.setItem('spotify_code_verifier', codeVerifier);
    localStorage.setItem('spotify_auth_in_progress', 'true');
    
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    const authUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge
    });
    
    window.location.href = authUrl;
  };

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-4 text-center">Choose Your Vibe</h1>
        
        {authError && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-300 text-sm">{authError}</p>
          </div>
        )}
        
        {!spotifyToken && (
          <button
            onClick={initiateSpotifyAuth}
            className="w-full p-6 mb-6 bg-green-500 hover:bg-green-400 rounded-lg transition flex items-center justify-center gap-3"
          >
            <Music className="w-6 h-6 text-black" />
            <div className="text-left">
              <p className="text-black font-bold text-lg">Sign in with Spotify</p>
              <p className="text-black/70 text-sm">We'll analyze your taste automatically</p>
            </div>
          </button>
        )}
        
        <p className="text-zinc-400 text-center mb-4">Or choose a preset:</p>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          {Object.entries(PREMADE_PROFILES).map(([key, profile]) => (
            <button
              key={key}
              onClick={() => onSelectProfile(profile)}
              className="p-6 bg-zinc-900 border-2 border-zinc-700 rounded-lg hover:border-green-500 hover:bg-zinc-800 transition text-left"
            >
              <h3 className="text-white font-bold text-lg mb-2">{profile.name}</h3>
              <p className="text-zinc-400 text-sm">{profile.descriptor}</p>
            </button>
          ))}
        </div>

        <button
          onClick={onStartTasteBuilder}
          className="w-full p-6 bg-blue-500/20 border-2 border-blue-500 rounded-lg hover:bg-blue-500/30 transition"
        >
          <h3 className="text-white font-bold text-lg mb-2">Build My Taste</h3>
          <p className="text-zinc-300 text-sm">Answer 5 questions about your music preferences</p>
        </button>
      </div>
    </div>
  );
}