/* eslint-disable no-console */
'use client';

import { ExternalLink, Globe, Link2, Save, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { SectionConfigProps } from '@/lib/admin.types';

import CustomDropdown from '@/components/CustomDropdown';

import ConfigToggle from '@/app/admin/components/ConfigToggle';
import { styles, useLoadingState } from '@/app/admin/components/UIComponents';

// 豆瓣代理预设选项
const DOUBAN_PROXIES = [
  { value: 'direct', label: '直连（服务器直接请求豆瓣）' },
  { value: 'cors-proxy-zwei', label: 'Cors Proxy By Zwei' },
  { value: 'cmliussss-cdn-tencent', label: '豆瓣 CDN By CMLiussss（腾讯云）' },
  { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
  { value: 'custom', label: '自定义代理' },
];

const DOUBAN_IMAGE_PROXIES = [
  { value: 'direct', label: '直连（浏览器直接请求豆瓣）', disabled: true },
  { value: 'server', label: '服务器代理（由服务器代理请求豆瓣）' },
  { value: 'img3', label: '豆瓣官方精品 CDN（阿里云）' },
  { value: 'cmliussss-cdn-tencent', label: '豆瓣 CDN By CMLiussss（腾讯云）' },
  { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
  { value: 'custom', label: '自定义代理' },
];

export default function SiteSection({
  config,
  refresh,
  showError,
  showAlert,
  showSuccess,
}: SectionConfigProps) {
  const [siteConfig, setSiteConfig] = useState(config?.SiteConfig);
  const { isLoading, withLoading } = useLoadingState();

  const handleUpdateConfig = async () => {
    return withLoading(`SiteConfig`, async () => {
      try {
        const res = await fetch('/api/admin/site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...siteConfig }),
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
  const handleChange = (key: string, value: any) => {
    setSiteConfig((prev: any) => ({ ...prev, [key]: value }));
  };
  return (
    <div className='space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32'>
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
        <div className='space-y-8'>
          {/* 基本设置 */}
          <div className={`${styles.roundedCard}`}>
            <div className='flex items-center gap-2 mb-2'>
              <Globe className='text-green-500 w-5 h-5' />
              <h3 className='font-bold dark:text-white text-lg'>基本设置</h3>
            </div>
            <div className='space-y-5'>
              <div>
                <label className='block text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 ml-1'>
                  网站名称
                </label>
                <input
                  className={styles.input}
                  value={siteConfig?.SiteName}
                  onChange={(e) => handleChange('SiteName', e.target.value)}
                />
              </div>
              <div>
                <label className='block text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 ml-1'>
                  站点公告
                </label>
                <textarea
                  className={`${styles.input} !rounded-2xl h-32 resize-none transition-all`}
                  value={siteConfig?.Announcement}
                  onChange={(e) => handleChange('Announcement', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 豆瓣设置 */}
          <div className={`${styles.roundedCard}`}>
            <div className='flex items-center gap-2'>
              <Link2 className='text-green-500 w-5 h-5' />
              <h3 className='font-bold dark:text-white text-lg'>
                豆瓣数据代理
              </h3>
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              {/* 数据接口代理 */}
              <div className='space-y-2'>
                <label className='block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1'>
                  数据接口代理
                </label>
                <CustomDropdown
                  options={DOUBAN_PROXIES}
                  value={siteConfig?.DoubanProxyType || ''}
                  onChange={(val: string) =>
                    handleChange('DoubanProxyType', val)
                  }
                  className='w-full'
                />
                {siteConfig?.DoubanProxyType === 'custom' && (
                  <input
                    placeholder='请输入自定义数据代理地址'
                    className={`${styles.input} !text-[11px] !py-1.5 animate-in fade-in zoom-in-95 duration-200`}
                    value={siteConfig.DoubanProxy || ''}
                    onChange={(e) =>
                      handleChange('CustomDoubanProxy', e.target.value)
                    }
                  />
                )}
                <p className='text-[11px] text-gray-400 dark:text-gray-500 italic px-1'>
                  选择获取豆瓣数据的方式
                </p>
              </div>

              {/* 豆瓣图片代理 */}
              <div className='space-y-2'>
                <label className='block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1'>
                  豆瓣图片代理
                </label>
                <CustomDropdown
                  options={DOUBAN_IMAGE_PROXIES}
                  value={siteConfig?.DoubanImageProxyType || ''}
                  onChange={(val: string) =>
                    handleChange('DoubanImageProxyType', val)
                  }
                  className='w-full'
                />
                {siteConfig?.DoubanImageProxyType === 'custom' && (
                  <input
                    placeholder='请输入自定义图片代理地址'
                    className={`${styles.input} !text-[11px] !py-1.5 animate-in fade-in zoom-in-95 duration-200`}
                    value={siteConfig?.DoubanImageProxy || ''}
                    onChange={(e) =>
                      handleChange('CustomDoubanImageProxy', e.target.value)
                    }
                  />
                )}
                <p className='text-[11px] text-gray-400 dark:text-gray-500 italic px-1'>
                  选择获取豆瓣图片的方式
                </p>
              </div>
            </div>
            <div className='pt-0 mt-1 space-y-2'>
              <div className='px-1 flex items-center gap-2'>
                <span className='text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500'>
                  Thanks to:
                </span>
                <div className='flex items-center gap-3'>
                  <a
                    href='https://github.com/cmliu'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-[11px] text-green-600/80 hover:text-green-500 dark:text-green-400/80 transition-colors flex items-center gap-1'
                  >
                    @CMLiussss <ExternalLink size={10} />
                  </a>
                  <a
                    href='https://douban.com'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-[11px] text-green-600/80 hover:text-green-500 dark:text-green-400/80 transition-colors flex items-center gap-1'
                  >
                    豆瓣电影 <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 系统策略 */}
        <div className={`${styles.roundedCard}`}>
          <div className='flex items-center gap-2 mb-2'>
            <ShieldCheck className='text-green-500 w-5 h-5' />
            <h3 className='font-bold dark:text-white text-lg'>系统策略</h3>
          </div>
          <div className='grid grid-cols-1 gap-4'>
            <div>
              <label className='block text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 ml-1'>
                搜索接口可拉取最大页数
              </label>
              <input
                type='number'
                min={1}
                className={styles.input}
                value={siteConfig?.SearchDownstreamMaxPage}
                onChange={(e) =>
                  handleChange('SearchDownstreamMaxPage', e.target.value)
                }
              />
            </div>
            <div>
              <label className='block text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 ml-1'>
                站点接口缓存时间（秒）
              </label>
              <input
                type='number'
                min={1}
                className={styles.input}
                value={siteConfig?.SiteInterfaceCacheTime}
                onChange={(e) =>
                  handleChange('SiteInterfaceCacheTime', e.target.value)
                }
              />
            </div>
            <ConfigToggle
              label='禁用黄色过滤器'
              description='禁用黄色内容的过滤功能'
              enabled={siteConfig?.DisableYellowFilter || false}
              onChange={() =>
                handleChange(
                  'DisableYellowFilter',
                  !siteConfig?.DisableYellowFilter
                )
              }
            />
            <ConfigToggle
              label='开放注册'
              description='允许新访客自行注册账号'
              enabled={siteConfig?.OpenRegister || false}
              onChange={() =>
                handleChange('OpenRegister', !siteConfig?.OpenRegister)
              }
            />
            <ConfigToggle
              label='流式搜索'
              description='开启后搜索结果将实时逐个渲染显示'
              enabled={siteConfig?.FluidSearch || true}
              onChange={() =>
                handleChange('FluidSearch', !siteConfig?.FluidSearch)
              }
            />
          </div>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className='mt-12 mb-8 flex justify-center md:justify-end'>
        <button
          onClick={handleUpdateConfig}
          disabled={isLoading('SiteConfig')}
          className={`
      flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium transition-all
      w-full md:w-auto ${
        isLoading('SiteConfig') ? styles.disabled : styles.success
      }
    `}
        >
          {isLoading('SiteConfig') ? (
            <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
          ) : (
            <Save size={16} />
          )}
          {isLoading('SiteConfig') ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
