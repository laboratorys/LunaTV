/* eslint-disable no-console */
'use client';

import {
  Box,
  Database,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Settings,
  ToggleRight,
  Tv,
  Users,
  Video,
} from 'lucide-react';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { AdminConfig, AdminConfigResult } from '@/lib/admin.types';

import DataMigration from '@/components/DataMigration';
import PageLayout from '@/components/PageLayout';

import CategorySection from '@/app/admin/components/CategorySection';
import ConfigFile from '@/app/admin/components/ConfigFileSection';
import FeaturesSection from '@/app/admin/components/FeaturesSection';
import LiveSourceSection from '@/app/admin/components/LiveSourceSection';
import SiteSection from '@/app/admin/components/SiteSection';
import SourceSection from '@/app/admin/components/SourceSection';
import TVBoxSection from '@/app/admin/components/TVBoxSection';
import {
  AlertModal,
  showError,
  showSuccess,
  styles,
  useAlertModal,
  useLoadingState,
} from '@/app/admin/components/UIComponents';
import UserSection from '@/app/admin/components/UserSection';

function AdminPageClient() {
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isLoading, withLoading } = useLoadingState();
  const [showResetConfigModal, setShowResetConfigModal] = useState(false);
  const [role, setRole] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('');
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  useEffect(() => {
    const savedTab = localStorage.getItem('admin_active_tab');
    if (savedTab) {
      setActiveTab(savedTab);
    } else {
      setActiveTab('site');
    }
  }, []);
  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('admin_active_tab', activeTab);
    }
  }, [activeTab]);

  const fetchConfig = useCallback(async () => {
    return withLoading(`FetchConfig`, async () => {
      try {
        const resp = await fetch('/api/admin/config');
        const data = (await resp.json()) as AdminConfigResult;
        if (data) {
          setConfig(data.Config);
          setRole(data.Role);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '获取配置失败';
        showError(msg, showAlert);
        setError(msg);
      }
    });
  }, [withLoading, showAlert]);
  useEffect(() => {
    fetchConfig();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const handleResetConfig = () => {
    setShowResetConfigModal(true);
  };

  const handleConfirmResetConfig = async () => {
    await withLoading('resetConfig', async () => {
      try {
        const response = await fetch(`/api/admin/reset`);
        if (!response.ok) {
          throw new Error(`重置失败: ${response.status}`);
        }
        showSuccess('重置成功，请刷新页面！', showAlert);
        await fetchConfig();
        setShowResetConfigModal(false);
      } catch (err) {
        showError(err instanceof Error ? err.message : '重置失败', showAlert);
        throw err;
      }
    });
  };
  const tabs = [
    { id: 'configFile', label: '配置文件', icon: <FileText size={16} /> },
    { id: 'site', label: '站点配置', icon: <Settings size={16} /> },
    { id: 'toggles', label: '功能配置', icon: <ToggleRight size={16} /> },
    { id: 'user', label: '用户权限', icon: <Users size={16} /> },
    { id: 'source', label: '视频源配置', icon: <Video size={16} /> },
    { id: 'liveSource', label: '直播源配置', icon: <Tv size={16} /> },
    { id: 'tvbox', label: 'TVBox配置', icon: <Box size={16} /> },
    { id: 'category', label: '分类配置', icon: <FolderOpen size={16} /> },
    { id: 'migration', label: '迁移备份', icon: <Database size={16} /> },
  ];
  const SectionSkeleton = () => (
    <div className='animate-pulse space-y-8'>
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
        {/* 模拟两个主要的配置卡片 */}
        {[1, 2].map((i) => (
          <div
            key={i}
            className='p-6 bg-gray-100/50 dark:bg-gray-800/20 border border-gray-200/50 dark:border-white/5 rounded-3xl space-y-6'
          >
            <div className='flex items-center gap-2 mb-4'>
              <div className='w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full' />
              <div className='h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg' />
            </div>
            <div className='space-y-4'>
              <div className='h-16 w-full bg-gray-200/50 dark:bg-gray-700/30 rounded-2xl' />
              <div className='h-32 w-full bg-gray-200/50 dark:bg-gray-700/30 rounded-2xl' />
            </div>
          </div>
        ))}
      </div>
      {/* 模拟下方的保存按钮 */}
      <div className='mt-12 flex justify-center md:justify-end'>
        <div className='h-10 w-28 bg-gray-200 dark:bg-gray-700 rounded-xl' />
      </div>
    </div>
  );
  if (isLoading('FetchConfig')) {
    return (
      <PageLayout activePath='/admin'>
        {/* 调整容器宽度为 max-w-7xl (1280px) 或自定义宽度 */}
        <div className='mx-auto pb-10 px-4 sm:px-8 lg:px-12 max-w-[1440px]'>
          {/* 标题区 */}
          <div className='pt-8 pb-4 flex items-center gap-3'>
            <div className='flex items-center gap-3'>
              <div className='p-2.5 bg-emerald-500/10 rounded-xl'>
                <LayoutDashboard className='text-emerald-500 w-7 h-7' />
              </div>
              <h1 className='text-2xl font-bold dark:text-white text-gray-900 tracking-tight'>
                管理面板
              </h1>
            </div>
            {/* 重置按钮 */}
            <button
              onClick={handleResetConfig}
              className={`${styles.dangerSmall}`}
            >
              <span>重置配置</span>
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }
  if (error) {
    // 错误已通过弹窗展示，此处直接返回空
    return null;
  }
  return (
    <PageLayout activePath='/admin'>
      {/* 调整容器宽度为 max-w-7xl (1280px) 或自定义宽度 */}
      <div className='mx-auto pb-10 px-4 sm:px-8 lg:px-12 max-w-[1440px]'>
        {/* 标题区 */}
        <div className='pt-8 pb-4 flex items-center gap-3'>
          <div className='flex items-center gap-3'>
            <div className='p-2.5 bg-emerald-500/10 rounded-xl'>
              <LayoutDashboard className='text-emerald-500 w-7 h-7' />
            </div>
            <h1 className='text-2xl font-bold dark:text-white text-gray-900 tracking-tight'>
              管理面板
            </h1>
          </div>
          {/* 重置按钮 */}
          <button
            onClick={handleResetConfig}
            className={`${styles.dangerSmall}`}
          >
            <span>重置配置</span>
          </button>
        </div>

        {/* 顶部 Tab：全宽适应设计 */}
        <div className='sticky top-0 z-30 bg-transparent backdrop-blur-md pt-2 pb-6'>
          <div className='overflow-x-auto no-scrollbar touch-pan-x overscroll-contain'>
            <div className='inline-flex items-center gap-2 p-1.5 bg-gray-200/40 dark:bg-gray-800/45 border border-gray-200/50 dark:border-white/5 rounded-2xl min-w-max'>
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      relative flex items-center gap-2.5 px-5 py-2.5 text-sm font-medium transition-all duration-300 rounded-xl whitespace-nowrap
                      ${
                        isActive
                          ? 'text-emerald-600 dark:text-emerald-400 bg-white dark:bg-gray-700 shadow-[0_4px_14px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] ring-1 ring-black/5 dark:ring-white/10'
                          : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-300/40 dark:hover:bg-white/5'
                      }
                    `}
                  >
                    <span
                      className={`transition-all duration-300 ${
                        isActive
                          ? 'scale-110 opacity-100 text-emerald-500'
                          : 'opacity-60'
                      }`}
                    >
                      {tab.icon}
                    </span>
                    <span className='relative z-10'>{tab.label}</span>

                    {isActive && (
                      <span className='absolute inset-0 rounded-xl bg-emerald-500/[0.02] dark:bg-emerald-400/[0.02] pointer-events-none' />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 主内容区 */}
        <div className='min-h-[400px]'>
          {!config ? (
            <SectionSkeleton /> // 数据未加载时显示骨架
          ) : (
            <div className='animate-in fade-in slide-in-from-bottom-2 duration-500'>
              {activeTab === 'configFile' && (
                <ConfigFile
                  config={config}
                  role={role}
                  refresh={fetchConfig}
                  showAlert={showAlert}
                  showError={showError}
                  showSuccess={showSuccess}
                />
              )}
              {activeTab === 'site' && (
                <SiteSection
                  config={config}
                  role={role}
                  refresh={fetchConfig}
                  showAlert={showAlert}
                  showError={showError}
                  showSuccess={showSuccess}
                />
              )}
              {activeTab === 'toggles' && (
                <FeaturesSection
                  config={config}
                  role={role}
                  refresh={fetchConfig}
                  showAlert={showAlert}
                  showError={showError}
                  showSuccess={showSuccess}
                />
              )}
              {activeTab === 'user' && (
                <UserSection
                  config={config}
                  role={role}
                  refresh={fetchConfig}
                  showAlert={showAlert}
                  showError={showError}
                  showSuccess={showSuccess}
                />
              )}
              {activeTab === 'source' && (
                <SourceSection
                  config={config}
                  role={role}
                  refresh={fetchConfig}
                  showAlert={showAlert}
                  showError={showError}
                  showSuccess={showSuccess}
                />
              )}
              {activeTab === 'liveSource' && (
                <LiveSourceSection
                  config={config}
                  role={role}
                  refresh={fetchConfig}
                  showAlert={showAlert}
                  showError={showError}
                  showSuccess={showSuccess}
                />
              )}
              {activeTab === 'category' && (
                <CategorySection
                  config={config}
                  role={role}
                  refresh={fetchConfig}
                  showAlert={showAlert}
                  showError={showError}
                  showSuccess={showSuccess}
                />
              )}
              {activeTab === 'tvbox' && (
                <TVBoxSection
                  config={config}
                  role={role}
                  refresh={fetchConfig}
                  showAlert={showAlert}
                  showError={showError}
                  showSuccess={showSuccess}
                />
              )}
              {activeTab === 'migration' && <DataMigration />}
              {activeTab === '' && <div>加载中...</div>}
            </div>
          )}
        </div>
      </div>

      <AlertModal {...alertModal} onClose={hideAlert} />
      {/* 重置配置确认弹窗 */}
      {showResetConfigModal &&
        createPortal(
          <div
            className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
            onClick={() => setShowResetConfigModal(false)}
          >
            <div
              className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                    确认重置配置
                  </h3>
                  <button
                    onClick={() => setShowResetConfigModal(false)}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className='w-6 h-6'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <div className='mb-6'>
                  <div className='bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <svg
                        className='w-5 h-5 text-yellow-600 dark:text-yellow-400'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                        />
                      </svg>
                      <span className='text-sm font-medium text-yellow-800 dark:text-yellow-300'>
                        ⚠️ 危险操作警告
                      </span>
                    </div>
                    <p className='text-sm text-yellow-700 dark:text-yellow-400'>
                      此操作将重置用户封禁和管理员设置、自定义视频源，站点配置将重置为默认值，是否继续？
                    </p>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={() => setShowResetConfigModal(false)}
                    className={`px-6 py-2.5 text-sm font-medium ${styles.secondary}`}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmResetConfig}
                    disabled={isLoading('resetConfig')}
                    className={`px-6 py-2.5 text-sm font-medium ${
                      isLoading('resetConfig') ? styles.disabled : styles.danger
                    }`}
                  >
                    {isLoading('resetConfig') ? '重置中...' : '确认重置'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </PageLayout>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPageClient />
    </Suspense>
  );
}
