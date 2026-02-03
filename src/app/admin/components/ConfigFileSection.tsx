/* eslint-disable no-console */
'use client';

import { FileJson, RefreshCw, Save } from 'lucide-react';
import { useState } from 'react';

import { SectionConfigProps } from '@/lib/admin.types';

import ConfigToggle from '@/app/admin/components/ConfigToggle';
import CopyableInput from '@/app/admin/components/CopyableInput';

import { styles, useLoadingState } from './UIComponents';

export default function SiteSection({
  config,
  refresh,
  showAlert,
  showError,
  showSuccess,
}: SectionConfigProps) {
  const [configFile, setConfigFile] = useState(config?.ConfigFile || '');
  const [configSubscribtion, setConfigSubscribtion] = useState(
    config?.ConfigSubscribtion
  );
  const [lastCheckTime, setLastCheckTime] = useState<string>(
    config?.ConfigSubscribtion.LastCheck || ''
  );
  const { isLoading, withLoading } = useLoadingState();
  const [fetching, setFetching] = useState(false);

  const handleChange = (key: string, value: any) => {
    if (key === 'ConfigFile') {
      setConfigFile(value);
    } else {
      setConfigSubscribtion((prev: any) => ({ ...prev, [key]: value }));
    }
  };

  const handleUpdateConfig = async () => {
    return withLoading(`ConfigFile`, async () => {
      try {
        const res = await fetch('/api/admin/config_file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            configFile: configFile,
            subscriptionUrl: configSubscribtion?.URL,
            autoUpdate: configSubscribtion?.AutoUpdate,
            lastCheckTime: lastCheckTime || new Date().toISOString(),
          }),
        });
        if (res.ok) {
          showSuccess('保存成功, 请刷新页面', showAlert);
          refresh();
        }
      } catch (err) {
        showError(err instanceof Error ? err.message : '操作失败', showAlert);
        throw err;
      }
    });
  };

  const handleFetchConfig = async () => {
    if (!configSubscribtion?.URL.trim()) {
      showError('请输入订阅URL', showAlert);
      return;
    }
    setFetching(true);
    try {
      const resp = await fetch('/api/admin/config_subscription/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: configSubscribtion.URL.trim() }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `拉取失败: ${resp.status}`);
      }
      const data = await resp.json();
      if (data.configContent) {
        setConfigFile(data.configContent);
        const currentTime = new Date().toISOString();
        setLastCheckTime(currentTime);
        showSuccess('配置拉取成功', showAlert);
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : '拉取失败', showAlert);
      throw e;
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className='space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32'>
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
        <div className='space-y-8'>
          {/* 配置订阅卡片 */}
          <div className='p-6 bg-white/50 dark:bg-gray-800/20 backdrop-blur-sm border border-gray-200/50 dark:border-white/5 rounded-3xl space-y-6'>
            <div className='flex flex-col sm:flex-row sm:items-center gap-2 mb-2'>
              <div className='flex items-center gap-2'>
                <RefreshCw className='text-emerald-500 w-5 h-5' />
                <h3 className='font-bold dark:text-white text-lg'>配置订阅</h3>
              </div>

              <div className='text-xs sm:text-sm text-gray-500 dark:text-gray-400 sm:px-3 py-1.5 rounded-full bg-gray-100/50 dark:bg-white/5 sm:bg-transparent w-fit'>
                最后更新:{' '}
                {lastCheckTime
                  ? new Date(lastCheckTime).toLocaleString('zh-CN')
                  : '从未更新'}
              </div>
            </div>

            <div className='space-y-5'>
              <div>
                <CopyableInput
                  label=' 订阅 URL'
                  value={configSubscribtion?.URL || ''}
                  description=' 输入配置文件的订阅地址，要求 JSON 格式，且使用 Base58 编码'
                  placeholder='https://example.com/config.txt'
                  onChange={(val) => handleChange('URL', val)}
                  readOnly={false}
                />
                <div className='pt-2'>
                  <button
                    onClick={handleFetchConfig}
                    disabled={fetching || !configSubscribtion?.URL}
                    className={`w-full px-6 py-3 rounded-lg text-sm font-medium transition-all duration-2000 ${
                      fetching ? styles.disabled : styles.success
                    }`}
                  >
                    {fetching ? (
                      <div className='flex items-center justify-center gap-2'>
                        <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                        拉取中…
                      </div>
                    ) : (
                      '拉取配置'
                    )}
                  </button>
                </div>
              </div>

              <ConfigToggle
                label='自动更新'
                description='启用后系统将定期自动拉取最新配置'
                enabled={configSubscribtion?.AutoUpdate || false}
                onChange={() =>
                  handleChange('AutoUpdate', !configSubscribtion?.AutoUpdate)
                }
              />
            </div>
          </div>
        </div>

        {/* 右侧：JSON 编辑器区域 */}
        <div className='p-6 bg-white/50 dark:bg-gray-800/20 backdrop-blur-sm border border-gray-200/50 dark:border-white/5 rounded-3xl space-y-6 flex flex-col'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <FileJson className='text-blue-500 w-5 h-5' />
              <h3 className='font-bold dark:text-white text-lg'>
                配置文件内容
              </h3>
            </div>
            <span className='text-[10px] bg-blue-500/10 text-blue-500 px-2 py-1 rounded-lg font-bold uppercase'>
              JSON Mode
            </span>
          </div>

          <div className='relative flex-1 group'>
            <textarea
              value={configFile || ''}
              onChange={(e) => handleChange('ConfigFile', e.target.value)}
              rows={22}
              spellCheck={false}
              className={`${styles.input} !rounded-2xl text-[13px] leading-relaxed resize-none h-[500px] transition-all border-blue-500/10 focus:border-blue-500/30 dark:bg-black/20`}
              placeholder='请输入配置文件内容...'
            />
          </div>
          <p className='text-[11px] text-gray-400 italic'>
            支持 JSON 格式，用于配置视频源和自定义分类
          </p>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className='mt-12 mb-8 flex justify-center md:justify-end'>
        <button
          onClick={handleUpdateConfig}
          disabled={isLoading('ConfigFile')}
          className={`flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium transition-all w-full md:w-auto ${
            isLoading('ConfigFile') ? styles.disabled : styles.success
          } `}
        >
          {isLoading('ConfigFile') ? (
            <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
          ) : (
            <Save size={16} />
          )}
          {isLoading('ConfigFile') ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
