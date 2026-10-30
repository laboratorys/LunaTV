'use client';

import { useEffect, useRef, useState } from 'react';

import {
  DANMU_AREA_STEPS,
  DANMU_DENSITY_STEPS,
  DANMU_SPEED_STEPS,
  type DanmuStyleSettings,
} from '@/lib/danmuStyle';

interface DanmuSettingsPanelProps {
  value: DanmuStyleSettings;
  statusText: string;
  onChange: (patch: Partial<DanmuStyleSettings>) => void;
  onClose: () => void;
  onOpenMatch: () => void;
}

// 拖动滑块时最多每 120ms 提交一次，避免整页重渲染与插件重排造成卡顿
const COMMIT_INTERVAL = 120;

const nearestIndex = (value: number, stops: readonly number[]): number =>
  stops.reduce(
    (best, current, index) =>
      Math.abs(current - value) < Math.abs(stops[best] - value) ? index : best,
    0,
  );

interface DanmuSliderProps {
  label: string;
  value: number;
  format: (value: number) => string;
  onCommit: (value: number) => void;
  /** 固定档位（实际值，由小到大）：给出后按档位吸附并显示刻度点 */
  stops?: readonly number[];
  min?: number;
  max?: number;
  step?: number;
  /** 只在松手/失焦时提交：字号变更会触发插件重排，拖动中实时提交会明显卡顿 */
  commitOnEnd?: boolean;
}

const DanmuSlider = ({
  label,
  value,
  format,
  onCommit,
  stops,
  min = 0,
  max = 1,
  step = 0.01,
  commitOnEnd = false,
}: DanmuSliderProps) => {
  const [draft, setDraft] = useState(value);
  const draggingRef = useRef(false);
  const lastCommitRef = useRef(0);
  const pendingRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 外部值变化时同步；拖动过程中不打断本地草稿
  useEffect(() => {
    if (!draggingRef.current) setDraft(value);
  }, [value]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const flush = () => {
    if (pendingRef.current === null) return;
    const next = pendingRef.current;
    pendingRef.current = null;
    lastCommitRef.current = Date.now();
    onCommit(next);
  };

  const commitThrottled = (next: number) => {
    pendingRef.current = next;
    const elapsed = Date.now() - lastCommitRef.current;
    if (elapsed >= COMMIT_INTERVAL) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      flush();
      return;
    }
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flush();
    }, COMMIT_INTERVAL - elapsed);
  };

  const handleEnd = () => {
    draggingRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (commitOnEnd) {
      pendingRef.current = null;
      if (draft !== value) onCommit(draft);
      return;
    }
    flush();
  };

  const activeIndex = stops ? nearestIndex(draft, stops) : 0;
  const displayValue = stops ? stops[activeIndex] : draft;
  const percent = stops
    ? stops.length > 1
      ? (activeIndex / (stops.length - 1)) * 100
      : 0
    : max > min
      ? ((draft - min) / (max - min)) * 100
      : 0;

  return (
    <label className='block text-xs space-y-1'>
      <span className='flex justify-between'>
        <span>{label}</span>
        <span>{format(displayValue)}</span>
      </span>
      <div className='relative flex items-center'>
        <input
          type='range'
          min={stops ? 0 : min}
          max={stops ? stops.length - 1 : max}
          step={stops ? 1 : step}
          value={stops ? activeIndex : draft}
          onChange={(event) => {
            const raw = Number(event.target.value);
            const next = stops ? stops[raw] : raw;
            setDraft(next);
            if (!commitOnEnd) commitThrottled(next);
          }}
          onPointerDown={() => {
            draggingRef.current = true;
          }}
          onPointerUp={handleEnd}
          onPointerCancel={handleEnd}
          onKeyUp={handleEnd}
          onBlur={handleEnd}
          className='w-full block'
          style={{
            background: `linear-gradient(to right, var(--danmu-accent) ${percent}%, rgba(255, 255, 255, 0.2) ${percent}%)`,
          }}
        />
        {stops && (
          <div className='pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between'>
            {stops.map((stop, index) => (
              <span
                key={stop}
                className={`h-1.5 w-1.5 rounded-full ${
                  index <= activeIndex ? 'bg-white' : 'bg-white/40'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </label>
  );
};

const DanmuSettingsPanel = ({
  value,
  statusText,
  onChange,
  onClose,
  onOpenMatch,
}: DanmuSettingsPanelProps) => (
  <div
    className='danmu-settings-panel absolute bottom-14 right-3 w-64 max-w-[calc(100%-1.5rem)] max-h-[calc(100%-4rem)] overflow-y-auto rounded-xl bg-black/85 backdrop-blur-sm border border-white/15 p-4 space-y-3 text-white'
    onClick={(event) => event.stopPropagation()}
    onPointerDown={(event) => event.stopPropagation()}
  >
    <div className='flex items-center justify-between'>
      <span className='text-sm font-medium'>弹幕设置</span>
      <button
        type='button'
        onClick={onClose}
        className='text-white/60 hover:text-white text-lg leading-none'
        aria-label='关闭弹幕设置'
      >
        ×
      </button>
    </div>

    <DanmuSlider
      label='显示区域'
      value={value.displayArea}
      stops={DANMU_AREA_STEPS}
      format={(v) => `${Math.round(v * 100)}%`}
      onCommit={(v) => onChange({ displayArea: v })}
    />

    <DanmuSlider
      label='不透明度'
      value={value.opacity}
      min={0.1}
      max={1}
      step={0.05}
      format={(v) => `${Math.round(v * 100)}%`}
      onCommit={(v) => onChange({ opacity: v })}
    />

    <DanmuSlider
      label='字体大小'
      value={value.fontSize}
      min={12}
      max={60}
      step={1}
      commitOnEnd
      format={(v) => `${v}px`}
      onCommit={(v) => onChange({ fontSize: v })}
    />

    <DanmuSlider
      label='弹幕速度'
      value={value.speed}
      stops={DANMU_SPEED_STEPS.map((item) => item.value)}
      format={(v) =>
        DANMU_SPEED_STEPS.find((item) => item.value === v)?.label ?? String(v)
      }
      onCommit={(v) => onChange({ speed: v })}
    />

    <DanmuSlider
      label='弹幕密度'
      value={value.density}
      stops={DANMU_DENSITY_STEPS.map((item) => item.value)}
      commitOnEnd
      format={(v) =>
        DANMU_DENSITY_STEPS.find((item) => item.value === v)?.label ?? String(v)
      }
      onCommit={(v) => onChange({ density: v })}
    />

    <div className='pt-1 border-t border-white/15 space-y-2'>
      <div className='text-[11px] text-white/60'>{statusText}</div>
      <button
        type='button'
        onClick={onOpenMatch}
        className='w-full px-3 py-1.5 text-xs rounded-lg bg-primary-500 hover:bg-primary-600 transition-colors'
      >
        匹配不准？手动搜索切换
      </button>
    </div>
  </div>
);

export default DanmuSettingsPanel;
