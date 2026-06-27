export type M3CssVariableName =
  | '--m3-background'
  | '--m3-border'
  | '--m3-error'
  | '--m3-on-primary'
  | '--m3-on-primary-container'
  | '--m3-on-surface'
  | '--m3-on-surface-variant'
  | '--m3-outline'
  | '--m3-primary'
  | '--m3-primary-container'
  | '--m3-primary-hover'
  | '--m3-secondary'
  | '--m3-surface'
  | '--m3-surface-variant'
  | '--m3-tertiary';

export type M3TokenMap = Record<M3CssVariableName, string>;

type RgbColor = {
  blue: number;
  green: number;
  red: number;
};

type HslColor = {
  hue: number;
  lightness: number;
  saturation: number;
};

const minimumTextContrastRatio = 4.5;
const hueCircle = 1;
const darkPrimaryMinimumLightness = 0.75;
const darkPrimaryMaximumLightness = 0.85;

function clampColorValue(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function toRgbToken(color: RgbColor): string {
  return `${clampColorValue(color.red)} ${clampColorValue(color.green)} ${clampColorValue(color.blue)}`;
}

function parseRgbToken(value: string): RgbColor | null {
  const rgbFunctionMatch = value
    .trim()
    .match(/^rgb\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)$/iu);
  const rgbTokenMatch = value.trim().match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/u);
  const match = rgbFunctionMatch ?? rgbTokenMatch;

  if (!match) {
    return null;
  }

  return {
    blue: clampColorValue(Number(match[3])),
    green: clampColorValue(Number(match[2])),
    red: clampColorValue(Number(match[1])),
  };
}

function parseSeedColor(seedColor: string): RgbColor {
  const normalizedSeedColor = seedColor.trim();
  const rgbToken = parseRgbToken(normalizedSeedColor);

  if (rgbToken) {
    return rgbToken;
  }

  const hexMatch = normalizedSeedColor.match(/^#?([0-9a-fA-F]{6})$/u);
  const hexValue = hexMatch?.[1] ?? '005faf';

  return {
    blue: Number.parseInt(hexValue.slice(4, 6), 16),
    green: Number.parseInt(hexValue.slice(2, 4), 16),
    red: Number.parseInt(hexValue.slice(0, 2), 16),
  };
}

function normalizeHue(hue: number): number {
  const normalized = hue % hueCircle;
  return normalized < 0 ? normalized + hueCircle : normalized;
}

function rgbToHsl(color: RgbColor): HslColor {
  const red = color.red / 255;
  const green = color.green / 255;
  const blue = color.blue / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return {
      hue: 0,
      lightness,
      saturation: 0,
    };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue: number;

  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return {
    hue: hue / 6,
    lightness,
    saturation,
  };
}

function hueToRgb(first: number, second: number, hueInput: number): number {
  let hue = hueInput;

  if (hue < 0) {
    hue += 1;
  }

  if (hue > 1) {
    hue -= 1;
  }

  if (hue < 1 / 6) {
    return first + (second - first) * 6 * hue;
  }

  if (hue < 1 / 2) {
    return second;
  }

  if (hue < 2 / 3) {
    return first + (second - first) * (2 / 3 - hue) * 6;
  }

  return first;
}

function hslToRgb(color: HslColor): RgbColor {
  if (color.saturation === 0) {
    const channel = clampColorValue(color.lightness * 255);

    return {
      blue: channel,
      green: channel,
      red: channel,
    };
  }

  const second =
    color.lightness < 0.5
      ? color.lightness * (1 + color.saturation)
      : color.lightness + color.saturation - color.lightness * color.saturation;
  const first = 2 * color.lightness - second;

  return {
    blue: clampColorValue(hueToRgb(first, second, color.hue - 1 / 3) * 255),
    green: clampColorValue(hueToRgb(first, second, color.hue) * 255),
    red: clampColorValue(hueToRgb(first, second, color.hue + 1 / 3) * 255),
  };
}

function hslToken(seedHsl: HslColor, hueOffsetDegrees: number, saturation: number, lightness: number): string {
  return toRgbToken(
    hslToRgb({
      hue: normalizeHue(seedHsl.hue + hueOffsetDegrees / 360),
      lightness: clampUnit(lightness),
      saturation: clampUnit(saturation),
    }),
  );
}

function clampRange(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function boostDarkSaturation(seedSaturation: number, minimum: number, boost = 0.1): number {
  return clampRange(Math.max(seedSaturation + boost, minimum), minimum, 0.94);
}

function mixRgbToken(firstToken: string, secondToken: string, secondWeight: number): string {
  const [firstRed, firstGreen, firstBlue] = parseRgbChannels(firstToken);
  const [secondRed, secondGreen, secondBlue] = parseRgbChannels(secondToken);
  const clampedSecondWeight = clampUnit(secondWeight);
  const firstWeight = 1 - clampedSecondWeight;

  return `${clampColorValue(firstRed * firstWeight + secondRed * clampedSecondWeight)} ${clampColorValue(
    firstGreen * firstWeight + secondGreen * clampedSecondWeight,
  )} ${clampColorValue(firstBlue * firstWeight + secondBlue * clampedSecondWeight)}`;
}

function parseRgbChannels(value: string): [number, number, number] {
  const color = parseRgbToken(value) ?? { blue: 0, green: 0, red: 0 };
  return [color.red, color.green, color.blue];
}

function getLinearChannel(channel: number): number {
  const normalized = clampColorValue(channel) / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function getRelativeLuminance(rgbValue: string): number {
  const [red, green, blue] = parseRgbChannels(rgbValue);

  return (
    0.2126 * getLinearChannel(red) +
    0.7152 * getLinearChannel(green) +
    0.0722 * getLinearChannel(blue)
  );
}

export function getContrastRatio(firstRgbValue: string, secondRgbValue: string): number {
  const firstLuminance = getRelativeLuminance(firstRgbValue);
  const secondLuminance = getRelativeLuminance(secondRgbValue);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function getBestContrastToken(backgroundToken: string, candidates: string[]): string {
  return candidates.reduce((bestCandidate, candidate) => {
    const bestContrast = getContrastRatio(backgroundToken, bestCandidate);
    const candidateContrast = getContrastRatio(backgroundToken, candidate);
    return candidateContrast > bestContrast ? candidate : bestCandidate;
  }, candidates[0] ?? '255 255 255');
}

function getReadableTextToken(backgroundToken: string, preferredCandidates: string[]): string {
  const passingCandidate = preferredCandidates.find(
    (candidate) => getContrastRatio(backgroundToken, candidate) >= minimumTextContrastRatio,
  );

  return passingCandidate ?? getBestContrastToken(backgroundToken, preferredCandidates);
}

function adjustTokenForContrast(
  token: string,
  againstToken: string,
  direction: 'darker' | 'lighter',
): string {
  const seedHsl = rgbToHsl(parseRgbToken(token) ?? { blue: 0, green: 95, red: 0 });
  let lightness = seedHsl.lightness;

  for (let step = 0; step < 32; step += 1) {
    const candidate = toRgbToken(
      hslToRgb({
        ...seedHsl,
        lightness,
      }),
    );

    if (getContrastRatio(candidate, againstToken) >= minimumTextContrastRatio) {
      return candidate;
    }

    lightness = direction === 'lighter' ? lightness + 0.025 : lightness - 0.025;
    lightness = clampUnit(lightness);
  }

  return token;
}

export function generateM3Tokens(seedColor: string, isDark: boolean): M3TokenMap {
  const seedHsl = rgbToHsl(parseSeedColor(seedColor));
  const darkPrimarySaturation = boostDarkSaturation(seedHsl.saturation, 0.74, 0.12);
  const darkSecondarySaturation = boostDarkSaturation(seedHsl.saturation, 0.58, 0.08);
  const darkTertiarySaturation = boostDarkSaturation(seedHsl.saturation, 0.62, 0.1);
  const darkPrimaryLightness = clampRange(
    0.8 + (seedHsl.lightness - 0.5) * 0.08,
    darkPrimaryMinimumLightness,
    darkPrimaryMaximumLightness,
  );
  const seedAccent = hslToken(seedHsl, 0, darkPrimarySaturation, darkPrimaryLightness);
  const neutralBackground = hslToken(seedHsl, 0, 0.02, isDark ? 0.095 : 0.97);
  const neutralSurface = hslToken(seedHsl, 0, 0.025, isDark ? 0.135 : 0.93);
  const neutralSurfaceVariant = hslToken(seedHsl, 0, 0.04, isDark ? 0.22 : 0.9);
  const background = isDark ? mixRgbToken(neutralBackground, seedAccent, 0.02) : hslToken(seedHsl, 0, 0.06, 0.97);
  const surface = isDark ? mixRgbToken(neutralSurface, seedAccent, 0.02) : hslToken(seedHsl, 0, 0.08, 0.93);
  const surfaceVariant = isDark
    ? mixRgbToken(neutralSurfaceVariant, seedAccent, 0.035)
    : hslToken(seedHsl, 0, 0.1, 0.9);
  const rawPrimary = hslToken(seedHsl, 0, isDark ? darkPrimarySaturation : 0.65, isDark ? darkPrimaryLightness : 0.4);
  const primary = adjustTokenForContrast(rawPrimary, surface, isDark ? 'lighter' : 'darker');
  const primaryHover = hslToken(
    seedHsl,
    0,
    isDark ? clampRange(darkPrimarySaturation + 0.04, 0.78, 0.96) : 0.65,
    isDark ? clampRange(darkPrimaryLightness - 0.06, 0.72, 0.8) : 0.34,
  );
  const primaryContainer = hslToken(seedHsl, 0, isDark ? clampRange(darkPrimarySaturation * 0.56, 0.44, 0.62) : 0.3, isDark ? 0.34 : 0.92);
  const outlineBase = hslToken(seedHsl, 0, isDark ? 0.18 : 0.12, isDark ? 0.56 : 0.48);
  const outline = isDark ? mixRgbToken(outlineBase, seedAccent, 0.1) : outlineBase;
  const border = isDark ? mixRgbToken('74 74 82', seedAccent, 0.12) : '203 196 208';
  const secondary = hslToken(seedHsl, 30, isDark ? darkSecondarySaturation : 0.4, isDark ? 0.72 : 0.45);
  const tertiary = hslToken(seedHsl, -60, isDark ? darkTertiarySaturation : 0.5, isDark ? 0.73 : 0.45);

  return {
    '--m3-background': background,
    '--m3-border': border,
    '--m3-error': isDark ? '255 180 171' : '186 26 26',
    '--m3-on-primary': getReadableTextToken(primary, isDark ? ['18 18 20', '0 0 0', '255 255 255'] : ['255 255 255', '0 0 0']),
    '--m3-on-primary-container': getReadableTextToken(
      primaryContainer,
      isDark ? ['238 238 242', '255 255 255', '18 18 20'] : ['18 18 20', '0 0 0', '255 255 255'],
    ),
    '--m3-on-surface': getReadableTextToken(surface, isDark ? ['245 245 248', '255 255 255'] : ['29 27 32', '0 0 0']),
    '--m3-on-surface-variant': getReadableTextToken(
      surfaceVariant,
      isDark ? ['202 196 208', '245 245 248', '255 255 255'] : ['73 69 79', '29 27 32', '0 0 0'],
    ),
    '--m3-outline': outline,
    '--m3-primary': primary,
    '--m3-primary-container': primaryContainer,
    '--m3-primary-hover': primaryHover,
    '--m3-secondary': secondary,
    '--m3-surface': surface,
    '--m3-surface-variant': surfaceVariant,
    '--m3-tertiary': tertiary,
  };
}
