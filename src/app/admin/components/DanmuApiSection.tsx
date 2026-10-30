'use client';

import { Eye, EyeOff, MessageSquareText, TestTube2 } from 'lucide-react';
import { useState } from 'react';

import { styles, useLoadingState } from '@/app/admin/components/UIComponents';

export type DanmuSource = 'site' | 'file' | 'none';

interface DanmuCardProps {
  url: string;
  token: string;
  source: DanmuSource;
  onUrlChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  showAlert: (config: any) => void;
  showError: (message: string, showAlert?: (config: any) => void) => void;
  showSuccess: (message: string, showAlert?: (config: any) => void) => void;
}

export default function DanmuApiSection({
  url,
  token,
  source,
  onUrlChange,
  onTokenChange,
  showAlert,
  showError,
  showSuccess,
}: DanmuCardProps) {
  const [showToken, setShowToken] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const { isLoading, withLoading } = useLoadingState();

  const handleTest = async () => {
    return withLoading('DanmuApiTest', async () => {
      setTestResult(null);
      try {
        const resp = await fetch('/api/admin/danmu/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, token }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) {
          throw new Error(data.details || data.error || '连接失败');
        }
        setTestResult(
          `连接成功，耗时 ${data.elapsed}ms，返回 ${data.sampleCount} 条结果`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : '连接失败';
        setTestResult(msg);
        showError(msg, showAlert);
        throw err;
      }
    });
  };

  return (
    <div className={`${styles.roundedCard}`}>
      <div className='flex items-center gap-2 mb-5'>
        <MessageSquareText className='text-primary-500 w-5 h-5' />
        <h3 className='font-bold text-gray-900 dark:text-white text-lg'>
          弹幕配置
        </h3>
      </div>
      <div className='space-y-4'>
        <div className='text-sm text-gray-600 dark:text-gray-400'>
          配置弹幕
          API（danmu_api）。留空地址即关闭弹幕功能，播放器将不再显示弹幕开关与设置面板。
        </div>

        {source === 'file' && (
          <div className='text-xs px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'>
            当前弹幕 API 由配置文件提供，保存后将覆盖为站点配置。
          </div>
        )}
        {source === 'site' && (
          <div className='text-xs px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300'>
            当前弹幕 API
            已在站点配置中生效；重新拉取配置订阅时会同步为订阅文件里的
            danmu_api。
          </div>
        )}

        <label className='block text-sm'>
          <span className='block mb-1 text-gray-700 dark:text-gray-300'>
            弹幕 API 地址
          </span>
          <input
            type='text'
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder='https://your-danmu-api.example.com'
            className='w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-primary-500'
          />
        </label>

        <label className='block text-sm'>
          <span className='block mb-1 text-gray-700 dark:text-gray-300'>
            TOKEN（必填）
          </span>
          <div className='relative'>
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(event) => onTokenChange(event.target.value)}
              placeholder='请输入弹幕服务的 TOKEN'
              autoComplete='off'
              className='w-full px-3 py-2 pr-10 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-primary-500'
            />
            <button
              type='button'
              onClick={() => setShowToken((prev) => !prev)}
              aria-label={showToken ? '隐藏 TOKEN' : '显示 TOKEN'}
              className='absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            >
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        {testResult && (
          <div className='text-xs px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'>
            {testResult}
          </div>
        )}

        <div className='flex flex-wrap gap-2 pt-1'>
          <button
            type='button'
            onClick={handleTest}
            disabled={isLoading('DanmuApiTest')}
            className={`flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium transition-all ${
              isLoading('DanmuApiTest') ? styles.disabled : styles.secondary
            }`}
          >
            <TestTube2 size={16} />
            {isLoading('DanmuApiTest') ? '测试中...' : '测试连接'}
          </button>
        </div>
      </div>
    </div>
  );
}
