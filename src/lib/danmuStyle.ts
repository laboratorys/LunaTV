'use client';

/**
 * 弹幕播放器设置（持久化到 localStorage）。
 */

export interface DanmuStyleSettings {
  visible: boolean;
  opacity: number;
  fontSize: number;
  speed: number;
  displayArea: number;
  density: number;
}

export const DANMU_STYLE_STORAGE_KEY = 'luna_danmu_style';

/**
 * 弹幕速度档位（参考 B 站 5 档）。
 * value 为弹幕穿过屏幕的持续时间（秒），越大越慢，与插件 speed 选项一致。
 */
export const DANMU_SPEED_STEPS = [
  { label: '极慢', value: 10 },
  { label: '较慢', value: 7.5 },
  { label: '适中', value: 5 },
  { label: '快速', value: 2.5 },
  { label: '极速', value: 1 },
] as const;

/** 显示区域档位：4 档，每 25% 一档 */
export const DANMU_AREA_STEPS = [0.25, 0.5, 0.75, 1] as const;

/** 密度统计窗口（秒）：每窗口内最多显示 density 条，近似「同屏条数」 */
export const DANMU_DENSITY_WINDOW = 5;

/**
 * 弹幕密度档位（参考 B 站）：每个 5 秒窗口内最多显示多少条弹幕。
 * 超过上限时在该窗口内均匀抽样，避免只保留开头几条、画面节奏断层。
 */
export const DANMU_DENSITY_STEPS = [
  { label: '极疏', value: 3 },
  { label: '稀疏', value: 6 },
  { label: '适中', value: 12 },
  { label: '密集', value: 20 },
  { label: '极密', value: 30 },
] as const;

const MOBILE_FONT_SIZE = 16;
const DESKTOP_FONT_SIZE = 20;

const isMobileViewport = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(max-width: 768px)').matches;

/** 字号默认值按设备区分：移动端 16，桌面 20 */
const defaultFontSize = (): number =>
  isMobileViewport() ? MOBILE_FONT_SIZE : DESKTOP_FONT_SIZE;

const snapToStops = (value: number, stops: readonly number[]): number =>
  stops.reduce(
    (best, current) =>
      Math.abs(current - value) < Math.abs(best - value) ? current : best,
    stops[0],
  );

/**
 * 设置结构版本，仅在结构变化、需丢弃旧数据时递增。
 * 调整默认值不要递增，否则会覆盖用户已调好的偏好。
 */
const DANMU_STYLE_VERSION = 2;

export const DEFAULT_DANMU_STYLE: DanmuStyleSettings = {
  visible: true,
  opacity: 1,
  fontSize: DESKTOP_FONT_SIZE,
  speed: 7.5,
  displayArea: 0.5,
  density: 12,
};

/** 无本地存储时的默认设置（字号按设备区分） */
const getDefaultDanmuStyle = (): DanmuStyleSettings => ({
  ...DEFAULT_DANMU_STYLE,
  fontSize: defaultFontSize(),
});

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const sanitizeDanmuStyle = (raw: unknown): DanmuStyleSettings => {
  const source =
    raw && typeof raw === 'object' ? (raw as Partial<DanmuStyleSettings>) : {};
  const toNumber = (value: unknown, fallback: number): number => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  return {
    visible:
      typeof source.visible === 'boolean'
        ? source.visible
        : DEFAULT_DANMU_STYLE.visible,
    opacity: clamp(
      toNumber(source.opacity, DEFAULT_DANMU_STYLE.opacity),
      0.1,
      1,
    ),
    fontSize: clamp(
      toNumber(source.fontSize, DEFAULT_DANMU_STYLE.fontSize),
      12,
      60,
    ),
    speed: snapToStops(
      clamp(toNumber(source.speed, DEFAULT_DANMU_STYLE.speed), 1, 10),
      DANMU_SPEED_STEPS.map((step) => step.value),
    ),
    displayArea: snapToStops(
      clamp(
        toNumber(source.displayArea, DEFAULT_DANMU_STYLE.displayArea),
        0.1,
        1,
      ),
      DANMU_AREA_STEPS,
    ),
    density: snapToStops(
      clamp(toNumber(source.density, DEFAULT_DANMU_STYLE.density), 1, 100),
      DANMU_DENSITY_STEPS.map((step) => step.value),
    ),
  };
};

/**
 * 按密度抽稀弹幕：每 windowSec 秒窗口内最多保留 maxPerWindow 条。
 * 超出时在窗口内等距取样，保持整段节奏均匀（不会只剩窗口开头几条）。
 * maxPerWindow <= 0 时原样返回。
 */
export const applyDanmuDensity = <T extends { time: number }>(
  list: T[],
  maxPerWindow: number,
  windowSec: number = DANMU_DENSITY_WINDOW,
): T[] => {
  if (maxPerWindow <= 0 || windowSec <= 0) return list;

  const result: T[] = [];
  let bucket: T[] = [];
  let currentWindow = -1;

  const flush = () => {
    if (bucket.length === 0) return;
    if (bucket.length <= maxPerWindow) {
      result.push(...bucket);
    } else {
      const step = bucket.length / maxPerWindow;
      for (let i = 0; i < maxPerWindow; i += 1) {
        result.push(bucket[Math.floor(i * step)]);
      }
    }
    bucket = [];
  };

  list.forEach((item) => {
    const windowIndex = Math.floor(item.time / windowSec);
    if (windowIndex !== currentWindow) {
      flush();
      currentWindow = windowIndex;
    }
    bucket.push(item);
  });
  flush();

  return result;
};

interface StoredDanmuStyle {
  version?: number;
  settings?: DanmuStyleSettings;
  /** 用户手动调整过的字段，这些字段不再被设备默认值覆盖 */
  manual?: string[];
}

const readStoredDanmuStyle = (): StoredDanmuStyle | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DANMU_STYLE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredDanmuStyle) : null;
  } catch {
    return null;
  }
};

export const loadDanmuStyle = (): DanmuStyleSettings => {
  const stored = readStoredDanmuStyle();
  // 旧版本结构或版本不匹配时重置为默认值
  if (stored?.version !== DANMU_STYLE_VERSION || !stored?.settings) {
    return getDefaultDanmuStyle();
  }
  const next = sanitizeDanmuStyle(stored.settings);
  // 没手动调过字号时按当前设备给默认值（移动端 16 / 桌面 20）
  const manual = Array.isArray(stored.manual) ? stored.manual : [];
  if (!manual.includes('fontSize')) next.fontSize = defaultFontSize();
  return next;
};

export const saveDanmuStyle = (settings: Partial<DanmuStyleSettings>): void => {
  if (typeof window === 'undefined') return;
  try {
    const manual = new Set<string>(readStoredDanmuStyle()?.manual ?? []);
    Object.keys(settings).forEach((key) => manual.add(key));
    const next = sanitizeDanmuStyle({
      ...loadDanmuStyle(),
      ...settings,
    });
    window.localStorage.setItem(
      DANMU_STYLE_STORAGE_KEY,
      JSON.stringify({
        version: DANMU_STYLE_VERSION,
        settings: next,
        manual: [...manual],
      }),
    );
  } catch {
    // 忽略存储失败
  }
};
