import { isChord, normalizeNotation } from './chordpro.js';

const SECTION_WORDS = [
  'uvod', 'strofa', 'refren', 'solo', 'most', 'bridge', 'kraj', 'outro',
  'intro', 'pretrefren', 'instrumental', 'zavrsetak', 'završetak', 'coda'
];

const TAB_WIDTH = 4;

function expandTabs(line) {
  let out = '';
  for (const char of line) {
    if (char === '\t') out += ' '.repeat(TAB_WIDTH - (out.length % TAB_WIDTH));
    else out += char;
  }
  return out;
}

/**
 * Cleans a single chord token from OCR noise symbols, quotes, and artifacts.
 */
export function cleanChordToken(token) {
  if (!token) return '';
  let cleaned = token
    .replace(/[™®©°^~*]/g, '')
    .replace(/^[\[({|/'"`.,:;_\-]+|[\])}|/'"`.,:;_\-]+$/g, '')
    .replace(/\b([A-H][#b]?)rn\b/g, '$1m')
    .trim();

  // Fix common OCR case glitch where 'Gm' or 'Cm' OCRs as 'GM' or 'CM'
  if (/^[A-H][#b]?M$/.test(cleaned)) {
    cleaned = cleaned.slice(0, -1) + 'm';
  }

  // Fix 'ES' in ex-Yu songbooks representing Eb / D#
  if (cleaned.toUpperCase() === 'ES') {
    cleaned = 'Eb';
  }

  return cleaned;
}

/**
 * Cleans up OCR recognition artifacts in chord sheets.
 */
export function cleanOcrText(rawText) {
  if (!rawText) return '';

  return rawText
    .replace(/\r\n?/g, '\n')
    // Remove typical OCR symbol junk attached to chords or letters
    .replace(/[™®©°^~*]/g, '')
    // Replace smart quotes and unusual punctuation
    .replace(/[„“”]/g, '"')
    .replace(/[’‘`]/g, "'")
    .replace(/[–—]/g, '-')
    // Replace sequences of dots used as tabs/spacers between chords
    .replace(/\.{2,}/g, '  ')
    // Fix glued chords separated by quotes: Cm'Cm -> Cm Cm
    .replace(/([A-H][#b]?m?[0-9]?)\s*['"`]\s*([A-H])/g, '$1 $2')
    // Replace common OCR chord character glitches (e.g. 'rn' for 'm' in 'Am', 'F#m')
    .replace(/\b([A-H][#b]?)rn\b/g, '$1m')
    // Remove isolated table column bars if they are noise
    .replace(/^\|\s*/gm, '')
    .replace(/\s*\|$/gm, '')
    .trim();
}

/** Check if every non-empty token on the line is a recognized chord */
export function isChordLine(line) {
  const cleanedLine = cleanOcrText(line);
  // Split on whitespace or multiple dots
  const tokens = cleanedLine.trim().split(/[\s.]+/).filter(Boolean);
  if (!tokens.length) return false;

  return tokens.every((token) => {
    const stripped = cleanChordToken(token);
    return isChord(stripped);
  });
}

function formatSectionTitle(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function detectSection(line) {
  const cleaned = cleanOcrText(line).trim().replace(/^\[|\]$/g, '').replace(/[:.\-–—]+$/, '').trim();
  if (!cleaned || cleaned.length > 40) return null;

  // Check for lines like "UVOD - D7 ES D7 GM"
  const sectionSplit = cleaned.match(/^([A-Za-zčćžšđČĆŽŠĐ]+)\s*[-–—:]\s*(.*)$/);
  if (sectionSplit) {
    const firstWord = sectionSplit[1].toLowerCase();
    if (SECTION_WORDS.includes(firstWord)) {
      return formatSectionTitle(sectionSplit[1]);
    }
  }

  const first = cleaned.toLowerCase().split(/\s+/)[0];
  return SECTION_WORDS.includes(first) ? formatSectionTitle(cleaned) : null;
}

export function readChordPositions(line) {
  const positions = [];
  const pattern = /\S+/g;
  let match;

  while ((match = pattern.exec(line)) !== null) {
    const rawChord = cleanChordToken(match[0]);
    if (isChord(rawChord)) {
      positions.push({ chord: rawChord, column: match.index });
    }
  }
  return positions;
}

function snapToWord(text, index) {
  if (index <= 0 || index >= text.length) return Math.max(0, Math.min(index, text.length));

  if (/\s/.test(text[index])) {
    let forward = index;
    while (forward < text.length && /\s/.test(text[forward])) forward++;
    return forward < text.length ? forward : index;
  }

  const insideWord = /\S/.test(text[index]) && /\S/.test(text[index - 1]);
  if (!insideWord) return index;

  let start = index;
  while (start > 0 && /\S/.test(text[start - 1])) start--;

  let next = index;
  while (next < text.length && /\S/.test(text[next])) next++;
  while (next < text.length && /\s/.test(text[next])) next++;

  if (next >= text.length) return start;
  return (next - index) < (index - start) ? next : start;
}

function mergeChordsIntoLyric(chords, lyric) {
  let out = lyric;
  let lastAt = Infinity;

  for (const { chord, column } of [...chords].reverse()) {
    let at = snapToWord(out, Math.min(column, out.length));
    if (at >= lastAt) at = Math.max(0, Math.min(column, out.length));
    lastAt = at;

    out = out.slice(0, at) + '[' + chord + ']' + out.slice(at);
  }
  return out;
}

/**
 * Pixel-accurate spatial alignment matching chords to words based on OCR bounding boxes.
 */
export function convertOcrBboxDataToChordPro(ocrData) {
  if (!ocrData?.lines || !ocrData.lines.length) {
    return convertOcrToChordPro(ocrData?.text || '');
  }

  const rawLines = ocrData.lines.filter((l) => l.text && l.text.trim().length > 0);
  if (!rawLines.length) return { content: '', chords: [], title: '', artist: '', originalKey: '' };

  const out = [];
  const seenChords = new Set();
  let detectedTitle = '';
  let detectedArtist = '';
  let detectedKey = '';

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const lineText = cleanOcrText(line.text);

    // Check for Title / Artist header
    if (i === 0 || i === 1) {
      const keyMatch = lineText.match(/(?:Tonalitet|Key|Ton)\s*[:=-]\s*([A-H][#b]?m?)/i);
      if (keyMatch) {
        detectedKey = keyMatch[1];
        continue;
      }
      const titleArtistMatch = lineText.match(/^([^–—\-\n]+)\s*[-–—]\s*([^–—\-\n]+)$/);
      if (titleArtistMatch && !isChordLine(lineText) && !detectSection(lineText)) {
        detectedArtist = titleArtistMatch[1].trim();
        detectedTitle = titleArtistMatch[2].trim();
        continue;
      }
    }

    const section = detectSection(lineText);
    if (section && !isChordLine(lineText)) {
      out.push('[' + section + ']');
      // If the section line also has chords attached after a hyphen, e.g. "UVOD - D7 ES D7 GM"
      const afterSectionMatch = lineText.match(/^.+?[-–—:]\s*(.+)$/);
      if (afterSectionMatch) {
        const remainingChords = afterSectionMatch[1].split(/[\s.]+/).map(cleanChordToken).filter(isChord);
        if (remainingChords.length) {
          remainingChords.forEach((c) => seenChords.add(c));
          out.push(remainingChords.map((c) => `[${c}]`).join(' '));
        }
      }
      continue;
    }

    if (isChordLine(lineText)) {
      // Split line words or chords
      const words = line.words || [];
      const chordWords = [];

      for (const w of words) {
        // Clean individual tokens and handle glued chords (e.g. Cm'Cm)
        const subTokens = cleanOcrText(w.text).split(/[\s.]+/).filter(Boolean);
        for (const sub of subTokens) {
          const rawToken = cleanChordToken(sub);
          if (isChord(rawToken)) {
            chordWords.push({ chord: rawToken, bbox: w.bbox || line.bbox });
          }
        }
      }

      chordWords.forEach((c) => seenChords.add(c.chord));

      const nextLine = rawLines[i + 1];
      const nextIsLyric = nextLine && !isChordLine(cleanOcrText(nextLine.text)) && !detectSection(cleanOcrText(nextLine.text));

      if (nextIsLyric && nextLine.words && nextLine.words.length) {
        const lyricWords = nextLine.words
          .map((w) => ({ text: w.text, bbox: w.bbox || nextLine.bbox }))
          .filter((w) => w.text && w.text.trim().length > 0);

        // Assign each chord to the closest/overlapping lyric word index
        const chordAssignments = new Map();
        for (const c of chordWords) {
          const chordCenterX = (c.bbox.x0 + c.bbox.x1) / 2;
          let bestIdx = 0;
          let bestDist = Infinity;

          for (let wIdx = 0; wIdx < lyricWords.length; wIdx++) {
            const w = lyricWords[wIdx];
            const wordStart = w.bbox.x0;
            const wordEnd = w.bbox.x1;

            if (chordCenterX >= wordStart - 15 && chordCenterX <= wordEnd + 15) {
              bestIdx = wIdx;
              break;
            }

            const dist = Math.abs(chordCenterX - wordStart);
            if (dist < bestDist) {
              bestDist = dist;
              bestIdx = wIdx;
            }
          }

          const existing = chordAssignments.get(bestIdx) || [];
          existing.push(c.chord);
          chordAssignments.set(bestIdx, existing);
        }

        // Construct the combined line
        const mergedTokens = lyricWords.map((w, idx) => {
          const chords = chordAssignments.get(idx);
          if (chords && chords.length) {
            return chords.map((ch) => `[${ch}]`).join('') + w.text;
          }
          return w.text;
        });

        out.push(mergedTokens.join(' '));
        i++; // skip next line as it was consumed
      } else {
        // Instrumental chords
        out.push(chordWords.map((c) => `[${c.chord}]`).join(' '));
      }
    } else {
      out.push(lineText);
    }
  }

  const content = normalizeNotation(out.join('\n'));
  const chords = [...seenChords];
  if (!detectedKey && chords.length) detectedKey = chords[0];

  return {
    content,
    chords,
    title: detectedTitle,
    artist: detectedArtist,
    originalKey: detectedKey
  };
}

/**
 * Converts text-based input into ChordPro format.
 */
export function convertOcrToChordPro(input) {
  if (!input?.trim()) {
    return { content: '', chords: [], title: '', artist: '', originalKey: '' };
  }

  const cleanedInput = cleanOcrText(input);
  const lines = cleanedInput.split('\n').map(expandTabs);
  const out = [];
  const seenChords = new Set();
  let detectedTitle = '';
  let detectedArtist = '';
  let detectedKey = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      continue;
    }

    if (i === 0 || i === 1) {
      const keyMatch = line.match(/(?:Tonalitet|Key|Ton)\s*[:=-]\s*([A-H][#b]?m?)/i);
      if (keyMatch) {
        detectedKey = keyMatch[1];
        continue;
      }
      const titleArtistMatch = line.match(/^([^–—\-\n]+)\s*[-–—]\s*([^–—\-\n]+)$/);
      if (titleArtistMatch && !isChordLine(line) && !detectSection(line)) {
        detectedArtist = titleArtistMatch[1].trim();
        detectedTitle = titleArtistMatch[2].trim();
        continue;
      }
    }

    const section = detectSection(line);
    if (section && !isChordLine(line)) {
      out.push('[' + section + ']');
      // Check if section line has chords attached
      const afterSectionMatch = line.match(/^.+?[-–—:]\s*(.+)$/);
      if (afterSectionMatch) {
        const remainingChords = afterSectionMatch[1].split(/[\s.]+/).map(cleanChordToken).filter(isChord);
        if (remainingChords.length) {
          remainingChords.forEach((c) => seenChords.add(c));
          out.push(remainingChords.map((c) => `[${c}]`).join(' '));
        }
      }
      continue;
    }

    if (isChordLine(line)) {
      const chords = readChordPositions(line);
      chords.forEach((c) => seenChords.add(c.chord));

      const next = lines[i + 1];
      const nextIsLyric = next !== undefined && next.trim() && !isChordLine(next) && !detectSection(next);

      if (nextIsLyric) {
        out.push(mergeChordsIntoLyric(chords, next));
        i++;
      } else {
        out.push(chords.map((c) => `[${c.chord}]`).join(' '));
      }
    } else {
      out.push(line.trim());
    }
  }

  const content = normalizeNotation(out.join('\n'));
  const chords = [...seenChords];

  if (!detectedKey && chords.length) {
    detectedKey = chords[0];
  }

  return {
    content,
    chords,
    title: detectedTitle,
    artist: detectedArtist,
    originalKey: detectedKey
  };
}
