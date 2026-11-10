(() => {
  'use strict';
  const VERSION = '1.1.0';

  function youtubeId(value) {
    const input = String(value || '').trim();
    const valid = id => /^[\w-]{11}$/.test(id || '') ? id : '';
    if (valid(input)) return input;
    const embedded = input.match(/(?:^|[,;\s])a=([\w-]{11})(?=$|[,;\s])/);
    if (embedded) return embedded[1];
    try {
      const url = new URL(input);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      if (url.hostname === 'youtu.be') return valid(url.pathname.split('/')[1]);
      if (!/^(?:(?:www|m|music)\.)?youtube(?:-nocookie)?\.com$/.test(url.hostname)) return '';
      return valid(url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1]);
    } catch {
      return '';
    }
  }

  function decode(bytes) {
    const bom = bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le'
      : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be'
      : bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191 ? 'utf-8' : '';
    if (bom) return { source: new TextDecoder(bom).decode(bytes), encoding: bom, bom: true };
    try {
      return { source: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8', bom: false };
    } catch {
      return { source: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252', bom: false };
    }
  }

  function parse(source) {
    const meta = Object.create(null);
    const groups = [];
    let notes = [], player = '';
    function finish() {
      if (notes.length) groups.push({ notes, player });
      notes = [];
    }
    for (const line of source.split(/\r\n|\n|\r/)) {
      const header = line.match(/^\s*#([\w-]+)\s*:(.*)$/);
      if (header) {
        meta[header[1].toUpperCase()] = header[2].trim();
        continue;
      }
      if (/^\s*E\s*$/.test(line)) break;
      if (/^\s*-\s*(?:-?\d|$)/.test(line)) {
        finish();
        continue;
      }
      const singer = line.match(/^\s*P\s*([12])\s*$/i);
      if (singer) {
        finish();
        player = singer[1];
        continue;
      }
      const note = line.match(/^\s*([:*FRG])[ \t]+(-?\d+)[ \t]+(\d+)[ \t]+(-?\d+)(?:[ \t](.*))?$/);
      if (note) notes.push({ type: note[1], beat: Number(note[2]), duration: Number(note[3]), text: note[5] || '' });
    }
    finish();
    const bpm = Number(String(meta.BPM || '').replace(',', '.'));
    const gap = Number(String(meta.GAP ?? '0').replace(',', '.'));
    if (!Number.isFinite(bpm) || bpm <= 0) throw Error('#BPM absent ou invalide.');
    if (!Number.isFinite(gap)) throw Error('#GAP invalide.');
    if (/^yes$/i.test(meta.RELATIVE || '')) throw Error('Ce TXT utilise des temps relatifs. Exporte-le en temps absolus dans ton éditeur UltraStar.');
    if (!groups.length) throw Error('Aucune note UltraStar reconnue.');
    const beatMs = 60000 / (4 * bpm);
    for (const group of groups) {
      for (const note of group.notes) {
        note.start = gap + note.beat * beatMs;
        note.end = note.start + note.duration * beatMs;
      }
      group.start = Math.min(...group.notes.map(note => note.start));
      group.text = group.notes.map(note => note.text).join('').trim();
    }
    groups.sort((a, b) => a.start - b.start);
    return { meta, groups, bpm, gap, videoId: youtubeId(meta.YOUTUBE) || youtubeId(meta.VIDEO) };
  }

  function replaceHeader(source, key, value) {
    const pattern = new RegExp('^([ \\t]*#' + key + '[ \\t]*:[ \\t]*)[^\\r\\n]*', 'gim');
    const header = [...source.matchAll(pattern)].at(-1);
    if (header) return source.slice(0, header.index) + header[1] + value + source.slice(header.index + header[0].length);
    const newline = source.match(/\r\n|\n|\r/)?.[0] || '\n';
    return '#' + key + ':' + value + newline + source;
  }

  function exportText(source, gap, offset, videoId = '') {
    let result = offset ? replaceHeader(source, 'GAP', Math.round((gap + offset) * 1000) / 1000) : source;
    const existing = [...result.matchAll(/^[ \t]*#VIDEO[ \t]*:[ \t]*([^\r\n]*)/gim)];
    if (youtubeId(videoId) === videoId && videoId && existing.every(header => !header[1].trim() || youtubeId(header[1]))) {
      result = replaceHeader(result, 'VIDEO', 'a=' + videoId);
      if (/^[ \t]*#YOUTUBE[ \t]*:/im.test(result)) {
        result = replaceHeader(result, 'YOUTUBE', 'https://www.youtube.com/watch?v=' + videoId);
      }
    }
    return result;
  }

  function encode(source, file) {
    if (file.encoding === 'windows-1252') {
      const alphabet = new TextDecoder('windows-1252').decode(Uint8Array.from({ length: 256 }, (_, i) => i));
      const bytes = new Map([...alphabet].map((ch, i) => [ch, i]));
      return Uint8Array.from(source, ch => bytes.get(ch));
    }
    if (file.encoding.startsWith('utf-16')) {
      const bytes = new Uint8Array(2 + source.length * 2);
      const view = new DataView(bytes.buffer);
      const little = file.encoding === 'utf-16le';
      view.setUint16(0, 0xfeff, little);
      for (let i = 0; i < source.length; i++) view.setUint16(2 + i * 2, source.charCodeAt(i), little);
      return bytes;
    }
    return new TextEncoder().encode((file.bom ? '\ufeff' : '') + source);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { decode, encode, parse, exportText, youtubeId };
    return;
  }

  const $ = id => document.getElementById(id);
  if (!$('usSync')) return;
  let file, song, player, ready = false, offset = 0, request = 0, importRequest = 0, timer = 0;
  let loadedId = '', groups = [], displayed = -2, spans = [];
  const watch = id => 'https://www.youtube.com/watch?v=' + id;
  const status = message => { $('usVideoStatus').textContent = message; };
  const format = time => {
    const centiseconds = Math.round(time * 100);
    return Math.floor(centiseconds / 6000) + ':' + ((centiseconds % 6000) / 100).toFixed(2).padStart(5, '0');
  };

  function chooseGroups() {
    groups = song.groups.filter(group => !group.player || group.player === $('usSinger').value);
    displayed = -2;
    $('usPhrase').replaceChildren(...groups.map((group, i) =>
      new Option((i + 1) + ' · ' + (group.text || '♪'), String(i))));
    render();
  }

  function render() {
    const position = ready ? Number(player.getCurrentTime()) || 0 : 0;
    $('usTime').textContent = ready ? format(position) : '—';
    const time = position * 1000 - offset;
    let low = 0, high = groups.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (groups[middle].start <= time) low = middle + 1;
      else high = middle;
    }
    const index = low - 1;
    if (displayed !== index) {
      displayed = index;
      $('usPrevious').textContent = groups[index - 1]?.text || '';
      $('usNext').textContent = groups[index + 1]?.text || '';
      $('usCurrent').replaceChildren();
      spans = (groups[index]?.notes || []).map(note => {
        const span = document.createElement('span');
        span.className = 'us-sync-note';
        span.dataset.type = note.type;
        span.textContent = note.text;
        $('usCurrent').appendChild(span);
        return { span, note };
      });
      if (!spans.length) $('usCurrent').textContent = groups.length ? '♪ Intro ♪' : 'Importe un TXT UltraStar.';
    }
    for (const { span, note } of spans) {
      const progress = note.end > note.start ? Math.max(0, Math.min(1, (time - note.start) / (note.end - note.start))) : Number(time >= note.start);
      span.style.setProperty('--progress', progress * 100 + '%');
    }
  }

  function setOffset(value) {
    if (!Number.isFinite(value)) return;
    offset = Math.round(value);
    $('usOffset').value = offset;
    $('usGap').textContent = song ? 'GAP exporté ' + (Math.round((song.gap + offset) * 1000) / 1000) + ' ms' : '';
    render();
  }

  function controls(enabled) {
    ready = enabled;
    for (const id of ['usPlay', 'usPause', 'usBack', 'usForward', 'usJump']) $(id).disabled = !enabled;
  }

  async function loadVideo() {
    const id = youtubeId($('usUrl').value);
    if (!id) { status('Colle un lien YouTube valide.'); return; }
    const ticket = ++request;
    clearInterval(timer);
    controls(false);
    player?.destroy();
    player = null;
    loadedId = id;
    $('usWatch').href = watch(id);
    $('usWatch').hidden = false;
    const host = $('usPlayer');
    const mount = document.createElement('div');
    host.replaceChildren(mount);
    host.hidden = false;
    status('Chargement du lecteur YouTube…');
    for (let i = 0; i < 40 && !window.YT?.Player && ticket === request; i++) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (ticket !== request) return;
    if (!window.YT?.Player) {
      host.hidden = true;
      status('Impossible de charger le lecteur YouTube. Réessaie ou ouvre la vidéo sur YouTube.');
      return;
    }
    player = new YT.Player(mount, {
      videoId: id, width: '100%', height: '100%',
      playerVars: { playsinline: 1, origin: location.origin },
      events: {
        onReady: () => {
          if (ticket !== request) return;
          controls(true);
          status('Vidéo prête. Lance la lecture pour comparer les paroles.');
          timer = setInterval(render, 50);
          render();
        },
        onError: event => {
          if (ticket !== request) return;
          controls(false);
          clearInterval(timer);
          status([101, 150].includes(event.data)
            ? 'Le propriétaire refuse la lecture intégrée. Choisis une vidéo autorisant l’intégration.'
            : 'YouTube ne peut pas lire cette vidéo ici (code ' + event.data + '). Ouvre-la sur YouTube ou essaie un autre lien.');
        }
      }
    });
  }

  function seek(time) {
    if (!ready || !Number.isFinite(time)) return;
    const duration = player.getDuration();
    player.seekTo(Math.max(0, duration > 0 ? Math.min(time, duration) : time), true);
  }

  $('usVersion').textContent = 'v' + VERSION;
  $('usFile').addEventListener('change', async event => {
    const selected = event.target.files[0], ticket = ++importRequest;
    if (!selected) return;
    try {
      const decoded = decode(new Uint8Array(await selected.arrayBuffer()));
      const parsed = parse(decoded.source);
      if (ticket !== importRequest) return;
      file = { ...decoded, name: selected.name };
      song = parsed;
      const duet = song.groups.some(group => group.player === '2');
      $('usSingerLabel').hidden = !duet;
      $('usSinger').value = song.groups.some(group => group.player === '1') ? '1' : '2';
      $('usTitle').textContent = (song.meta.ARTIST || 'Artiste inconnu') + ' — ' + (song.meta.TITLE || selected.name);
      $('usMeta').textContent = 'BPM ' + song.bpm + ' · GAP ' + song.gap + ' ms · ' + song.groups.length + ' phrases';
      if (!$('usUrl').value && song.videoId) $('usUrl').value = watch(song.videoId);
      $('usSettings').disabled = false;
      $('usDownload').disabled = false;
      $('usImportStatus').textContent = selected.name + ' importé.';
      chooseGroups();
      setOffset(0);
    } catch (error) {
      if (ticket === importRequest) $('usImportStatus').textContent = error.message;
    } finally {
      if (ticket === importRequest) event.target.value = '';
    }
  });
  $('usExample').onclick = () => {
    $('usUrl').value = watch('if1EYYs16yM');
    status('Vidéo de Yannick sélectionnée. Importe ton TXT et vérifie le calage manuellement.');
  };
  $('usLoad').onclick = loadVideo;
  $('usUrl').addEventListener('keydown', event => { if (event.key === 'Enter') loadVideo(); });
  $('usPlay').onclick = () => player?.playVideo();
  $('usPause').onclick = () => player?.pauseVideo();
  $('usBack').onclick = () => seek(player?.getCurrentTime() - 5);
  $('usForward').onclick = () => seek(player?.getCurrentTime() + 5);
  $('usJump').onclick = () => {
    const group = groups[Number($('usPhrase').value)];
    if (group) seek((group.start + offset) / 1000 - 1);
  };
  $('usSinger').onchange = chooseGroups;
  $('usOffset').oninput = event => { if (event.target.value !== '') setOffset(Number(event.target.value)); };
  $('usReset').onclick = () => setOffset(0);
  for (const button of $('usSync').querySelectorAll('[data-us-offset]')) {
    button.onclick = () => setOffset(offset + Number(button.dataset.usOffset));
  }
  $('usDownload').onclick = () => {
    if (!file || !song) return;
    const id = $('usIncludeVideo').checked ? loadedId || youtubeId($('usUrl').value) : '';
    const source = exportText(file.source, song.gap, offset, id);
    const url = URL.createObjectURL(new Blob([encode(source, file)], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.txt$/i, '') + ' - synchronisé.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
})();

