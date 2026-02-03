/* eslint-disable no-console */
'use client';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';

import { SectionConfigProps } from '@/lib/admin.types';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import CustomDropdown from '@/components/CustomDropdown';

import ConfigToggle from '@/app/admin/components/ConfigToggle';
import CopyableInput from '@/app/admin/components/CopyableInput';
import { styles, useLoadingState } from '@/app/admin/components/UIComponents';

interface TvBoxConfig {
  disabled: boolean;
  expireSeconds: number;
}

export default function TVBoxSection({
  config,
  refresh,
  showAlert,
  showError,
  showSuccess,
}: SectionConfigProps) {
  const [tvboxConfig, setTvboxConfig] = useState<TvBoxConfig>({
    disabled: config?.TvBoxConfig?.disabled ?? true,
    expireSeconds: config?.TvBoxConfig?.expireSeconds ?? 12 * 60 * 60,
  });
  const { isLoading, withLoading } = useLoadingState();
  const initialCacheTime = tvboxConfig.expireSeconds;
  const [cacheTimeValue, setCacheTimeValue] = useState<number>(() => {
    if (initialCacheTime % 2592000 === 0) return initialCacheTime / 2592000; // 月
    if (initialCacheTime % 604800 === 0) return initialCacheTime / 604800; // 星期
    if (initialCacheTime % 86400 === 0) return initialCacheTime / 86400; // 天
    if (initialCacheTime % 3600 === 0) return initialCacheTime / 3600; // 小时
    return initialCacheTime / 60; // 分钟（默认）
  });

  const [cacheTimeUnit, setCacheTimeUnit] = useState<string>(() => {
    if (initialCacheTime % 2592000 === 0) return 'months';
    if (initialCacheTime % 604800 === 0) return 'weeks';
    if (initialCacheTime % 86400 === 0) return 'days';
    if (initialCacheTime % 3600 === 0) return 'hours';
    return 'minutes'; // 默认
  });
  const handleUpdateConfig = async () => {
    return withLoading(`TvboxConfig`, async () => {
      try {
        const resp = await fetch('/api/admin/tvbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...tvboxConfig }),
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || `保存失败: ${resp.status}`);
        }
        if (resp.ok) {
          showSuccess('保存成功, 请刷新页面', showAlert);
          refresh();
        }
      } catch (err) {
        showError(err instanceof Error ? err.message : '保存失败', showAlert);
        throw err;
      }
    });
  };
  const calculateSeconds = (val: number, unit: string) => {
    const factors: Record<string, number> = {
      minutes: 60,
      hours: 3600,
      days: 86400,
      weeks: 604800,
      months: 2592000,
    };
    return val * (factors[unit] || 1);
  };
  const handleChange = (key: string, value: any) => {
    setTvboxConfig((prev: any) => ({ ...prev, [key]: value }));
  };
  const getTvBoxApiUrl = () => {
    const currentUsername = getAuthInfoFromBrowserCookie()?.username || null;
    const userMatch = config?.UserConfig.Users.find(
      (u: any) => u.username === currentUsername
    );
    const userKey = userMatch ? userMatch.key : '';
    return `${window.location.protocol}//${window.location.host}/api/tvbox?k=${userKey}`;
  };
  useEffect(() => {
    let seconds: number;
    switch (cacheTimeUnit) {
      case 'minutes':
        seconds = cacheTimeValue * 60;
        break;
      case 'hours':
        seconds = cacheTimeValue * 3600;
        break;
      case 'days':
        seconds = cacheTimeValue * 86400;
        break;
      case 'weeks':
        seconds = cacheTimeValue * 604800;
        break;
      case 'months':
        seconds = cacheTimeValue * 2592000;
        break;
      default:
        seconds = cacheTimeValue;
    }
    setTvboxConfig((prev) => ({
      ...prev,
      expireSeconds: seconds,
    }));
  }, [cacheTimeValue, cacheTimeUnit]);
  return (
    <div className='space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32'>
      <div className='grid grid-cols-1'>
        {/* 系统策略 */}
        <div className={`${styles.roundedCard}`}>
          <div className='grid grid-cols-1 gap-4'>
            <ConfigToggle
              label='开启TvBox'
              description='由于开启后无法对配置接口进行认证，请不要暴露你的接口地址给陌生人。'
              enabled={tvboxConfig.disabled}
              onChange={() => handleChange('disabled', !tvboxConfig.disabled)}
            />
          </div>
          <div>
            <label className='block text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 ml-1'>
              缓存有效期
            </label>
            <div className='flex gap-2'>
              <input
                type='number'
                min={0}
                className={`!w-1/2 ${styles.input}`}
                value={cacheTimeValue}
                onChange={(e) => {
                  const newVal = Number(e.target.value);
                  setCacheTimeValue(newVal);
                  handleChange(
                    'expireSeconds',
                    calculateSeconds(newVal, cacheTimeUnit)
                  );
                }}
              />
              {/* 时间单位下拉框 */}
              <CustomDropdown
                options={[
                  { value: 'minutes', label: '分钟' },
                  { value: 'hours', label: '小时' },
                  { value: 'days', label: '天' },
                  { value: 'weeks', label: '星期' },
                  { value: 'months', label: '月' },
                ]}
                value={cacheTimeUnit}
                onChange={(newUnit: string) => {
                  setCacheTimeUnit(newUnit);
                  handleChange(
                    'expireSeconds',
                    calculateSeconds(cacheTimeValue, newUnit)
                  );
                }}
              />
            </div>

            <p className='text-[11px] text-gray-400 dark:text-gray-500 italic px-1'>
              设置成0可以关闭缓存
            </p>
          </div>
          {/* 配置接口 */}
          <CopyableInput
            label='配置接口'
            value={getTvBoxApiUrl()}
            description='请将此链接填入 TVBox 的配置地址栏中'
            readOnly={true}
          />
        </div>
      </div>

      {/* 保存按钮 */}
      <div className='mt-12 mb-8 flex justify-center md:justify-end'>
        <button
          onClick={handleUpdateConfig}
          disabled={isLoading('TvboxConfig')}
          className={`flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium transition-all w-full md:w-auto ${
            isLoading('TvboxConfig') ? styles.disabled : styles.success
          } `}
        >
          {isLoading('TvboxConfig') ? (
            <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
          ) : (
            <Save size={16} />
          )}
          {isLoading('TvboxConfig') ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
