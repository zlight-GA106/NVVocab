import { persistThemeSeedColor, resolveRuntimeConfig } from '../utils/config';
import { generateM3Tokens, type M3CssVariableName, type M3TokenMap } from '../utils/themeEngine';

export type MaterialThemeColors = {
  background: string;
  onPrimary?: string;
  onPrimaryContainer?: string;
  onSurface?: string;
  onSurfaceVariant?: string;
  outline?: string;
  primary: string;
  primaryContainer: string;
  primaryHover: string;
  secondary: string;
  sourceColor: string;
  surface: string;
  surfaceVariant?: string;
  tertiary: string;
  themeName: string;
};

export const MATERIAL_THEME_STORAGE_KEY = 'WORD_JIFFY_M3_THEME';
export const MATERIAL_BACKGROUND_STORAGE_KEY = 'WORD_JIFFY_BACKGROUND';
export const MATERIAL_THEME_CHANGE_EVENT = 'nvvocab-material-theme-change';
export const DEFAULT_M3_BACKGROUND = '248 250 252';

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

const materialThemeVariableNames = [
  '--m3-primary',
  '--m3-primary-hover',
  '--m3-primary-container',
  '--m3-border',
  '--m3-secondary',
  '--m3-tertiary',
  '--m3-on-primary',
  '--m3-on-primary-container',
  '--m3-on-surface',
  '--m3-on-surface-variant',
  '--m3-outline',
  '--m3-background',
  '--m3-surface',
  '--m3-surface-variant',
] as const;

function isValidRgbValue(value: unknown): value is string {
  return typeof value === 'string' && /^\d{1,3} \d{1,3} \d{1,3}$/.test(value);
}

type StoredThemeBase = Pick<
  MaterialThemeColors,
  'primary' | 'primaryContainer' | 'primaryHover' | 'themeName'
> & {
  background?: unknown;
  onPrimary?: unknown;
  onPrimaryContainer?: unknown;
  onSurface?: unknown;
  onSurfaceVariant?: unknown;
  outline?: unknown;
  secondary?: unknown;
  sourceColor?: unknown;
  surface?: unknown;
  surfaceVariant?: unknown;
  tertiary?: unknown;
};

function isStoredThemeBase(value: unknown): value is StoredThemeBase {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    isValidRgbValue(record.primary) &&
    isValidRgbValue(record.primaryHover) &&
    isValidRgbValue(record.primaryContainer) &&
    typeof record.themeName === 'string'
  );
}

function readStoredBackground(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_M3_BACKGROUND;
  }

  const storedBackground = window.localStorage.getItem(MATERIAL_BACKGROUND_STORAGE_KEY);
  return isValidRgbValue(storedBackground) ? storedBackground : DEFAULT_M3_BACKGROUND;
}

function clampColorValue(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function toRgbString(color: RgbColor): string {
  return `${clampColorValue(color.red)} ${clampColorValue(color.green)} ${clampColorValue(color.blue)}`;
}

function toHexChannel(value: number): string {
  return clampColorValue(value).toString(16).padStart(2, '0');
}

function rgbTokenToHex(value: string): string {
  const [red, green, blue] = parseRgbString(value);
  return `#${toHexChannel(red)}${toHexChannel(green)}${toHexChannel(blue)}`;
}

function parseSeedHexColor(seedColor: string): RgbColor {
  const normalizedSeedColor = /^#[0-9a-fA-F]{6}$/u.test(seedColor) ? seedColor.slice(1) : '005faf';
  const red = Number.parseInt(normalizedSeedColor.slice(0, 2), 16);
  const green = Number.parseInt(normalizedSeedColor.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedSeedColor.slice(4, 6), 16);

  return {
    blue,
    green,
    red,
  };
}

function normalizeHue(hue: number): number {
  const normalizedHue = hue % 1;
  return normalizedHue < 0 ? normalizedHue + 1 : normalizedHue;
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
  return toRgbString(
    hslToRgb({
      hue: normalizeHue(seedHsl.hue + hueOffsetDegrees / 360),
      lightness,
      saturation,
    }),
  );
}

export function buildMaterialThemeFromSeedColor(
  seedColor: string,
  themeName = 'Seed color',
): MaterialThemeColors {
  const seedRgb = parseSeedHexColor(seedColor);
  const seedHsl = rgbToHsl(seedRgb);
  const primary = hslToken(seedHsl, 0, 0.65, 0.4);

  return {
    background: hslToken(seedHsl, 0, 0.06, 0.97),
    primary,
    primaryContainer: hslToken(seedHsl, 0, 0.3, 0.92),
    primaryHover: hslToken(seedHsl, 0, 0.65, 0.34),
    secondary: hslToken(seedHsl, 30, 0.4, 0.45),
    sourceColor: toRgbString(seedRgb),
    surface: hslToken(seedHsl, 0, 0.08, 0.93),
    tertiary: hslToken(seedHsl, -60, 0.5, 0.45),
    themeName,
  };
}

function parseRgbString(value: string): [number, number, number] {
  const [red = 0, green = 0, blue = 0] = value.split(' ').map((channel) => Number(channel));
  return [red, green, blue];
}

function getLinearChannel(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function getRelativeLuminance(rgbValue: string): number {
  const [red, green, blue] = parseRgbString(rgbValue);

  return (
    0.2126 * getLinearChannel(red) +
    0.7152 * getLinearChannel(green) +
    0.0722 * getLinearChannel(blue)
  );
}

function getReadableTextColor(rgbValue: string): string {
  return getRelativeLuminance(rgbValue) > 0.54 ? '0 0 0' : '255 255 255';
}

function getSystemDarkModePreference(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function createLightTokenMap(colors: MaterialThemeColors): M3TokenMap {
  const generatedTokens = generateM3Tokens(rgbTokenToHex(colors.sourceColor), false);

  return {
    ...generatedTokens,
    '--m3-background': colors.background,
    '--m3-on-primary': colors.onPrimary ?? getReadableTextColor(colors.primary),
    '--m3-on-primary-container': colors.onPrimaryContainer ?? getReadableTextColor(colors.primaryContainer),
    '--m3-on-surface': colors.onSurface ?? generatedTokens['--m3-on-surface'],
    '--m3-on-surface-variant': colors.onSurfaceVariant ?? generatedTokens['--m3-on-surface-variant'],
    '--m3-outline': colors.outline ?? generatedTokens['--m3-outline'],
    '--m3-primary': colors.primary,
    '--m3-primary-container': colors.primaryContainer,
    '--m3-primary-hover': colors.primaryHover,
    '--m3-secondary': colors.secondary,
    '--m3-surface': colors.surface,
    '--m3-surface-variant': colors.surfaceVariant ?? generatedTokens['--m3-surface-variant'],
    '--m3-tertiary': colors.tertiary,
  };
}

function createDarkTokenMap(colors: MaterialThemeColors): M3TokenMap {
  return generateM3Tokens(rgbTokenToHex(colors.sourceColor), true);
}

function applyTokenMap(tokens: M3TokenMap): void {
  (Object.entries(tokens) as Array<[M3CssVariableName, string]>).forEach(([variableName, value]) => {
    document.documentElement.style.setProperty(variableName, value);
  });
}

export function applyMaterialTheme(colors: MaterialThemeColors, isDarkMode = getSystemDarkModePreference()): void {
  document.documentElement.classList.toggle('dark', isDarkMode);
  document.documentElement.style.setProperty('color-scheme', isDarkMode ? 'dark' : 'light');
  applyTokenMap(isDarkMode ? createDarkTokenMap(colors) : createLightTokenMap(colors));
}

export function persistMaterialTheme(colors: MaterialThemeColors): void {
  applyMaterialTheme(colors);
  window.localStorage.setItem(MATERIAL_THEME_STORAGE_KEY, JSON.stringify(colors));
  window.localStorage.setItem(MATERIAL_BACKGROUND_STORAGE_KEY, colors.background);
  persistThemeSeedColor(rgbTokenToHex(colors.sourceColor));
  window.dispatchEvent(new CustomEvent(MATERIAL_THEME_CHANGE_EVENT));
}

export function readStoredMaterialTheme(): MaterialThemeColors | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedValue = window.localStorage.getItem(MATERIAL_THEME_STORAGE_KEY);
  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue);
    if (!isStoredThemeBase(parsedValue)) {
      return null;
    }

    return {
      background: isValidRgbValue(parsedValue.background)
        ? parsedValue.background
        : readStoredBackground(),
      onPrimary: isValidRgbValue(parsedValue.onPrimary)
        ? parsedValue.onPrimary
        : undefined,
      onPrimaryContainer: isValidRgbValue(parsedValue.onPrimaryContainer)
        ? parsedValue.onPrimaryContainer
        : undefined,
      onSurface: isValidRgbValue(parsedValue.onSurface)
        ? parsedValue.onSurface
        : undefined,
      onSurfaceVariant: isValidRgbValue(parsedValue.onSurfaceVariant)
        ? parsedValue.onSurfaceVariant
        : undefined,
      outline: isValidRgbValue(parsedValue.outline)
        ? parsedValue.outline
        : undefined,
      primary: parsedValue.primary,
      primaryContainer: parsedValue.primaryContainer,
      primaryHover: parsedValue.primaryHover,
      secondary: isValidRgbValue(parsedValue.secondary)
        ? parsedValue.secondary
        : parsedValue.primary,
      sourceColor: isValidRgbValue(parsedValue.sourceColor)
        ? parsedValue.sourceColor
        : parsedValue.primary,
      surface: isValidRgbValue(parsedValue.surface)
        ? parsedValue.surface
        : readStoredBackground(),
      surfaceVariant: isValidRgbValue(parsedValue.surfaceVariant)
        ? parsedValue.surfaceVariant
        : undefined,
      tertiary: isValidRgbValue(parsedValue.tertiary)
        ? parsedValue.tertiary
        : parsedValue.primaryContainer,
      themeName: parsedValue.themeName,
    };
  } catch {
    return null;
  }
}

export function restoreMaterialTheme(isDarkMode = getSystemDarkModePreference()): MaterialThemeColors | null {
  const storedTheme = readStoredMaterialTheme();

  if (storedTheme) {
    applyMaterialTheme(storedTheme, isDarkMode);
    return storedTheme;
  }

  const seedTheme = buildMaterialThemeFromSeedColor(resolveRuntimeConfig().themeSeedColor);
  applyMaterialTheme(seedTheme, isDarkMode);

  return seedTheme;
}

export function clearMaterialThemeVariables(): void {
  materialThemeVariableNames.forEach((variableName) => {
    document.documentElement.style.removeProperty(variableName);
  });
}
