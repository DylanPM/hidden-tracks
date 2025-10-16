// Tiny PKCE helpers and token utils (client only)

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+/g, "");

const randomString = (len = 64) => {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return b64url(arr);
};

const sha256 = async (text) => {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return b64url(hash);
};

const CLIENT_ID = import.meta?.env?.VITE_SPOTIFY_CLIENT_ID
  || process.env?.NEXT_PUBLIC_SPOTIFY_CLIENT_ID
  || process.env?.REACT_APP_SPOTIFY_CLIENT_ID;

const REDIRECT_URI = (() => {
  // Prefer explicit env, else infer /callback on current origin
  const fromEnv = import.meta?.env?.VITE_SPOTIFY_REDIRECT_URI
    || process.env?.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI
    || process.env?.REACT_APP_SPOTIFY_REDIRECT_URI;
  if (fromEnv) return fromEnv;
  return `${window.location.origin}/callback`;
})();

const SCOPE = [
  "user-top-read",
  "user-read-recently-played"
].join(" ");

const LS = {
  access: "spotify_token",
  refresh: "spotify_refresh",
  exp: "spotify_token_expires_at",
};

export const startLogin = async () => {
  const verifier = randomString(64);
  const challenge = await sha256(verifier);
  sessionStorage.setItem("pkce_code_verifier", verifier);

  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("scope", SCOPE);

  // Important for iframe use. Break out to top window.
  window.top.location.href = url.toString();
};

const exchange = async (code) => {
  const verifier = sessionStorage.getItem("pkce_code_verifier");
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("token exchange failed");
  return res.json();
};

const refresh = async (refreshToken) => {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("refresh failed");
  return res.json();
};

export const handleCallback = async () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return null;

  const data = await exchange(code);
  const expiresAt = Date.now() + data.expires_in * 1000;

  localStorage.setItem(LS.access, data.access_token);
  if (data.refresh_token) localStorage.setItem(LS.refresh, data.refresh_token);
  localStorage.setItem(LS.exp, String(expiresAt));

  // Clean the URL
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, "", url.toString());

  return data.access_token;
};

export const getValidToken = async () => {
  const token = localStorage.getItem(LS.access);
  const exp = Number(localStorage.getItem(LS.exp) || "0");
  if (token && Date.now() < exp - 60_000) return token;

  const rt = localStorage.getItem(LS.refresh);
  if (!rt) return null;

  const data = await refresh(rt);
  const newExp = Date.now() + data.expires_in * 1000;
  localStorage.setItem(LS.access, data.access_token);
  localStorage.setItem(LS.exp, String(newExp));
  return data.access_token;
};

export const logoutSpotify = () => {
  localStorage.removeItem(LS.access);
  localStorage.removeItem(LS.refresh);
  localStorage.removeItem(LS.exp);
};
