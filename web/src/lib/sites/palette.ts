// Logo → theme-palette derivation for the Website Builder (specs/website-builder.md
// §Brand). Given a logo image URL, derive a small set of theme tokens
// { primary, secondary, bg, text } with a basic WCAG contrast check so text
// stays legible on the chosen background.
//
// The spec suggests node-vibrant/sharp, but those are NOT in package.json and we
// must not add dependencies. So this is a lightweight, dependency-free server
// util: we decode PNGs accurately using Node's built-in `zlib` (no native image
// lib needed), and for any other format (or on decode failure) fall back to a
// deterministic heuristic keyed off the URL so callers always get a usable,
// stable palette. Owners can nudge the result later.
//
// Node runtime only (uses node:zlib + fetch on the server).

import { inflateSync } from "node:zlib";

export interface ThemeTokens {
  /** Brand accent — buttons, links, highlights. */
  primary: string;
  /** Secondary accent — derived from primary. */
  secondary: string;
  /** Page background. */
  bg: string;
  /** Body text colour, contrast-checked against `bg`. */
  text: string;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Brand fallback tokens (app palette: pine / brass / cream / ink). */
const FALLBACK: ThemeTokens = {
  primary: "#1f4034", // pine
  secondary: "#b5893f", // brass
  bg: "#faf6ee", // cream
  text: "#221c14", // ink
};

const toHex = (n: number): string =>
  Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

const rgbToHex = ({ r, g, b }: RGB): string => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// ─── WCAG relative luminance + contrast ───
function relativeLuminance({ r, g, b }: RGB): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio (1..21) between two colours. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const BLACK: RGB = { r: 34, g: 28, b: 20 }; // ink
const WHITE: RGB = { r: 250, g: 246, b: 238 }; // cream

/**
 * Pick whichever of near-black / near-white text contrasts best against `bg`,
 * guaranteeing a readable pairing (>= 4.5 is WCAG AA; we just take the max).
 */
function readableTextOn(bg: RGB): RGB {
  return contrastRatio(bg, BLACK) >= contrastRatio(bg, WHITE) ? BLACK : WHITE;
}

// Adjust a colour's lightness toward white (amount>0) or black (amount<0),
// amount in [-1, 1]. Used to derive a secondary accent from the primary.
function shade(c: RGB, amount: number): RGB {
  if (amount >= 0) {
    return {
      r: c.r + (255 - c.r) * amount,
      g: c.g + (255 - c.g) * amount,
      b: c.b + (255 - c.b) * amount,
    };
  }
  const k = 1 + amount;
  return { r: c.r * k, g: c.g * k, b: c.b * k };
}

// ─── PNG decode (truecolor / truecolor+alpha) via zlib, no deps ───
// Returns a flat list of sampled opaque pixels, or null if not a PNG we can read.
function samplePngPixels(buf: Buffer): RGB[] | null {
  const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 8) return null;
  for (let i = 0; i < 8; i++) if (buf[i] !== PNG_SIG[i]) return null;

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];

  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const dataStart = off + 8;
    const dataEnd = dataStart + len;
    if (dataEnd > buf.length) break;
    if (type === "IHDR") {
      width = buf.readUInt32BE(dataStart);
      height = buf.readUInt32BE(dataStart + 4);
      bitDepth = buf[dataStart + 8]; // IHDR: width(4) height(4) bitDepth(1) colorType(1)
      colorType = buf[dataStart + 9];
    } else if (type === "IDAT") {
      idat.push(buf.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }
    off = dataEnd + 4; // skip CRC
  }

  // Only handle 8-bit truecolor (2) and truecolor+alpha (6) — the common logo
  // formats. Anything else (palette/grayscale/interlaced) → heuristic fallback.
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) return null;
  if (!width || !height || idat.length === 0) return null;

  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) return null;

  // Un-filter scanlines (PNG filter types 0..4) into a flat pixel buffer.
  const out = Buffer.alloc(stride * height);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    return pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const inRow = y * (stride + 1) + 1;
    const outRow = y * stride;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[inRow + x];
      const a = x >= channels ? out[outRow + x - channels] : 0;
      const b = y > 0 ? out[outRow - stride + x] : 0;
      const c = y > 0 && x >= channels ? out[outRow - stride + x - channels] : 0;
      let val: number;
      switch (filter) {
        case 1:
          val = rawByte + a;
          break;
        case 2:
          val = rawByte + b;
          break;
        case 3:
          val = rawByte + ((a + b) >> 1);
          break;
        case 4:
          val = rawByte + paeth(a, b, c);
          break;
        default:
          val = rawByte;
      }
      out[outRow + x] = val & 0xff;
    }
  }

  // Sample up to ~4000 pixels; skip transparent and near-white/near-black so the
  // dominant *brand* colour wins over the logo's background/outline.
  const pixels: RGB[] = [];
  const total = width * height;
  const step = Math.max(1, Math.floor(total / 4000));
  for (let i = 0; i < total; i += step) {
    const p = i * channels;
    const r = out[p];
    const g = out[p + 1];
    const bb = out[p + 2];
    const alpha = channels === 4 ? out[p + 3] : 255;
    if (alpha < 200) continue;
    const max = Math.max(r, g, bb);
    const min = Math.min(r, g, bb);
    if (max > 245 && min > 245) continue; // near-white bg
    if (max < 12) continue; // near-black outline
    pixels.push({ r, g, b: bb });
  }
  return pixels;
}

/** Average a set of pixels, weighting toward the most saturated (brand-y) ones. */
function dominantColor(pixels: RGB[]): RGB | null {
  if (pixels.length === 0) return null;
  let wr = 0;
  let wg = 0;
  let wb = 0;
  let wsum = 0;
  for (const p of pixels) {
    const max = Math.max(p.r, p.g, p.b);
    const min = Math.min(p.r, p.g, p.b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const w = 0.25 + sat; // never zero, so flat logos still average
    wr += p.r * w;
    wg += p.g * w;
    wb += p.b * w;
    wsum += w;
  }
  return { r: wr / wsum, g: wg / wsum, b: wb / wsum };
}

// Deterministic fallback colour from a string (stable per logo URL) so a barn
// always gets the same palette even when we can't decode the image.
function hashColor(seed: string): RGB {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Bias toward mid, saturated tones (avoid muddy/near-gray).
  const r = 40 + (h & 0xff) % 160;
  const g = 40 + ((h >>> 8) & 0xff) % 160;
  const b = 40 + ((h >>> 16) & 0xff) % 160;
  return { r, g, b };
}

/** Build the full token set from a chosen primary colour. */
function tokensFromPrimary(primary: RGB): ThemeTokens {
  const secondary = shade(primary, primary.r + primary.g + primary.b > 380 ? -0.35 : 0.4);
  // Very light tint of the primary for the page background.
  const bg = shade(primary, 0.9);
  const text = readableTextOn(bg);
  return {
    primary: rgbToHex(primary),
    secondary: rgbToHex(secondary),
    bg: rgbToHex(bg),
    text: rgbToHex(text),
  };
}

/**
 * Derive theme tokens from a logo image URL. Always resolves to a usable palette:
 * decoded brand colour when possible, deterministic per-URL fallback otherwise.
 * Pass no URL (or a failing one) to get the app's default brand tokens.
 */
export async function derivePaletteFromLogo(
  logoUrl: string | null | undefined,
): Promise<ThemeTokens> {
  if (!logoUrl) return FALLBACK;

  let dominant: RGB | null = null;
  try {
    const res = await fetch(logoUrl, {
      // Edge-cache-free fetch on the server; palette is computed at build time.
      headers: { accept: "image/*" },
    });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      const pixels = samplePngPixels(buf);
      if (pixels) dominant = dominantColor(pixels);
    }
  } catch {
    // network/decode failure → fall through to heuristic
  }

  if (!dominant) {
    dominant = hashColor(logoUrl);
  }

  const tokens = tokensFromPrimary(dominant);

  // Final safety net: if text/bg somehow collapsed below AA, force readable text.
  if (contrastRatio(hexToRgb(tokens.bg), hexToRgb(tokens.text)) < 4.5) {
    tokens.text = rgbToHex(readableTextOn(hexToRgb(tokens.bg)));
  }
  return tokens;
}

export const PALETTE_FALLBACK = FALLBACK;
