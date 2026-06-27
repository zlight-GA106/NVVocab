import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  Database,
  ImageUp,
  KeyRound,
  Paintbrush,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useAccountDataDestruction } from '../hooks/useAccountDataDestruction';
import {
  buildMaterialThemeFromSeedColor,
  clearMaterialThemeVariables,
  persistMaterialTheme,
  readStoredMaterialTheme,
  type MaterialThemeColors,
} from '../lib/materialTheme';
import { characterMaterialThemePresets, type CharacterMaterialThemePreset } from '../lib/themePresets';
import {
  persistSupabaseCredentials,
  readSupabaseCredentials,
  SUPABASE_KEY_STORAGE_KEY,
  SUPABASE_URL_STORAGE_KEY,
} from '../lib/supabase';
import { resolveRuntimeConfig } from '../utils/config';

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

type ColorBucket = {
  blueTotal: number;
  count: number;
  greenTotal: number;
  redTotal: number;
};

type PaletteToken = {
  label: string;
  name: string;
  usage: string;
  value: string;
};

const sampleCanvasSize = 50;
const credentialSuccessDurationMs = 2000;
const hueCircle = 1;
const minimumSeedSaturation = 0.18;
const minimumSeedLightness = 0.14;
const maximumSeedLightness = 0.92;
const colorBucketSize = 24;

function triggerSubtleInteractionFeedback(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.navigator.vibrate?.(8);
}

function clampColorValue(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function toRgbString(color: RgbColor): string {
  return `${clampColorValue(color.red)} ${clampColorValue(color.green)} ${clampColorValue(color.blue)}`;
}

function parseRgbToken(value: string): RgbColor {
  const [red = 0, green = 0, blue = 0] = value.split(' ').map((channel) => Number(channel));

  return {
    blue: clampColorValue(blue),
    green: clampColorValue(green),
    red: clampColorValue(red),
  };
}

function toHexChannel(value: number): string {
  return clampColorValue(value).toString(16).padStart(2, '0').toUpperCase();
}

function toHexToken(value: string): string {
  const color = parseRgbToken(value);
  return `#${toHexChannel(color.red)}${toHexChannel(color.green)}${toHexChannel(color.blue)}`;
}

function getLinearChannel(channel: number): number {
  const normalized = clampColorValue(channel) / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function getRgbLuminance(value: string): number {
  const color = parseRgbToken(value);

  return (
    0.2126 * getLinearChannel(color.red) +
    0.7152 * getLinearChannel(color.green) +
    0.0722 * getLinearChannel(color.blue)
  );
}

function getReadableSwatchTextColor(value: string): string {
  return getRgbLuminance(value) > 0.54 ? '#1d1b20' : '#ffffff';
}

function getReadableTextRgbToken(value: string): string {
  return getRgbLuminance(value) > 0.54 ? '29 27 32' : '255 255 255';
}

function getReadableSwatchOverlayColor(value: string): string {
  return getRgbLuminance(value) > 0.54 ? 'rgb(255 255 255 / 0.68)' : 'rgb(0 0 0 / 0.26)';
}

function getReadableSwatchBorderColor(value: string): string {
  return getRgbLuminance(value) > 0.72 ? 'rgb(0 0 0 / 0.16)' : 'rgb(255 255 255 / 0.36)';
}

function getSwatchBackgroundImage(value: string): string {
  if (getRgbLuminance(value) <= 0.82) {
    return 'none';
  }

  return [
    `linear-gradient(rgb(${value} / 0.9), rgb(${value} / 0.9))`,
    'repeating-linear-gradient(45deg, rgb(0 0 0 / 0.08) 0 1px, transparent 1px 10px)',
  ].join(', ');
}

function getSwatchShadow(value: string): string {
  return getRgbLuminance(value) > 0.82
    ? 'inset 0 0 0 1px rgb(0 0 0 / 0.18), inset 0 10px 26px rgb(0 0 0 / 0.04)'
    : 'inset 0 1px 10px rgb(0 0 0 / 0.08)';
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
  return toRgbString(
    hslToRgb({
      hue: normalizeHue(seedHsl.hue + hueOffsetDegrees / 360),
      lightness,
      saturation,
    }),
  );
}

function buildMaterialTheme(baseColor: RgbColor, themeName: string): MaterialThemeColors {
  const seedHsl = rgbToHsl(baseColor);
  const primary = hslToken(seedHsl, 0, 0.65, 0.4);

  return {
    background: hslToken(seedHsl, 0, 0.06, 0.97),
    primary,
    primaryContainer: hslToken(seedHsl, 0, 0.3, 0.92),
    primaryHover: hslToken(seedHsl, 0, 0.65, 0.34),
    secondary: hslToken(seedHsl, 30, 0.4, 0.45),
    sourceColor: toRgbString(baseColor),
    surface: hslToken(seedHsl, 0, 0.08, 0.93),
    tertiary: hslToken(seedHsl, -60, 0.5, 0.45),
    themeName,
  };
}

function getColorBucketKey(color: RgbColor): string {
  const redBucket = Math.floor(color.red / colorBucketSize);
  const greenBucket = Math.floor(color.green / colorBucketSize);
  const blueBucket = Math.floor(color.blue / colorBucketSize);

  return `${redBucket}-${greenBucket}-${blueBucket}`;
}

function getBucketAverageColor(bucket: ColorBucket): RgbColor {
  return {
    blue: bucket.blueTotal / bucket.count,
    green: bucket.greenTotal / bucket.count,
    red: bucket.redTotal / bucket.count,
  };
}

function isSeedCandidate(color: RgbColor): boolean {
  const hsl = rgbToHsl(color);

  return (
    hsl.saturation >= minimumSeedSaturation &&
    hsl.lightness >= minimumSeedLightness &&
    hsl.lightness <= maximumSeedLightness
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('无法读取图片文件。'));
    };

    reader.onerror = () => reject(new Error('无法读取图片文件。'));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('无法解析图片内容。'));
    image.src = source;
  });
}

async function extractDominantColor(file: File): Promise<RgbColor> {
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = sampleCanvasSize;
  canvas.height = sampleCanvasSize;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('当前浏览器不支持 Canvas 色彩分析。');
  }

  context.drawImage(image, 0, 0, sampleCanvasSize, sampleCanvasSize);

  const pixelData = context.getImageData(0, 0, sampleCanvasSize, sampleCanvasSize).data;
  const buckets = new Map<string, ColorBucket>();
  let fallbackColor: RgbColor | null = null;
  let fallbackSaturation = -1;

  for (let index = 0; index < pixelData.length; index += 4) {
    const alpha = pixelData[index + 3] ?? 0;

    if (alpha < 16) {
      continue;
    }

    const color: RgbColor = {
      blue: pixelData[index + 2] ?? 0,
      green: pixelData[index + 1] ?? 0,
      red: pixelData[index] ?? 0,
    };
    const hsl = rgbToHsl(color);

    if (hsl.saturation > fallbackSaturation) {
      fallbackColor = color;
      fallbackSaturation = hsl.saturation;
    }

    if (!isSeedCandidate(color)) {
      continue;
    }

    const bucketKey = getColorBucketKey(color);
    const bucket = buckets.get(bucketKey) ?? {
      blueTotal: 0,
      count: 0,
      greenTotal: 0,
      redTotal: 0,
    };

    bucket.blueTotal += color.blue;
    bucket.greenTotal += color.green;
    bucket.redTotal += color.red;
    bucket.count += 1;
    buckets.set(bucketKey, bucket);
  }

  if (buckets.size === 0 && !fallbackColor) {
    throw new Error('图片没有可分析的有效像素。');
  }

  let selectedBucket: ColorBucket | null = null;

  buckets.forEach((bucket) => {
    if (!selectedBucket || bucket.count > selectedBucket.count) {
      selectedBucket = bucket;
    }
  });

  return selectedBucket ? getBucketAverageColor(selectedBucket) : fallbackColor ?? { blue: 103, green: 80, red: 164 };
}

export default function Settings() {
  const storedCredentials = readSupabaseCredentials();
  const storedTheme = readStoredMaterialTheme() ?? buildMaterialThemeFromSeedColor(resolveRuntimeConfig().themeSeedColor);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { destroyAccountData, errorMessage, isDestroying } = useAccountDataDestruction();
  const [projectUrl, setProjectUrl] = useState(storedCredentials?.url ?? '');
  const [anonKey, setAnonKey] = useState(storedCredentials?.key ?? '');
  const [credentialSaved, setCredentialSaved] = useState(false);
  const [credentialError, setCredentialError] = useState('');
  const [theme, setTheme] = useState<MaterialThemeColors | null>(storedTheme);
  const [themeError, setThemeError] = useState('');
  const [isAnalyzingTheme, setIsAnalyzingTheme] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);

  useEffect(() => {
    if (!credentialSaved) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCredentialSaved(false);
    }, credentialSuccessDurationMs);

    return () => window.clearTimeout(timeoutId);
  }, [credentialSaved]);

  const handleCredentialSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCredentialError('');

    try {
      persistSupabaseCredentials({
        key: anonKey,
        url: projectUrl,
      });
      setCredentialSaved(true);
    } catch (error: unknown) {
      setCredentialSaved(false);
      setCredentialError(error instanceof Error ? error.message : '凭证保存失败，请检查输入内容。');
    }
  };

  const applyImageTheme = async (file: File) => {
    setThemeError('');
    setIsAnalyzingTheme(true);

    try {
      const dominantColor = await extractDominantColor(file);
      const nextTheme = buildMaterialTheme(dominantColor, file.name || '自定义主题');
      persistMaterialTheme(nextTheme);
      setTheme(nextTheme);
    } catch (error: unknown) {
      setThemeError(error instanceof Error ? error.message : '主题取色失败，请更换图片后重试。');
    } finally {
      setIsAnalyzingTheme(false);
    }
  };

  const applyPresetTheme = (preset: CharacterMaterialThemePreset) => {
    triggerSubtleInteractionFeedback();
    setThemeError('');
    persistMaterialTheme(preset.colors);
    setTheme(preset.colors);
  };

  const handlePaletteCollapseToggle = () => {
    triggerSubtleInteractionFeedback();
    setPaletteCollapsed((currentValue) => !currentValue);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      void applyImageTheme(file);
    }

    event.target.value = '';
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDraggingFile(false);

    const file = event.dataTransfer.files[0];
    if (file) {
      void applyImageTheme(file);
    }
  };

  const handleUploadKeyDown = (event: KeyboardEvent<HTMLLabelElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    fileInputRef.current?.click();
  };

  const handleDestroyConfirm = async () => {
    const destroyed = await destroyAccountData();

    if (!destroyed) {
      return;
    }

    window.localStorage.clear();
    clearMaterialThemeVariables();
    window.location.replace('/oobe');
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-[#6750a4] dark:text-[#d0bcff]">系统 Settings</p>
        <h1 className="text-3xl font-normal text-[#1d1b20] dark:text-[#e6e0e9]">系统设置</h1>
        <p className="max-w-3xl text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
          管理您的数据库、动态主题与账户数据
        </p>
      </header>

      <section className="rounded-[28px] border border-[#cac4d0] bg-[#fef7ff] p-5 shadow-sm dark:border-[#49454f] dark:bg-[#211f26] sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8def8] text-[#4f378b] dark:bg-[#4f378b] dark:text-[#eaddff]">
            <Database aria-hidden="true" className="size-5" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
              您的数据库URL和登录凭据
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
              连接到你的Supabase。注意：凭证将被保存至本机浏览器的缓存中
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleCredentialSubmit}>
          <label className="block">
            <span className="mb-1 block text-xs text-[#49454f] dark:text-[#cac4d0]">Project URL</span>
            <div className="flex h-12 items-center rounded-[16px] border border-[#79747e] px-4 transition-colors focus-within:border-[#6750a4] focus-within:ring-2 focus-within:ring-[#6750a4] dark:border-[#938f99]">
              <Database aria-hidden="true" className="mr-3 size-4 shrink-0 text-[#6750a4] dark:text-[#d0bcff]" strokeWidth={2} />
              <input
                autoCapitalize="none"
                autoComplete="url"
                className="min-w-0 flex-1 bg-transparent text-sm text-[#1d1b20] outline-none placeholder:text-[#79747e] dark:text-[#e6e0e9] dark:placeholder:text-[#938f99]"
                name={SUPABASE_URL_STORAGE_KEY}
                onChange={(event) => setProjectUrl(event.target.value)}
                placeholder="https://project-ref.supabase.co"
                spellCheck={false}
                type="url"
                value={projectUrl}
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-[#49454f] dark:text-[#cac4d0]">Publishable Key</span>
            <div className="flex h-12 items-center rounded-[16px] border border-[#79747e] px-4 transition-colors focus-within:border-[#6750a4] focus-within:ring-2 focus-within:ring-[#6750a4] dark:border-[#938f99]">
              <KeyRound aria-hidden="true" className="mr-3 size-4 shrink-0 text-[#6750a4] dark:text-[#d0bcff]" strokeWidth={2} />
              <input
                autoCapitalize="none"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-sm text-[#1d1b20] outline-none placeholder:text-[#79747e] dark:text-[#e6e0e9] dark:placeholder:text-[#938f99]"
                name={SUPABASE_KEY_STORAGE_KEY}
                onChange={(event) => setAnonKey(event.target.value)}
                placeholder="粘贴 sb_publishable 或 legacy anon key"
                spellCheck={false}
                type="password"
                value={anonKey}
              />
            </div>
          </label>

          <button
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#6750a4] px-6 text-sm font-medium text-white transition-colors hover:bg-[#5b4398] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6750a4] dark:bg-[#d0bcff] dark:text-[#381e72] dark:hover:bg-[#eaddff]"
            type="submit"
          >
            <CheckCircle2 aria-hidden="true" className="size-4" strokeWidth={2} />
            <span>更新凭证</span>
          </button>
        </form>

        <div
          className={`mt-5 flex items-start gap-3 rounded-[16px] border p-4 text-sm leading-6 transition-all duration-300 ${
            credentialSaved ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'
          }`}
          style={{
            backgroundColor: 'rgb(var(--m3-primary-container))',
            borderColor: 'rgb(var(--m3-primary))',
            color: 'rgb(var(--m3-primary))',
          }}
        >
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
          <span>凭证已保存到本地设备。</span>
        </div>

        {credentialError && (
          <div className="mt-5 flex items-start gap-3 rounded-[16px] border border-[#ba1a1a] bg-[#ffdad6] p-4 text-sm leading-6 text-[#410002] dark:border-[#ffb4ab] dark:bg-[#93000a] dark:text-[#ffdad6]">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
            <span>{credentialError}</span>
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-[#cac4d0] bg-[#fef7ff] p-5 shadow-sm dark:border-[#49454f] dark:bg-[#211f26] sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8def8] text-[#4f378b] dark:bg-[#4f378b] dark:text-[#eaddff]">
            <Paintbrush aria-hidden="true" className="size-5" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
              色彩预设
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
              从主题预设中快速切换全站主题色彩
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {characterMaterialThemePresets.map((preset) => {
            const isActiveTheme = theme?.themeName === preset.colors.themeName;

            return (
              <button
                aria-pressed={isActiveTheme}
                className="settings-theme-preset rounded-[24px] border p-4 text-left shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                key={preset.id}
                onClick={() => applyPresetTheme(preset)}
                style={{
                  backgroundColor: isActiveTheme
                    ? 'rgb(var(--m3-primary-container) / 0.5)'
                    : 'rgb(var(--m3-surface) / 0.56)',
                  borderColor: isActiveTheme ? 'rgb(var(--m3-primary) / 0.5)' : 'rgb(255 255 255 / 0.32)',
                }}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                      {preset.colors.themeName}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#49454f] dark:text-[#cac4d0]">
                      {preset.description}
                    </p>
                  </div>
                  {isActiveTheme && (
                    <CheckCircle2
                      aria-hidden="true"
                      className="size-5 shrink-0 text-[#6750a4] dark:text-[#d0bcff]"
                      strokeWidth={2}
                    />
                  )}
                </div>

                <div className="mt-4 grid grid-cols-6 gap-2">
                  {[
                    preset.colors.primary,
                    preset.colors.primaryContainer,
                    preset.colors.secondary,
                    preset.colors.tertiary,
                    preset.colors.surfaceVariant ?? preset.colors.primaryContainer,
                    preset.colors.surface,
                  ].map(
                    (colorToken) => (
                      <span
                        aria-hidden="true"
                        className="h-9 rounded-full border border-white/40 shadow-inner"
                        key={colorToken}
                        style={{ backgroundColor: `rgb(${colorToken})` }}
                      />
                    ),
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-[#cac4d0] bg-[#fef7ff] p-5 shadow-sm dark:border-[#49454f] dark:bg-[#211f26] sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8def8] text-[#4f378b] dark:bg-[#4f378b] dark:text-[#eaddff]">
            <Paintbrush aria-hidden="true" className="size-5" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
              动态取色
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
              上传图片后，系统会从采样画布中自动提取主题色。
            </p>
          </div>
        </div>

        <input
          accept="image/*"
          className="hidden"
          id="settings-theme-image-input"
          onChange={handleFileChange}
          ref={fileInputRef}
          type="file"
        />

        <label
          className={`flex min-h-48 w-full cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed p-6 text-center transition-[background-color,border-color,box-shadow] duration-200 ${
            isDraggingFile
              ? 'border-[#6750a4] bg-[#e8def8] dark:border-[#d0bcff] dark:bg-[#4a4458]'
              : 'border-[#79747e] bg-transparent hover:bg-[#f3edf7] dark:border-[#938f99] dark:hover:bg-[#2b2930]'
          }`}
          htmlFor="settings-theme-image-input"
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onKeyDown={handleUploadKeyDown}
          tabIndex={0}
        >
          <ImageUp aria-hidden="true" className="mb-3 size-8 text-[#6750a4] dark:text-[#d0bcff]" strokeWidth={2} />
          <p className="text-base font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
            {isAnalyzingTheme ? '正在分析图片色彩' : '点击或拖拽图片到这里'}
          </p>
          <p className="mt-2 max-w-md text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
            取色结果会实时写入全局 CSS 变量，并持久化保存到本地设备。
          </p>
        </label>

        {theme && (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
              当前主题：{theme.themeName}
            </p>
            <button
              aria-expanded={!paletteCollapsed}
              className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-full border border-white/30 px-4 text-sm font-medium text-[#6750a4] shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#f3edf7] active:translate-y-0 active:scale-[0.98] dark:text-[#d0bcff] dark:hover:bg-[#2b2930] sm:self-auto"
              onClick={handlePaletteCollapseToggle}
              type="button"
            >
              <span>{paletteCollapsed ? '展开调色板' : '折叠调色板'}</span>
              <ChevronDown
                aria-hidden="true"
                className={`size-4 transition-transform duration-200 ${paletteCollapsed ? '' : 'rotate-180'}`}
                strokeWidth={2}
              />
            </button>
          </div>
        )}

        {theme && (
          <div
            aria-hidden={paletteCollapsed}
            className={`grid transition-[grid-template-rows,opacity,margin-top] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
              paletteCollapsed ? 'mt-0 grid-rows-[0fr] opacity-0' : 'mt-5 grid-rows-[1fr] opacity-100'
            }`}
          >
            <div
              className={`min-h-0 overflow-hidden transition-[transform,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
                paletteCollapsed ? 'pointer-events-none -translate-y-2 scale-[0.985] blur-[1px]' : 'translate-y-0 scale-100 blur-0'
              }`}
            >
              <div className="settings-palette-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    { label: '--m3-primary', name: '主色', usage: '按钮与重点操作', value: theme.primary },
                    {
                      label: '--m3-on-primary',
                      name: '主色文字',
                      usage: '主色按钮上的文字',
                      value: theme.onPrimary ?? getReadableTextRgbToken(theme.primary),
                    },
                    {
                      label: '--m3-primary-container',
                      name: '主色容器',
                      usage: '导航胶囊与浅色强调',
                      value: theme.primaryContainer,
                    },
                    {
                      label: '--m3-on-primary-container',
                      name: '容器文字',
                      usage: '主色容器上的文字',
                      value: theme.onPrimaryContainer ?? getReadableTextRgbToken(theme.primaryContainer),
                    },
                    { label: '--m3-secondary', name: '辅助色', usage: '图表第二轴', value: theme.secondary },
                    { label: '--m3-tertiary', name: '第三色', usage: '图表第三轴', value: theme.tertiary },
                    { label: '--m3-background', name: '背景色', usage: '全局页面底色', value: theme.background },
                    { label: '--m3-surface', name: '表面色', usage: '卡片与侧边栏', value: theme.surface },
                    {
                      label: '--m3-surface-variant',
                      name: '变体表面',
                      usage: '图表底槽与弱层级',
                      value: theme.surfaceVariant ?? theme.primaryContainer,
                    },
                    {
                      label: '--m3-outline',
                      name: '轮廓线',
                      usage: '边框与分隔线',
                      value: theme.outline ?? theme.secondary,
                    },
                    {
                      label: '--m3-on-surface',
                      name: '表面文字',
                      usage: '正文与高对比文字',
                      value: theme.onSurface ?? getReadableTextRgbToken(theme.surface),
                    },
                  ] satisfies PaletteToken[]
                ).map((item) => {
                  const swatchTextColor = getReadableSwatchTextColor(item.value);
                  const overlayColor = getReadableSwatchOverlayColor(item.value);

                  return (
                    <div
                      className="rounded-[24px] border border-white/30 p-3 shadow-sm backdrop-blur-md dark:border-white/10"
                      key={item.label}
                      style={{ backgroundColor: 'rgb(var(--m3-surface) / 0.58)' }}
                    >
                      <div
                        className="flex h-24 flex-col justify-between rounded-[18px] border p-3 shadow-inner"
                        style={{
                          backgroundImage: getSwatchBackgroundImage(item.value),
                          backgroundColor: `rgb(${item.value})`,
                          borderColor: getReadableSwatchBorderColor(item.value),
                          color: swatchTextColor,
                          boxShadow: getSwatchShadow(item.value),
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span
                            className="rounded-full px-2.5 py-1 text-xs font-medium"
                            style={{
                              backgroundColor: overlayColor,
                              color: swatchTextColor,
                            }}
                          >
                            {item.name}
                          </span>
                          <span
                            className="rounded-full px-2.5 py-1 font-mono text-[11px] font-medium"
                            style={{
                              backgroundColor: overlayColor,
                              color: swatchTextColor,
                            }}
                          >
                            {toHexToken(item.value)}
                          </span>
                        </div>
                        <span
                          className="w-fit rounded-full px-2.5 py-1 text-xs"
                          style={{
                            backgroundColor: overlayColor,
                            color: swatchTextColor,
                          }}
                        >
                          {item.usage}
                        </span>
                      </div>

                      <div className="mt-3 space-y-2">
                        <p className="truncate font-mono text-xs font-medium text-[#49454f] dark:text-[#cac4d0]">
                          {item.label}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-[14px] border border-white/30 bg-white/50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                            <p className="text-[#79747e] dark:text-[#938f99]">RGB</p>
                            <p className="mt-1 font-mono font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                              {item.value}
                            </p>
                          </div>
                          <div className="rounded-[14px] border border-white/30 bg-white/50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                            <p className="text-[#79747e] dark:text-[#938f99]">HEX</p>
                            <p className="mt-1 font-mono font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                              {toHexToken(item.value)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {themeError && (
          <div className="mt-5 flex items-start gap-3 rounded-[16px] border border-[#ba1a1a] bg-[#ffdad6] p-4 text-sm leading-6 text-[#410002] dark:border-[#ffb4ab] dark:bg-[#93000a] dark:text-[#ffdad6]">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
            <span>{themeError}</span>
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-red-200/60 bg-red-50/40 p-5 shadow-sm dark:border-[#ffb4ab]/60 dark:bg-[#410002]/40 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ffdad6] text-[#ba1a1a] dark:bg-[#93000a] dark:text-[#ffdad6]">
            <ShieldAlert aria-hidden="true" className="size-5" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-xl font-medium text-[#410002] dark:text-[#ffdad6]">清空数据库</h2>
            <p className="mt-1 text-sm leading-6 text-[#410002] dark:text-[#ffdad6]">
              此操作会清空远程学习数据单词库与本地凭证和动态主题缓存。
            </p>
          </div>
        </div>

        <button
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#ba1a1a] px-6 text-sm font-medium text-white transition-colors hover:bg-[#93000a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba1a1a] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#ffb4ab] dark:text-[#690005] dark:hover:bg-[#ffdad6]"
          disabled={isDestroying}
          onClick={() => setConfirmModalOpen(true)}
          type="button"
        >
          <Trash2 aria-hidden="true" className="size-4" strokeWidth={2} />
          <span>注销账户并清空数据</span>
        </button>

        {errorMessage && (
          <div className="mt-5 flex items-start gap-3 rounded-[16px] border border-[#ba1a1a] bg-[#ffdad6] p-4 text-sm leading-6 text-[#410002] dark:border-[#ffb4ab] dark:bg-[#93000a] dark:text-[#ffdad6]">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
            <span>{errorMessage}</span>
          </div>
        )}
      </section>

      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000]/40 px-4 py-6 backdrop-blur-sm">
          <div
            aria-modal="true"
            className="w-full max-w-md rounded-[28px] border border-[#cac4d0] bg-[#fffbff] p-6 shadow-xl dark:border-[#49454f] dark:bg-[#211f26]"
            role="dialog"
          >
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ffdad6] text-[#ba1a1a] dark:bg-[#93000a] dark:text-[#ffdad6]">
                <AlertTriangle aria-hidden="true" className="size-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                  确认清空账户数据
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
                  系统将删除当前登录用户在 wordbase 与 review_logs 表中的数据，并清空本机全部本地存储。此操作完成后会返回首航引导页。
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="h-11 rounded-full px-5 text-sm font-medium text-[#6750a4] transition-colors hover:bg-[#f3edf7] disabled:cursor-not-allowed disabled:opacity-60 dark:text-[#d0bcff] dark:hover:bg-[#2b2930]"
                disabled={isDestroying}
                onClick={() => setConfirmModalOpen(false)}
                type="button"
              >
                取消
              </button>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#ba1a1a] px-5 text-sm font-medium text-white transition-colors hover:bg-[#93000a] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#ffb4ab] dark:text-[#690005] dark:hover:bg-[#ffdad6]"
                disabled={isDestroying}
                onClick={() => void handleDestroyConfirm()}
                type="button"
              >
                <Trash2 aria-hidden="true" className="size-4" strokeWidth={2} />
                <span>{isDestroying ? '正在清空' : '确定清空'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
