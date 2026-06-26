export type MaterialThemeColors = {
  background: string;
  primary: string;
  primaryContainer: string;
  primaryHover: string;
  secondary: string;
  sourceColor: string;
  surface: string;
  tertiary: string;
  themeName: string;
};

export const MATERIAL_THEME_STORAGE_KEY = 'WORD_JIFFY_M3_THEME';
export const MATERIAL_BACKGROUND_STORAGE_KEY = 'WORD_JIFFY_BACKGROUND';
export const DEFAULT_M3_BACKGROUND = '248 250 252';

const materialThemeVariableNames = [
  '--m3-primary',
  '--m3-primary-hover',
  '--m3-primary-container',
  '--m3-secondary',
  '--m3-tertiary',
  '--m3-on-primary',
  '--m3-on-primary-container',
  '--m3-background',
  '--m3-surface',
] as const;

function isValidRgbValue(value: unknown): value is string {
  return typeof value === 'string' && /^\d{1,3} \d{1,3} \d{1,3}$/.test(value);
}

type StoredThemeBase = Pick<
  MaterialThemeColors,
  'primary' | 'primaryContainer' | 'primaryHover' | 'themeName'
> & {
  background?: unknown;
  secondary?: unknown;
  sourceColor?: unknown;
  surface?: unknown;
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

export function applyMaterialTheme(colors: MaterialThemeColors): void {
  document.documentElement.style.setProperty('--m3-primary', colors.primary);
  document.documentElement.style.setProperty('--m3-primary-hover', colors.primaryHover);
  document.documentElement.style.setProperty('--m3-primary-container', colors.primaryContainer);
  document.documentElement.style.setProperty('--m3-secondary', colors.secondary);
  document.documentElement.style.setProperty('--m3-tertiary', colors.tertiary);
  document.documentElement.style.setProperty('--m3-background', colors.background);
  document.documentElement.style.setProperty('--m3-surface', colors.surface);
  document.documentElement.style.setProperty('--m3-on-primary', getReadableTextColor(colors.primary));
  document.documentElement.style.setProperty(
    '--m3-on-primary-container',
    getReadableTextColor(colors.primaryContainer),
  );
}

export function persistMaterialTheme(colors: MaterialThemeColors): void {
  applyMaterialTheme(colors);
  window.localStorage.setItem(MATERIAL_THEME_STORAGE_KEY, JSON.stringify(colors));
  window.localStorage.setItem(MATERIAL_BACKGROUND_STORAGE_KEY, colors.background);
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
      tertiary: isValidRgbValue(parsedValue.tertiary)
        ? parsedValue.tertiary
        : parsedValue.primaryContainer,
      themeName: parsedValue.themeName,
    };
  } catch {
    return null;
  }
}

export function restoreMaterialTheme(): MaterialThemeColors | null {
  const storedTheme = readStoredMaterialTheme();

  if (storedTheme) {
    applyMaterialTheme(storedTheme);
    return storedTheme;
  }

  const storedBackground = readStoredBackground();
  document.documentElement.style.setProperty('--m3-background', storedBackground);

  return null;
}

export function clearMaterialThemeVariables(): void {
  materialThemeVariableNames.forEach((variableName) => {
    document.documentElement.style.removeProperty(variableName);
  });
}
