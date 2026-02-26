/**
 * Color utility functions for design QA comparison.
 * Handles color extraction, conversion, comparison, and accessibility checks.
 */

export interface RGB {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
}

export interface RGBA extends RGB {
  a: number; // 0-1
}

export interface LAB {
  L: number;
  a: number;
  b: number;
}

// Convert Figma RGB (0-1) to hex string
export function rgbToHex(color: RGB): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

// Convert hex to RGB (0-1)
export function hexToRgb(hex: string): RGB {
  hex = hex.replace('#', '');
  return {
    r: parseInt(hex.substring(0, 2), 16) / 255,
    g: parseInt(hex.substring(2, 4), 16) / 255,
    b: parseInt(hex.substring(4, 6), 16) / 255,
  };
}

// Convert RGB to LAB for perceptual color difference
export function rgbToLab(color: RGB): LAB {
  // RGB to XYZ
  let r = color.r > 0.04045 ? Math.pow((color.r + 0.055) / 1.055, 2.4) : color.r / 12.92;
  let g = color.g > 0.04045 ? Math.pow((color.g + 0.055) / 1.055, 2.4) : color.g / 12.92;
  let b = color.b > 0.04045 ? Math.pow((color.b + 0.055) / 1.055, 2.4) : color.b / 12.92;

  let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750);
  let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;

  const epsilon = 0.008856;
  const kappa = 903.3;

  x = x > epsilon ? Math.pow(x, 1 / 3) : (kappa * x + 16) / 116;
  y = y > epsilon ? Math.pow(y, 1 / 3) : (kappa * y + 16) / 116;
  z = z > epsilon ? Math.pow(z, 1 / 3) : (kappa * z + 16) / 116;

  return {
    L: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

// CIE Delta E 2000 - perceptual color difference
export function deltaE2000(lab1: LAB, lab2: LAB): number {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const avgL = (L1 + L2) / 2;
  const c1 = Math.sqrt(a1 * a1 + b1 * b1);
  const c2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (c1 + c2) / 2;

  const g = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));

  const a1p = a1 * (1 + g);
  const a2p = a2 * (1 + g);
  const c1p = Math.sqrt(a1p * a1p + b1 * b1);
  const c2p = Math.sqrt(a2p * a2p + b2 * b2);

  let h1p = Math.atan2(b1, a1p) * 180 / Math.PI;
  if (h1p < 0) h1p += 360;
  let h2p = Math.atan2(b2, a2p) * 180 / Math.PI;
  if (h2p < 0) h2p += 360;

  const dLp = L2 - L1;
  const dCp = c2p - c1p;

  let dhp: number;
  if (c1p * c2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }

  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(dhp * Math.PI / 360);

  const avgLp = (L1 + L2) / 2;
  const avgCp = (c1p + c2p) / 2;

  let avgHp: number;
  if (c1p * c2p === 0) {
    avgHp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    avgHp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    avgHp = (h1p + h2p + 360) / 2;
  } else {
    avgHp = (h1p + h2p - 360) / 2;
  }

  const T = 1
    - 0.17 * Math.cos((avgHp - 30) * Math.PI / 180)
    + 0.24 * Math.cos((2 * avgHp) * Math.PI / 180)
    + 0.32 * Math.cos((3 * avgHp + 6) * Math.PI / 180)
    - 0.20 * Math.cos((4 * avgHp - 63) * Math.PI / 180);

  const sL = 1 + 0.015 * Math.pow(avgLp - 50, 2) / Math.sqrt(20 + Math.pow(avgLp - 50, 2));
  const sC = 1 + 0.045 * avgCp;
  const sH = 1 + 0.015 * avgCp * T;

  const rT = -2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)))
    * Math.sin(60 * Math.exp(-Math.pow((avgHp - 275) / 25, 2)) * Math.PI / 180);

  return Math.sqrt(
    Math.pow(dLp / sL, 2) +
    Math.pow(dCp / sC, 2) +
    Math.pow(dHp / sH, 2) +
    rT * (dCp / sC) * (dHp / sH)
  );
}

// Compare two colors and return delta E
export function compareColors(color1: RGB, color2: RGB): number {
  const lab1 = rgbToLab(color1);
  const lab2 = rgbToLab(color2);
  return deltaE2000(lab1, lab2);
}

// Calculate relative luminance for WCAG
export function relativeLuminance(color: RGB): number {
  const linearize = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * linearize(color.r) + 0.7152 * linearize(color.g) + 0.0722 * linearize(color.b);
}

// Calculate contrast ratio between two colors (WCAG)
export function contrastRatio(color1: RGB, color2: RGB): number {
  const l1 = relativeLuminance(color1);
  const l2 = relativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Get dominant colors from pixel data using simple color quantization
export function extractDominantColors(
  pixels: number[],
  width: number,
  height: number,
  sampleRate: number = 10
): { color: RGB; count: number; hex: string }[] {
  const colorMap = new Map<string, { color: RGB; count: number }>();

  for (let y = 0; y < height; y += sampleRate) {
    for (let x = 0; x < width; x += sampleRate) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx] / 255;
      const g = pixels[idx + 1] / 255;
      const b = pixels[idx + 2] / 255;
      const a = pixels[idx + 3] / 255;

      if (a < 0.5) continue; // Skip transparent pixels

      // Quantize to reduce unique colors
      const qr = Math.round(r * 20) / 20;
      const qg = Math.round(g * 20) / 20;
      const qb = Math.round(b * 20) / 20;
      const key = `${qr},${qg},${qb}`;

      const existing = colorMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        colorMap.set(key, { color: { r: qr, g: qg, b: qb }, count: 1 });
      }
    }
  }

  return Array.from(colorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)
    .map(entry => ({
      color: entry.color,
      count: entry.count,
      hex: rgbToHex(entry.color),
    }));
}

// Color difference threshold classification
export function classifyColorDiff(deltaE: number): 'identical' | 'imperceptible' | 'noticeable' | 'significant' | 'different' {
  if (deltaE < 1) return 'identical';
  if (deltaE < 2) return 'imperceptible';
  if (deltaE < 3.5) return 'noticeable';
  if (deltaE < 5) return 'significant';
  return 'different';
}
