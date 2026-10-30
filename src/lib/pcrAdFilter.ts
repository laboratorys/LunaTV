// PCR-based HLS ad filter (ported from LabTV/Kotlin, browser build).
// Detects separately-muxed ad segments by their TS PCR clock, groups them into
// lineages, and rebuilds a clean playlist. Also assembles the removed ad
// segments into a standalone m3u8 (absolute TS urls) for manual verification.

export const UNKNOWN = -1;

const TICKS_PER_SECOND = 90000;
const PACKET_SIZE = 188;
const BLOCK_BYTES = 16;
const PROBE_BYTES = 4096;
const SYNC_BYTE = 0x47;
const MIN_PACKETS = 8;
const MAX_PCR_BASE = 2 ** 33; // 8589934592; 33-bit PCR base upper bound (1L shl 33 in Kotlin)

const MIN_SEGMENTS = 20;
const MAX_SEGMENTS = 3000;
const MIN_ON_DEMAND_SECONDS = 120;
const MIN_LINEAGES = 2;
const MAX_REQUESTS = 400;
const CONCURRENCY = 12; // max parallel segment-head fetches
const COARSE_ANCHORS = 28; // anchors probed in the first (parallel) wave
const MAX_ANCHORS = 400; // upper bound for the anchor grid
const MIN_BLOCK_ANCHORS = 4; // use DISCONTINUITY blocks as anchors from this count
const MAX_RANGES = 60; // bail out when the clock resets this many times
const MIN_RESET_SAMPLE = 4; // intervals required before the reset heuristic fires
const MIN_READABLE_RATIO = 3;
const MAX_AD_SECONDS = 180;
const MAX_AD_RATIO = 0.15;
const MAX_TOTAL_AD_RATIO = 0.25;
const TOLERANCE_SECONDS = 1.0;

const LINE_BREAK = /\r\n|\n|\r/;
const ENDLIST = '#EXT-X-ENDLIST';
const PLAYLIST_TYPE_VOD = '#EXT-X-PLAYLIST-TYPE:VOD';
const EXTINF = '#EXTINF';
const DISCONTINUITY = '#EXT-X-DISCONTINUITY';
const STREAM_INF = '#EXT-X-STREAM-INF';
const BYTERANGE = '#EXT-X-BYTERANGE';
const DATE_TIME = '#EXT-X-PROGRAM-DATE-TIME';
const KEY = '#EXT-X-KEY';
const MEDIA_SEQUENCE = '#EXT-X-MEDIA-SEQUENCE';

const METHOD = 'METHOD';
const URI = 'URI';
const IV = 'IV';
const IV_BYTES = 16;
const IV_SEQUENCE_BYTES = 8;
const IV_HEX_LENGTH = 34;

export interface HlsKey {
  method: string;
  uri: string;
  iv: number[] | null;
  ivExplicit: boolean;
}

export interface Segment {
  lineIndex: number;
  tagStartIndex: number;
  url: string;
  startTime: number;
  duration: number;
  key: HlsKey | null;
  keyLineIndex: number;
  mediaSequence: number;
}

export interface PcrFilterResult {
  main: string;
  ads: string;
  adCount: number;
  adBreaks: number;
  removed: boolean;
  // Absolute urls of removed ad segments, for backend caching.
  adUrls: string[];
  // Set when the filter bailed out for an inconclusive reason (master
  // playlist, too few segments, live window, unreadable probes...). Only
  // results without this field are confident and safe to cache.
  skipped?: string;
}

const isDecryptable = (method: string) => method.toUpperCase() === 'AES-128';

function resolveUrl(baseUrl: string, url: string): string {
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

function parseLong(line: string): number {
  const v = line.substring(line.indexOf(':') + 1).trim();
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseDuration(line: string): number {
  const v = line
    .substring(line.indexOf(':') + 1)
    .split(',')[0]
    .trim();
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function hexToBytes(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < text.length; i += 2) {
    out.push(parseInt(text.substring(i, i + 2), 16));
  }
  return out;
}

function sequenceAsIv(sequence: number): number[] {
  const out = new Array(IV_BYTES).fill(0) as number[];
  for (let i = 0; i < IV_SEQUENCE_BYTES; i++) {
    out[IV_BYTES - 1 - i] = (sequence >>> (8 * i)) & 0xff;
  }
  return out;
}

function attrAfter(line: string, key: string): string {
  const idx = line.indexOf(`${key}=`);
  if (idx < 0) return '';
  let rest = line.substring(idx + key.length + 1);
  if (rest.startsWith('"')) {
    const end = rest.indexOf('"', 1);
    return end > 0 ? rest.substring(1, end) : rest.substring(1);
  }
  const comma = rest.indexOf(',');
  return comma > 0 ? rest.substring(0, comma) : rest;
}

function parseKey(line: string, sequence: number, baseUrl: string): HlsKey {
  const method = attrAfter(line, METHOD);
  if (!isDecryptable(method)) {
    return { method, uri: '', iv: null, ivExplicit: false };
  }
  const uri = attrAfter(line, URI);
  const ivText = attrAfter(line, IV).trim();
  let iv: number[] | null = null;
  if (
    ivText.toLowerCase().startsWith('0x') &&
    ivText.length === IV_HEX_LENGTH
  ) {
    iv = hexToBytes(ivText.substring(2));
  }
  const resolvedUri = resolveUrl(baseUrl, uri);
  const finalIv = iv ?? sequenceAsIv(sequence);
  return { method, uri: resolvedUri, iv: finalIv, ivExplicit: iv != null };
}

function isSegmentTag(line: string): boolean {
  return (
    line.startsWith(EXTINF) ||
    line.startsWith(BYTERANGE) ||
    line.startsWith(DATE_TIME)
  );
}

function tagStart(lines: string[], urlLineIndex: number): number {
  let start = urlLineIndex;
  let index = urlLineIndex - 1;
  while (index >= 0) {
    const line = lines[index].trim();
    if (line.length === 0) {
      index--;
      continue;
    }
    if (!isSegmentTag(line)) break;
    start = index;
    index--;
  }
  return start;
}

function discBefore(lines: string[], from: number): number {
  let index = from - 1;
  while (index >= 0) {
    const line = lines[index].trim();
    if (line.length === 0) {
      index--;
      continue;
    }
    if (!line.startsWith('#')) return -1;
    if (line === DISCONTINUITY) return index;
    index--;
  }
  return -1;
}

function parseSegments(lines: string[], baseUrl: string): Segment[] {
  const segments: Segment[] = [];
  let elapsed = 0;
  let duration = 0;
  let mediaSequence = 0;
  let key: HlsKey | null = null;
  let keyLine = -1;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (line.length === 0) continue;
    if (line.startsWith('#')) {
      if (line.startsWith(EXTINF)) duration = parseDuration(line);
      else if (line.startsWith(MEDIA_SEQUENCE)) mediaSequence = parseLong(line);
      else if (line.startsWith(KEY)) {
        key = parseKey(line, mediaSequence + segments.length, baseUrl);
        keyLine = index;
      }
      continue;
    }
    segments.push({
      lineIndex: index,
      tagStartIndex: tagStart(lines, index),
      url: resolveUrl(baseUrl, line),
      startTime: elapsed,
      duration,
      key,
      keyLineIndex: keyLine,
      mediaSequence: mediaSequence + segments.length,
    });
    elapsed += duration;
    duration = 0;
  }
  return segments;
}

// Uniform grid of segment indices, used as break candidates when the playlist
// carries too few DISCONTINUITY tags to build a useful anchor list.
function uniformGrid(count: number, limit: number): number[] {
  if (count <= limit) {
    const out: number[] = [];
    for (let i = 0; i < count; i++) out.push(i);
    return out;
  }
  const step = Math.max(1, Math.ceil(count / limit));
  const out: number[] = [];
  for (let i = 0; i < count; i += step) out.push(i);
  return out;
}

// Keep at most `limit` entries, always preserving the first and the last one.
function capAnchors(list: number[], limit: number): number[] {
  if (list.length <= limit) return list;
  const step = Math.max(1, Math.ceil(list.length / limit));
  const out: number[] = [];
  for (let i = 0; i < list.length; i += step) out.push(list[i]);
  if (out[out.length - 1] !== list[list.length - 1]) {
    out.push(list[list.length - 1]);
  }
  return out;
}

export function looksLikeTransportStream(
  buffer: Uint8Array,
  length: number,
): boolean {
  const packets = Math.floor(length / PACKET_SIZE);
  if (packets < MIN_PACKETS) return false;
  if (buffer[0] !== SYNC_BYTE) return false;
  let aligned = 1;
  for (let i = 1; i < packets; i++) {
    if (buffer[i * PACKET_SIZE] === SYNC_BYTE) aligned++;
  }
  return aligned * 2 >= packets;
}

export function firstPcr(buffer: Uint8Array, length: number): number {
  if (!looksLikeTransportStream(buffer, length)) return UNKNOWN;
  let index = 0;
  while (index <= length - PACKET_SIZE) {
    if (buffer[index] !== SYNC_BYTE) {
      index++;
      continue;
    }
    const afc = (buffer[index + 3] >>> 4) & 0x03;
    if (afc & 0x02) {
      const fieldLength = buffer[index + 4] & 0xff;
      if (fieldLength >= 7 && (buffer[index + 5] & 0x10) !== 0) {
        const b6 = buffer[index + 6] & 0xff;
        const b7 = buffer[index + 7] & 0xff;
        const b8 = buffer[index + 8] & 0xff;
        const b9 = buffer[index + 9] & 0xff;
        const b10 = buffer[index + 10] & 0xff;
        const value =
          b6 * 33554432 + // 2^25
          b7 * 131072 + // 2^17
          b8 * 512 + // 2^9
          b9 * 2 +
          b10 / 128;
        if (value >= 0 && value < MAX_PCR_BASE) return value;
      }
    }
    index += PACKET_SIZE;
  }
  return UNKNOWN;
}

async function aes128CbcDecrypt(
  data: Uint8Array<ArrayBuffer>,
  key: Uint8Array<ArrayBuffer>,
  iv: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return data;
  const cryptoKey = await subtle.importKey(
    'raw',
    key,
    { name: 'AES-ECB' },
    false,
    ['decrypt'],
  );
  const blocks = Math.floor(data.length / BLOCK_BYTES);
  const out = new Uint8Array(blocks * BLOCK_BYTES);
  let prev = iv;
  for (let i = 0; i < blocks; i++) {
    const cb = data.subarray(i * BLOCK_BYTES, (i + 1) * BLOCK_BYTES);
    const dec = new Uint8Array(
      await subtle.decrypt({ name: 'AES-ECB' }, cryptoKey, cb),
    );
    for (let j = 0; j < BLOCK_BYTES; j++) {
      out[i * BLOCK_BYTES + j] = dec[j] ^ prev[j];
    }
    prev = cb;
  }
  return out;
}

// Read at most `max` bytes from a response body, then cancel the stream so we
// never pull a whole (possibly multi-MB) segment just to peek at its head.
async function readUpTo(res: Response, max: number): Promise<Uint8Array> {
  const body = res.body as ReadableStream<Uint8Array> | null;
  if (!body || !body.getReader) {
    const ab = await res.arrayBuffer();
    return new Uint8Array(ab).subarray(0, max);
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  try {
    while (got < max) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        got += value.length;
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
  }
  const out = new Uint8Array(Math.min(got, max));
  let off = 0;
  for (const c of chunks) {
    const take = Math.min(c.length, max - off);
    out.set(c.subarray(0, take), off);
    off += take;
    if (off >= max) break;
  }
  return out;
}

// Browser probe: fetch the head of a TS segment and read its first PCR.
// No `Range` header is sent on purpose: a cross-origin Range request triggers a
// CORS preflight that most CDNs do not answer, whereas a plain GET (what HLS.js
// itself uses for playback) goes through. We still avoid downloading the whole
// segment by cancelling the stream once we have enough bytes.
export async function browserPcrProbe(
  url: string,
  key: HlsKey | null,
  log: (msg: string) => void = () => {},
): Promise<number> {
  const short = url.length > 64 ? url.slice(0, 64) + '…' : url;
  try {
    const res = await fetch(url);
    if (!res.ok && res.status !== 206) {
      log(`probe ${res.status} ${short}`);
      return UNKNOWN;
    }
    const buf = await readUpTo(res, PROBE_BYTES);
    if (buf.length < PACKET_SIZE) {
      log(`probe short ${buf.length}B ${short}`);
      return UNKNOWN;
    }
    if (key && isDecryptable(key.method) && key.uri) {
      try {
        const kres = await fetch(key.uri);
        if (!kres.ok) {
          log(`key ${kres.status} ${short}`);
          return UNKNOWN;
        }
        const kbuf = new Uint8Array(await kres.arrayBuffer());
        const iv = key.iv ? new Uint8Array(key.iv) : new Uint8Array(IV_BYTES);
        const plain = await aes128CbcDecrypt(
          new Uint8Array(buf),
          kbuf.slice(0, BLOCK_BYTES),
          iv,
        );
        const pcr = firstPcr(plain, plain.length);
        log(
          `probe encrypted ${short}: ${pcr === UNKNOWN ? 'no PCR in head' : 'PCR ok'}`,
        );
        return pcr;
      } catch (e) {
        log(`key fail ${short}: ${String(e)}`);
        return UNKNOWN;
      }
    }
    const pcr = firstPcr(buf, buf.length);
    log(`probe ${short}: ${pcr === UNKNOWN ? 'no PCR in head' : 'PCR ok'}`);
    return pcr;
  } catch (e) {
    log(`probe fail ${short}: ${String(e)}`);
    return UNKNOWN;
  }
}

class Lineage {
  firstSegment: number;
  ranges: Array<[number, number]> = [];
  expected = 0;
  duration = 0;
  constructor(firstSegment: number) {
    this.firstSegment = firstSegment;
  }
}

function keyIsSoleOwner(
  segments: Segment[],
  removed: boolean[],
  keyLine: number,
): boolean {
  const governed = segments
    .map((s, i) => ({ s, i }))
    .filter((x) => x.s.keyLineIndex === keyLine);
  return governed.length > 0 && governed.every((x) => removed[x.i]);
}

function rebuild(
  lines: string[],
  segments: Segment[],
  removed: boolean[],
  clockOf: number[],
): { main: string; ads: string } {
  const drop = new Array(lines.length).fill(false);

  for (let i = 0; i < segments.length; i++) {
    if (!removed[i]) continue;
    for (
      let line = segments[i].tagStartIndex;
      line <= segments[i].lineIndex;
      line++
    ) {
      drop[line] = true;
    }
    const kl = segments[i].keyLineIndex;
    if (kl >= 0 && keyIsSoleOwner(segments, removed, kl)) {
      drop[kl] = true;
    }
  }

  const nearestKeptBefore = new Array(segments.length).fill(-1);
  let nearest = -1;
  for (let i = 0; i < segments.length; i++) {
    if (!removed[i]) nearest = i;
    nearestKeptBefore[i] = nearest;
  }
  const nearestKeptAfter = new Array(segments.length).fill(-1);
  nearest = -1;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (!removed[i]) nearest = i;
    nearestKeptAfter[i] = nearest;
  }

  for (let i = 0; i < segments.length; i++) {
    if (i === 0) {
      if (!removed[0]) continue;
    } else if (!removed[i - 1] && !removed[i]) {
      continue;
    }
    const discLine = discBefore(lines, segments[i].tagStartIndex);
    if (discLine < 0) continue;
    const left = i > 0 ? nearestKeptBefore[i - 1] : -1;
    const right = nearestKeptAfter[i];
    if (left < 0 || right < 0) {
      drop[discLine] = true;
      continue;
    }
    const leftClock = clockOf[left];
    const rightClock = clockOf[right];
    if (Number.isNaN(leftClock) || Number.isNaN(rightClock)) continue;
    if (
      Math.abs(rightClock - (leftClock + segments[left].duration)) <=
      TOLERANCE_SECONDS
    ) {
      drop[discLine] = true;
    }
  }

  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!drop[i]) kept.push(lines[i]);
  }
  const main = kept.join('\n');

  // Assemble the removed ad segments into a standalone, playable m3u8. Relative
  // TS urls are replaced with their resolved absolute addresses.
  const adLineSet = new Set<number>();
  for (let i = 0; i < segments.length; i++) {
    if (!removed[i]) continue;
    for (
      let line = segments[i].tagStartIndex;
      line <= segments[i].lineIndex;
      line++
    ) {
      adLineSet.add(line);
    }
    if (segments[i].keyLineIndex >= 0) adLineSet.add(segments[i].keyLineIndex);
  }
  const adLines: string[] = ['#EXTM3U'];
  const sorted = Array.from(adLineSet).sort((a, b) => a - b);
  for (const lineIdx of sorted) {
    const seg = segments.find((s) => s.lineIndex === lineIdx);
    if (seg) {
      for (let l = seg.tagStartIndex; l <= seg.lineIndex; l++) {
        adLines.push(l === seg.lineIndex ? seg.url : lines[l]);
      }
    } else {
      adLines.push(lines[lineIdx] ?? '');
    }
  }
  adLines.push(ENDLIST);
  const ads = adLines.join('\n');

  return { main, ads };
}

// Apply a previously computed set of ad urls (e.g. from the backend cache) to
// a freshly fetched playlist: drop the segments whose resolved url is in the
// set, together with their tag lines. Returns the original text untouched if
// nothing matches.
export function applyAdUrls(
  text: string,
  baseUrl: string,
  adUrls: string[],
): string {
  if (!adUrls.length) return text;
  const lines = text.split(LINE_BREAK);
  if (lines[0]?.trim() !== '#EXTM3U') return text;
  const segments = parseSegments(lines, baseUrl);
  const adSet = new Set(adUrls);
  const removed = segments.map((s) => adSet.has(s.url));
  if (!removed.some(Boolean)) return text;
  const clockOf = new Array(segments.length).fill(NaN);
  return rebuild(lines, segments, removed, clockOf).main;
}

export async function filterAdsByPcr(
  text: string,
  baseUrl: string,
  probe: (
    url: string,
    key: HlsKey | null,
    log?: (msg: string) => void,
  ) => Promise<number>,
  log: (msg: string) => void = () => {},
): Promise<PcrFilterResult> {
  const noChange = (reason?: string): PcrFilterResult => ({
    main: text,
    ads: '',
    adCount: 0,
    adBreaks: 0,
    removed: false,
    adUrls: [],
    ...(reason ? { skipped: reason } : {}),
  });

  if (text.includes(STREAM_INF)) {
    log('skip: multivariant master');
    return noChange('master');
  }

  const lines = text.split(LINE_BREAK);
  const segments = parseSegments(lines, baseUrl);
  const duration = segments.length
    ? segments[segments.length - 1].startTime +
      segments[segments.length - 1].duration
    : 0;
  const endlist = text.includes(ENDLIST);
  const explicitVod = text.includes(PLAYLIST_TYPE_VOD);

  if (segments.length < MIN_SEGMENTS) {
    log(`skip: only ${segments.length} segments`);
    return noChange('few segments');
  }
  if (segments.length > MAX_SEGMENTS) {
    log(`skip: ${segments.length} segments exceeds filter capacity`);
    return noChange('capacity');
  }
  if (!endlist && !explicitVod && duration < MIN_ON_DEMAND_SECONDS) {
    log(`skip: looks like a live window (${Math.round(duration)}s)`);
    return noChange('live window');
  }

  const caches = new Map<number, number>();
  let requests = 0;
  let unreadable = 0;

  // Bound parallel probe() calls so the concurrent pcrOf() requests below
  // (the anchor wave) don't open unbounded sockets at once.
  let active = 0;
  const waiters: Array<() => void> = [];
  const acquire = (): Promise<void> => {
    if (active < CONCURRENCY) {
      active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => waiters.push(resolve));
  };
  const release = (): void => {
    // Hand the permit straight to the next waiter, otherwise it would be
    // counted twice and the effective concurrency would creep upwards.
    const next = waiters.shift();
    if (next) {
      next();
      return;
    }
    active--;
  };
  const limitedProbe = async (
    url: string,
    key: HlsKey | null,
  ): Promise<number> => {
    await acquire();
    try {
      return await probe(url, key, log);
    } finally {
      release();
    }
  };

  const pcrOf = async (index: number): Promise<number> => {
    const cached = caches.get(index);
    if (cached !== undefined) return cached;
    requests++;
    if (requests > MAX_REQUESTS) return UNKNOWN;
    const seg = segments[index];
    const value = await limitedProbe(seg.url, seg.key);
    caches.set(index, value);
    if (value === UNKNOWN) unreadable++;
    return value;
  };

  // Probe both endpoints at once; the two head-fetches run in parallel.
  const continuous = async (from: number, to: number): Promise<boolean> => {
    const [a, b] = await Promise.all([pcrOf(from), pcrOf(to)]);
    if (a === UNKNOWN || b === UNKNOWN) return false;
    const expected =
      a / TICKS_PER_SECOND +
      (segments[to].startTime - segments[from].startTime);
    return Math.abs(b / TICKS_PER_SECOND - expected) <= TOLERANCE_SECONDS;
  };

  const giveUpOnReadings = (): boolean => {
    if (requests < unreadable * MIN_READABLE_RATIO) {
      log(`skip: only ${requests - unreadable} of ${requests} readings usable`);
      return true;
    }
    return false;
  };

  const last = segments.length - 1;
  if (await continuous(0, last)) {
    log('single mux (first/last continuous), no ad');
    return noChange();
  }
  // Anchor grid: candidate positions where a clock break can start.
  // DISCONTINUITY tags mark the natural block boundaries, so when the playlist
  // is densely tagged we search those (a few dozen candidates) instead of all
  // segments; otherwise fall back to an even segment grid.
  const blockStarts: number[] = [0];
  for (let i = 1; i < segments.length; i++) {
    if (discBefore(lines, segments[i].tagStartIndex) >= 0) blockStarts.push(i);
  }
  let anchors =
    blockStarts.length >= MIN_BLOCK_ANCHORS
      ? blockStarts
      : uniformGrid(segments.length, MAX_ANCHORS);
  anchors = capAnchors(anchors, MAX_ANCHORS);
  if (anchors[anchors.length - 1] !== last) anchors.push(last);

  // Wave 1: probe a sparse subset of the anchors concurrently. Everything the
  // sequential walk below needs is then already cached, so walking the timeline
  // costs zero extra requests until a break is actually found.
  const gridStep = Math.max(
    1,
    Math.ceil((anchors.length - 1) / COARSE_ANCHORS),
  );
  const coarse: number[] = [];
  for (let i = 0; i < anchors.length; i += gridStep) coarse.push(i);
  if (coarse[coarse.length - 1] !== anchors.length - 1) {
    coarse.push(anchors.length - 1);
  }
  await Promise.all(coarse.map((i) => pcrOf(anchors[i])));

  // A playlist whose clock restarts on nearly every interval is not ad-muxed;
  // bail out early instead of paying for dozens of binary searches.
  let brokenIntervals = 0;
  for (let k = 0; k + 1 < coarse.length; k++) {
    if (!(await continuous(anchors[coarse[k]], anchors[coarse[k + 1]]))) {
      brokenIntervals++;
    }
  }
  const intervals = coarse.length - 1;
  if (intervals >= MIN_RESET_SAMPLE && brokenIntervals * 2 > intervals) {
    log(
      `skip: clock resets on most intervals (${brokenIntervals}/${intervals})`,
    );
    return noChange('clock resets');
  }

  const ranges: Array<[number, number]> = [];
  let from = 0;
  let coarsePos = 0;
  let cursor = 0; // smallest anchor index with anchors[cursor] >= from
  while (from < last) {
    while (cursor < anchors.length && anchors[cursor] < from) cursor++;
    while (coarsePos < coarse.length && anchors[coarse[coarsePos]] <= from) {
      coarsePos++;
    }
    if (coarsePos >= coarse.length) {
      ranges.push([from, last]);
      break;
    }
    const hiAnchor = coarse[coarsePos];
    if (await continuous(from, anchors[hiAnchor])) {
      coarsePos++; // whole interval belongs to the current lineage
      continue;
    }

    // Break inside (from, anchors[hiAnchor]]: narrow it down on the anchor
    // grid first, then on raw segment indices for single-segment precision.
    const loAnchor = Math.min(cursor, hiAnchor);
    let loSeg = from;
    let hiSeg = anchors[hiAnchor];
    if (loAnchor < hiAnchor) {
      if (await continuous(from, anchors[loAnchor])) {
        let a = loAnchor;
        let b = hiAnchor;
        while (a + 1 < b) {
          const mid = (a + b) >> 1;
          if (await continuous(from, anchors[mid])) a = mid;
          else b = mid;
        }
        loSeg = anchors[a];
        hiSeg = anchors[b];
      } else {
        hiSeg = anchors[loAnchor];
      }
    }
    while (loSeg + 1 < hiSeg) {
      const mid = (loSeg + hiSeg) >> 1;
      if (await continuous(from, mid)) loSeg = mid;
      else hiSeg = mid;
    }

    ranges.push([from, hiSeg - 1]);
    from = hiSeg;
    if (giveUpOnReadings()) return noChange('readings unusable');
    if (ranges.length > MAX_RANGES) {
      log('skip: clock resets on most blocks');
      return noChange('clock resets');
    }
  }
  if (ranges.length === 0) ranges.push([0, last]);

  const lineages: Lineage[] = [];
  const clockOfSegment = new Array(segments.length).fill(NaN);
  for (const [rs, re] of ranges) {
    const reading = caches.get(rs) ?? UNKNOWN;
    const base = reading / TICKS_PER_SECOND;
    if (reading !== UNKNOWN) {
      for (let i = rs; i <= re; i++) {
        clockOfSegment[i] =
          base + (segments[i].startTime - segments[rs].startTime);
      }
    }
    const span =
      segments[re].startTime + segments[re].duration - segments[rs].startTime;
    let best: Lineage | null = null;
    let bestDelta = TOLERANCE_SECONDS;
    if (reading !== UNKNOWN) {
      for (const lineage of lineages) {
        const delta = Math.abs(base - lineage.expected);
        if (delta <= bestDelta) {
          best = lineage;
          bestDelta = delta;
        }
      }
    }
    const target =
      best ??
      (() => {
        const l = new Lineage(rs);
        lineages.push(l);
        return l;
      })();
    target.duration += span;
    target.ranges.push([rs, re]);
    target.expected = base + span;
  }

  if (lineages.length < MIN_LINEAGES) {
    log('skip: single lineage (no separately muxed clip)');
    return noChange();
  }

  const total = segments[last].startTime + segments[last].duration;
  const feature = lineages.reduce((a, b) => (b.duration > a.duration ? b : a));
  const ads = lineages.filter(
    (it) =>
      it.firstSegment !== feature.firstSegment &&
      it.duration < MAX_AD_SECONDS &&
      it.duration < total * MAX_AD_RATIO &&
      it.duration * 2 < feature.duration,
  );

  if (ads.length === 0) {
    log('skip: no short lineage looks like an ad');
    return noChange();
  }
  if (ads.reduce((s, a) => s + a.duration, 0) > total * MAX_TOTAL_AD_RATIO) {
    log('skip: ad total exceeds safety cap');
    return noChange('ad cap');
  }

  const removed = new Array(segments.length).fill(false);
  ads.forEach((ad) =>
    ad.ranges.forEach(([rs, re]) => {
      for (let i = rs; i <= re; i++) removed[i] = true;
    }),
  );

  const result = rebuild(lines, segments, removed, clockOfSegment);

  const removedSegments = removed.filter(Boolean).length;
  const discBeforeCount = lines.filter(
    (l) => l.trim() === DISCONTINUITY,
  ).length;
  const discAfterCount = result.main
    .split('\n')
    .filter((l) => l.trim() === DISCONTINUITY).length;
  log(
    `removed ${removedSegments} segments (${ads.length} breaks), disc ${discBeforeCount} -> ${discAfterCount}, anchors=${anchors.length}, requests=${requests}`,
  );

  return {
    main: result.main,
    ads: result.ads,
    adCount: removedSegments,
    adBreaks: ads.length,
    removed: true,
    adUrls: segments.filter((_, i) => removed[i]).map((s) => s.url),
  };
}
