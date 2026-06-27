import type { MaterialThemeColors } from './materialTheme';

type PresetInput = {
  background: string;
  description: string;
  id: string;
  name: string;
  onPrimary: string;
  onPrimaryContainer: string;
  onSurface: string;
  outline: string;
  primary: string;
  primaryContainer: string;
  secondary: string;
  surface: string;
  surfaceVariant: string;
  tertiary: string;
};

export type CharacterMaterialThemePreset = {
  colors: MaterialThemeColors;
  description: string;
  id: string;
};

function clampColorValue(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function hexToRgbToken(hexValue: string): string {
  const normalizedHex = /^#[0-9a-fA-F]{6}$/u.test(hexValue) ? hexValue.slice(1) : '005faf';
  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);

  return `${red} ${green} ${blue}`;
}

function getDarkerRgbToken(hexValue: string): string {
  const [red = 0, green = 0, blue = 0] = hexToRgbToken(hexValue)
    .split(' ')
    .map((channel) => Number(channel));

  return `${clampColorValue(red * 0.84)} ${clampColorValue(green * 0.84)} ${clampColorValue(blue * 0.84)}`;
}

function createPreset(input: PresetInput): CharacterMaterialThemePreset {
  return {
    colors: {
      background: hexToRgbToken(input.background),
      onPrimary: hexToRgbToken(input.onPrimary),
      onPrimaryContainer: hexToRgbToken(input.onPrimaryContainer),
      onSurface: hexToRgbToken(input.onSurface),
      outline: hexToRgbToken(input.outline),
      primary: hexToRgbToken(input.primary),
      primaryContainer: hexToRgbToken(input.primaryContainer),
      primaryHover: getDarkerRgbToken(input.primary),
      secondary: hexToRgbToken(input.secondary),
      sourceColor: hexToRgbToken(input.primary),
      surface: hexToRgbToken(input.surface),
      surfaceVariant: hexToRgbToken(input.surfaceVariant),
      tertiary: hexToRgbToken(input.tertiary),
      themeName: input.name,
    },
    description: input.description,
    id: input.id,
  };
}

export const characterMaterialThemePresets: CharacterMaterialThemePreset[] = [
  createPreset({
    background: '#F7FCFD',
    description: '冰蓝、霜白、水汽、清冷',
    id: 'shuangchao',
    name: '霜潮',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#343865',
    onSurface: '#363A67',
    outline: '#90B2C2',
    primary: '#68A4CA',
    primaryContainer: '#C2ECF7',
    secondary: '#9CA3CA',
    surface: '#F7FCFD',
    surfaceVariant: '#ADCFE2',
    tertiary: '#EBBDC2',
  }),
  createPreset({
    background: '#FDFDFD',
    description: '玄蓝、霜白、铜纹、冷焰',
    id: 'tongxuan',
    name: '铜玄',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#1B1C29',
    onSurface: '#1B1C29',
    outline: '#404B5F',
    primary: '#455065',
    primaryContainer: '#A6B7DC',
    secondary: '#B78A71',
    surface: '#FDFDFD',
    surfaceVariant: '#5A647A',
    tertiary: '#B4E7F5',
  }),
  createPreset({
    background: '#F5F5F6',
    description: '蓝黑、银白、旧金、金瞳',
    id: 'heimao',
    name: '黑猫',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#1B1C29',
    onSurface: '#1B1C29',
    outline: '#7D808C',
    primary: '#50546C',
    primaryContainer: '#A6ACBF',
    secondary: '#9E8F6B',
    surface: '#F5F5F6',
    surfaceVariant: '#69696A',
    tertiary: '#4E753A',
  }),
  createPreset({
    background: '#F5F1EE',
    description: '橙红、卡其、雪白、暖金',
    id: 'honghu',
    name: '红狐',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#4A1F16',
    onSurface: '#35251E',
    outline: '#7E5F4B',
    primary: '#B54A2F',
    primaryContainer: '#E78255',
    secondary: '#B49A75',
    surface: '#F5F1EE',
    surfaceVariant: '#C5B4A4',
    tertiary: '#F0C55A',
  }),
  createPreset({
    background: '#F5FAFA',
    description: '星海蓝、深海紫、荧光青、冰白',
    id: 'xingkong',
    name: '星空',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#133554',
    onSurface: '#2F3A56',
    outline: '#637EA2',
    primary: '#3867BF',
    primaryContainer: '#7EF5F3',
    secondary: '#E2C3B6',
    surface: '#F5FAFA',
    surfaceVariant: '#B6D6E1',
    tertiary: '#43429A',
  }),
  createPreset({
    background: '#F4F3F9',
    description: '深靛蓝、薄荷青、雪白、浅蓝',
    id: 'bohe',
    name: '薄荷',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#142C36',
    onSurface: '#1C1956',
    outline: '#6A7B9C',
    primary: '#2C297F',
    primaryContainer: '#88F5D0',
    secondary: '#81C4E9',
    surface: '#F4F3F9',
    surfaceVariant: '#D6DDE7',
    tertiary: '#CCE5BD',
  }),
];
