/* eslint-disable no-console */
'use client';
import { Save } from 'lucide-react';
import { useState } from 'react';

import { SectionConfigProps } from '@/lib/admin.types';

import ConfigToggle from '@/app/admin/components/ConfigToggle';
import { styles, useLoadingState } from '@/app/admin/components/UIComponents';

interface FeaturesConfig {
  douban: boolean;
  shortDrama: boolean;
  source: boolean;
  live: boolean;
}
export default function FeaturesSection({
  config,
  refresh,
  showAlert,
  showError,
  showSuccess,
}: SectionConfigProps) {
  const [featuresConfig, setFeaturesConfig] = useState<FeaturesConfig>({
    douban: config?.FeaturesConfig?.douban ?? true,
    shortDrama: config?.FeaturesConfig?.shortDrama ?? true,
    source: config?.FeaturesConfig?.source ?? false,
    live: config?.FeaturesConfig?.live ?? false,
  });
  const { isLoading, withLoading } = useLoadingState();
  const handleUpdateConfig = async () => {
    return withLoading(`TvboxConfig`, async () => {
      try {
        const resp = await fetch('/api/admin/features', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...featuresConfig }),
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

  const handleChange = (key: string, value: any) => {
    setFeaturesConfig((prev: any) => ({ ...prev, [key]: value }));
  };

  return (
    <div className='space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32'>
      <div className='grid grid-cols-1'>
        <div className={`${styles.roundedCard}`}>
          <div className='grid grid-cols-1 gap-4'>
            <ConfigToggle
              label='豆瓣'
              description='关闭后将影响菜单和首页数据'
              enabled={featuresConfig.douban}
              onChange={() => handleChange('douban', !featuresConfig.douban)}
            />
            <ConfigToggle
              label='短剧'
              description='关闭后将无法显示短剧菜单'
              enabled={featuresConfig.shortDrama}
              onChange={() =>
                handleChange('shortDrama', !featuresConfig.shortDrama)
              }
            />
            <ConfigToggle
              label='直播'
              description='关闭后将无法显示直播菜单'
              enabled={featuresConfig.live}
              onChange={() => handleChange('live', !featuresConfig.live)}
            />
            <ConfigToggle
              label='播放源'
              description='关闭后将无法显示播放源菜单'
              enabled={featuresConfig.source}
              onChange={() => handleChange('source', !featuresConfig.source)}
            />
          </div>
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
