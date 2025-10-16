// api/spotify-preview.js
let token = null;
let expAt = 0;

async function appToken() {
  if (token && Date.now() < expAt - 60_000) return token;
  const basic = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Token error ${r.status}: ${JSON.stringify(data)}`);
  token = data.access_token;
  expAt = Date.now() + data.expires_in * 1000;
  return token;
}

async function tracksByIds(ids, tk) {
  const url = `https://api.spotify.com/v1/tracks?ids=${encodeURIComponent(ids.join(','))}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } });
  const json = await r.json();
  if (!r.ok) throw new Error(`Tracks error ${r.status}: ${JSON.stringify(json)}`);
  return (json.tracks || []).map(t => ({
    id: t.id,
    name: t.name,
    preview_url: t.preview_url,      // can be null
    artists: (t.artists||[]).map(a=>a.name).join(', '),
    image: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || null
  }));
}

async function searchFirst(query, tk, market='US') {
  const u = new URL('https://api.spotify.com/v1/search');
  u.searchParams.set('type', 'track');
  u.searchParams.set('q', query);
  u.searchParams.set('limit', '1');
  u.searchParams.set('market', market);
  const r = await fetch(u, { headers: { Authorization: `Bearer ${tk}` } });
  const json = await r.json();
  if (!r.ok) throw new Error(`Search error ${r.status}: ${JSON.stringify(json)}`);
  const t = json.tracks?.items?.[0];
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    preview_url: t.preview_url,
    artists: (t.artists||[]).map(a=>a.name).join(', '),
    image: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || null
  };
}

export default async function handler(req, res) {
  try {
    const tk = await appToken();
    const { ids, query, market = 'US' } = req.query;

    if (ids) {
      const list = ids.split(',').map(s=>s.trim()).filter(Boolean);
      if (!list.length) return res.status(400).json({ error: 'no ids' });
      if (list.length > 50) return res.status(400).json({ error: 'max 50 ids' });
      const tracks = await tracksByIds(list, tk);
      return res.status(200).json({ tracks });
    }

    if (query) {
      const track = await searchFirst(query, tk, market);
      return res.status(200).json({ track });
    }

    return res.status(400).json({ error: 'use ?ids=ID1,ID2 or ?query=...' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'server error' });
  }
}
