'use client';

import {
  Box,
  Cpu,
  Download,
  ExternalLink,
  Heart,
  History,
  RefreshCw,
  Smartphone,
  Tv,
  Zap,
} from 'lucide-react';

import PageLayout from '@/components/PageLayout';

const REPO_BASE =
  'https://github.com/laboratorys/TV-Release/releases/latest/download';
const MIRROR_BASE = 'https://down.npee.cn/?';

const DOWNLOAD_LINKS = {
  tv_arm64: {
    url: `${REPO_BASE}/leanback-arm64_v8a.apk`,
    mirror: `${MIRROR_BASE}${REPO_BASE}/leanback-arm64_v8a.apk`,
  },
  tv_v7a: {
    url: `${REPO_BASE}/leanback-armeabi_v7a.apk`,
    mirror: `${MIRROR_BASE}${REPO_BASE}/leanback-armeabi_v7a.apk`,
  },
  mobile_arm64: {
    url: `${REPO_BASE}/mobile-arm64_v8a.apk`,
    mirror: `${MIRROR_BASE}${REPO_BASE}/mobile-arm64_v8a.apk`,
  },
  mobile_v7a: {
    url: `${REPO_BASE}/mobile-armeabi_v7a.apk`,
    mirror: `${MIRROR_BASE}${REPO_BASE}/mobile-armeabi_v7a.apk`,
  },
};

export default function DownloadPage() {
  const packageList = [
    {
      name: 'leanback-arm64_v8a.apk',
      label: 'TV端 (arm64)',
      size: '48 MB',
      icon: <Tv className='w-6 h-6' />,
      desc: '适配高性能电视/盒子',
      config: DOWNLOAD_LINKS.tv_arm64,
    },
    {
      name: 'leanback-armeabi_v7a.apk',
      label: 'TV端 (v7a)',
      size: '41.1 MB',
      icon: <Box className='w-6 h-6' />,
      desc: '适配老旧机型/投影仪',
      config: DOWNLOAD_LINKS.tv_v7a,
    },
    {
      name: 'mobile-arm64_v8a.apk',
      label: '手机端 (arm64)',
      size: '47.9 MB',
      icon: <Smartphone className='w-6 h-6' />,
      desc: '新款主流 Android 手机',
      config: DOWNLOAD_LINKS.mobile_arm64,
    },
    {
      name: 'mobile-armeabi_v7a.apk',
      label: '手机端 (v7a)',
      size: '41.1 MB',
      icon: <Smartphone className='w-6 h-6' />,
      desc: '老款机型或 32 位系统',
      config: DOWNLOAD_LINKS.mobile_v7a,
    },
  ];

  const handleDownload = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <PageLayout activePath='/download'>
      <div className='px-4 sm:px-10 py-8 min-h-screen relative max-w-7xl mx-auto'>
        {/* 背景光晕 */}
        <div className='fixed inset-0 -z-10 overflow-hidden pointer-events-none'>
          <div className='absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-green-200/20 dark:bg-green-600/10 rounded-full blur-[120px]' />
          <div className='absolute bottom-[10%] left-[-10%] w-[400px] h-[400px] bg-emerald-200/20 dark:bg-emerald-600/10 rounded-full blur-[100px]' />
        </div>

        {/* 1. 头部标题 */}
        <div className='mb-16 flex flex-col items-center text-center'>
          <div className='inline-flex items-center gap-2 bg-green-500/10 dark:bg-green-400/10 px-3 py-1 rounded-full mb-6 border border-green-500/20'>
            <Zap
              size={14}
              className='text-green-600 dark:text-green-400 fill-current'
            />
            <span className='text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wider'>
              Lab Edition
            </span>
          </div>

          <h1 className='text-4xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight mb-4'>
            TVBox{' '}
            <span className='bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent'>
              魔改版
            </span>
          </h1>

          <p className='text-gray-500 dark:text-gray-400 max-w-lg text-base leading-relaxed'>
            极简、流畅、强大的全端影音方案。
            <br />
            基于官方上游实时同步，专为追求极致体验的用户打造。
          </p>
        </div>

        {/* 2. 下载网格 */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16'>
          {packageList.map((pkg, idx) => (
            <div
              key={idx}
              className='relative group bg-white/80 dark:bg-gray-800/50 rounded-[2rem] p-6 border border-gray-200 dark:border-gray-700/50 backdrop-blur-md hover:border-green-500/50 transition-all duration-300 hover:shadow-[0_20px_40px_-15px_rgba(34,197,94,0.15)]'
            >
              <div className='flex justify-between items-start mb-6'>
                <div className='p-3 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-500/20 dark:to-emerald-500/10 rounded-2xl text-green-600 dark:text-green-400 shadow-sm group-hover:scale-110 transition-transform duration-300'>
                  {pkg.icon}
                </div>
                <div className='px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-bold rounded-lg tracking-wider'>
                  {pkg.size}
                </div>
              </div>

              <div className='space-y-3 mb-8'>
                <div>
                  <h3 className='text-lg font-bold text-gray-800 dark:text-gray-100'>
                    {pkg.label}
                  </h3>
                  <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                    {pkg.desc}
                  </p>
                </div>

                {/* 优化的文件名展示区域 */}
                <div className='relative group/code'>
                  <div className='absolute -top-2 left-2 px-1 bg-white dark:bg-gray-800 text-[9px] text-gray-400 font-medium'>
                    Filename
                  </div>
                  <code className='block w-full text-[11px] font-mono text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/80 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-800 break-all leading-snug shadow-inner'>
                    {pkg.name}
                  </code>
                </div>
              </div>

              <div className='space-y-3'>
                <button
                  onClick={() => handleDownload(pkg.config.url)}
                  className='w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 active:scale-[0.96] transition-all'
                >
                  <Download size={18} strokeWidth={2.5} /> 立即下载
                </button>
                <button
                  onClick={() => handleDownload(pkg.config.mirror)}
                  className='w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-gray-400 hover:text-green-600 dark:text-gray-500 dark:hover:text-green-400 transition-colors'
                >
                  <ExternalLink size={14} /> 备用下载
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 3. 底部特性区 */}
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
          <div className='lg:col-span-2 bg-gradient-to-br from-white/50 to-green-50/30 dark:from-gray-800/50 dark:to-green-900/5 rounded-[2.5rem] p-8 border border-gray-200 dark:border-gray-700/50 shadow-sm'>
            <h2 className='flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100 mb-8'>
              <div className='p-2 bg-green-500 rounded-lg text-white'>
                <Cpu size={20} />
              </div>
              版本选择指南
            </h2>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
              {[
                {
                  title: 'arm64-v8a',
                  desc: '高性能首选，支持新款旗舰手机与高性能盒子。',
                },
                {
                  title: 'armeabi-v7a',
                  desc: '极致兼容版，适用于老旧设备或投影仪。',
                },
                {
                  title: 'Leanback',
                  desc: 'TV 专用 UI，针对遥控器交互深度优化，操作顺滑。',
                },
                {
                  title: 'Mobile',
                  desc: '移动端手势优化，支持竖屏模式及沉浸式交互。',
                },
              ].map((item, i) => (
                <div key={i} className='flex gap-4'>
                  <div className='h-2 w-2 rounded-full bg-green-500 mt-2 shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.6)]' />
                  <div>
                    <h4 className='text-sm font-bold text-gray-800 dark:text-gray-200 mb-1'>
                      {item.title}
                    </h4>
                    <p className='text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed'>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className='space-y-4'>
            {[
              {
                title: '播放记录同步',
                icon: <History size={18} />,
                desc: 'Lab 修改版核心特性',
              },
              {
                title: '全量同步收藏',
                icon: <Heart size={18} />,
                desc: '账号多端数据实时互通',
              },
              {
                title: '上游代码同步',
                icon: <RefreshCw size={18} />,
                desc: '自动构建官方最新 Commits',
              },
            ].map((item, i) => (
              <div
                key={i}
                className='group flex items-center gap-4 p-5 bg-white/60 dark:bg-gray-800/40 rounded-3xl border border-gray-100 dark:border-gray-700 hover:border-green-500/40 transition-all cursor-default'
              >
                <div className='p-3 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 rounded-2xl group-hover:bg-green-500 group-hover:text-white transition-all duration-300'>
                  {item.icon}
                </div>
                <div>
                  <h4 className='text-xs font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider'>
                    {item.title}
                  </h4>
                  <p className='text-[11px] text-gray-500 dark:text-gray-500 mt-0.5'>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
