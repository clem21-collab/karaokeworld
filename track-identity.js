/* KaraokeWorld — Track Identity Engine v0.1
   Foundation for matching an exact recording before lyrics are selected.
   This module does not replace the current player yet.
*/

const KWTrackIdentity = (() => {
  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(official|officiel|video|clip|audio|lyrics?|paroles|hd|4k)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const VERSION_WORDS = [
    "live", "remaster", "remastered", "acoustic", "acoustique",
    "instrumental", "karaoke", "radio edit", "edit", "extended",
    "remix", "mix", "version", "concert"
  ];

  const versionTags = text => {
    const n = normalize(text);
    return VERSION_WORDS.filter(tag => n.includes(normalize(tag)));
  };

  const similarity = (a, b) => {
    const A = new Set(normalize(a).split(" ").filter(Boolean));
    const B = new Set(normalize(b).split(" ").filter(Boolean));
    if (!A.size || !B.size) return 0;
    let common = 0;
    A.forEach(x => { if (B.has(x)) common++; });
    return (2 * common) / (A.size + B.size);
  };

  function identifyCandidate(query, candidate) {
    const titleScore = similarity(query.title, candidate.title);
    const artistScore = similarity(query.artist, candidate.artist);
    const wantedTags = versionTags(`${query.title || ""} ${query.version || ""}`);
    const gotTags = versionTags(`${candidate.title || ""} ${candidate.version || ""}`);
    const versionMismatch = [...new Set([...wantedTags, ...gotTags])]
      .some(tag => wantedTags.includes(tag) !== gotTags.includes(tag));

    let durationScore = null;
    if (Number.isFinite(query.duration) && Number.isFinite(candidate.duration)) {
      const gap = Math.abs(query.duration - candidate.duration);
      durationScore = Math.max(0, 1 - gap / 12);
    }

    let score = titleScore * 50 + artistScore * 35;
    if (durationScore !== null) score += durationScore * 15;
    if (versionMismatch) score -= 25;
    if (query.isrc && candidate.isrc) score += query.isrc === candidate.isrc ? 100 : -100;

    const confidence = score >= 90 ? "exact" : score >= 70 ? "probable" : "weak";
    return {
      ...candidate,
      match: {
        score: Math.round(score), confidence, titleScore, artistScore,
        durationScore, versionMismatch,
        exactIsrc: Boolean(query.isrc && candidate.isrc && query.isrc === candidate.isrc)
      }
    };
  }

  function rank(query, candidates = []) {
    return candidates
      .map(candidate => identifyCandidate(query, candidate))
      .sort((a, b) => b.match.score - a.match.score);
  }

  function recordingKey(track) {
    if (track.isrc) return `isrc:${String(track.isrc).toUpperCase()}`;
    return ["meta", normalize(track.artist), normalize(track.title), Math.round(track.duration || 0)].join(":");
  }

  // LRCLIB remains only one provider. A result is not trusted unless the
  // recording identity is sufficiently close to the track being played.
  async function searchLrclib(track) {
    const p = new URLSearchParams();
    if (track.title) p.set("track_name", track.title);
    if (track.artist) p.set("artist_name", track.artist);
    const res = await fetch(`https://lrclib.net/api/search?${p}`, {
      headers: { "Lrclib-Client": "KaraokeWorld/track-identity-v0.1" }
    });
    if (!res.ok) throw new Error(`LRCLIB ${res.status}`);
    const rows = await res.json();
    return rank(track, rows.map(x => ({
      provider: "lrclib", providerId: x.id,
      title: x.trackName, artist: x.artistName, album: x.albumName,
      duration: Number(x.duration), syncedLyrics: x.syncedLyrics,
      plainLyrics: x.plainLyrics, hasWordSync: Boolean(x.hasWordSync)
    })));
  }

  // Apple Music support is intentionally adapter-only for now: KaraokeWorld
  // can rank catalog records (including ISRC) once MusicKit credentials are configured.
  function rankAppleMusic(track, songs = []) {
    return rank(track, songs.map(song => ({
      provider: "apple-music",
      providerId: song.id,
      title: song.attributes?.name,
      artist: song.attributes?.artistName,
      album: song.attributes?.albumName,
      duration: Number(song.attributes?.durationInMillis || 0) / 1000,
      isrc: song.attributes?.isrc || null,
      raw: song
    })));
  }

  function chooseLyrics(track, providerResults = []) {
    const ranked = rank(track, providerResults);
    const best = ranked[0] || null;
    if (!best || best.match.confidence === "weak") {
      return { status: "no-reliable-match", best: null, candidates: ranked };
    }
    return { status: best.match.confidence, best, candidates: ranked };
  }

  return { normalize, versionTags, identifyCandidate, rank, recordingKey, searchLrclib, rankAppleMusic, chooseLyrics };
})();

window.KWTrackIdentity = KWTrackIdentity;
