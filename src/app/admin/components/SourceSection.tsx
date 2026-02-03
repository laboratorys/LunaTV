/* eslint-disable no-console, @typescript-eslint/no-empty-function */
'use client';
import {
  closestCenter,
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { SectionConfigProps } from '@/lib/admin.types';

import { styles, useLoadingState } from '@/app/admin/components/UIComponents';
// 视频源数据类型
interface DataSource {
  name: string;
  key: string;
  api: string;
  detail?: string;
  disabled?: boolean;
  from: 'config' | 'custom';
}
const SourceSection = ({
  config,
  refresh,
  showAlert,
  showError,
}: SectionConfigProps) => {
  const { isLoading, withLoading } = useLoadingState();
  const [sources, setSources] = useState<DataSource[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);
  const [newSource, setNewSource] = useState<DataSource>({
    name: '',
    key: '',
    api: '',
    detail: '',
    disabled: false,
    from: 'config',
  });

  // 批量操作相关状态
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set()
  );

  // 使用 useMemo 计算全选状态，避免每次渲染都重新计算
  const selectAll = useMemo(() => {
    return selectedSources.size === sources.length && selectedSources.size > 0;
  }, [selectedSources.size, sources.length]);

  // 确认弹窗状态
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // 有效性检测相关状态
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<
    Array<{
      key: string;
      name: string;
      status: 'valid' | 'no_results' | 'invalid' | 'validating';
      message: string;
      resultCount: number;
    }>
  >([]);

  // dnd-kit 传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 轻微位移即可触发
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 长按 150ms 后触发，避免与滚动冲突
        tolerance: 5,
      },
    })
  );

  // 初始化
  useEffect(() => {
    if (config?.SourceConfig) {
      setSources(config.SourceConfig);
      // 进入时重置 orderChanged
      setOrderChanged(false);
      // 重置选择状态
      setSelectedSources(new Set());
    }
  }, [config]);

  // 通用 API 请求
  const callSourceApi = async (body: Record<string, any>) => {
    try {
      const resp = await fetch('/api/admin/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${resp.status}`);
      }

      // 成功后刷新配置
      await refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : '操作失败', showAlert);
      throw err; // 向上抛出方便调用处判断
    }
  };

  const handleToggleEnable = (key: string) => {
    const target = sources.find((s) => s.key === key);
    if (!target) return;
    const action = target.disabled ? 'enable' : 'disable';
    withLoading(`toggleSource_${key}`, () =>
      callSourceApi({ action, key })
    ).catch(() => {
      console.error('操作失败', action, key);
    });
  };

  const handleDelete = (key: string) => {
    withLoading(`deleteSource_${key}`, () =>
      callSourceApi({ action: 'delete', key })
    ).catch(() => {
      console.error('操作失败', 'delete', key);
    });
  };

  const handleAddSource = () => {
    if (!newSource.name || !newSource.key || !newSource.api) return;
    withLoading('addSource', async () => {
      await callSourceApi({
        action: 'add',
        key: newSource.key,
        name: newSource.name,
        api: newSource.api,
        detail: newSource.detail,
      });
      setNewSource({
        name: '',
        key: '',
        api: '',
        detail: '',
        disabled: false,
        from: 'custom',
      });
      setShowAddForm(false);
    }).catch(() => {
      console.error('操作失败', 'add', newSource);
    });
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sources.findIndex((s) => s.key === active.id);
    const newIndex = sources.findIndex((s) => s.key === over.id);
    setSources((prev) => arrayMove(prev, oldIndex, newIndex));
    setOrderChanged(true);
  };

  const handleSaveOrder = () => {
    const order = sources.map((s) => s.key);
    withLoading('saveSourceOrder', () =>
      callSourceApi({ action: 'sort', order })
    )
      .then(() => {
        setOrderChanged(false);
      })
      .catch(() => {
        console.error('操作失败', 'sort', order);
      });
  };

  // 有效性检测函数
  const handleValidateSources = async () => {
    if (!searchKeyword.trim()) {
      showAlert({
        type: 'warning',
        title: '请输入搜索关键词',
        message: '搜索关键词不能为空',
      });
      return;
    }

    await withLoading('validateSources', async () => {
      setIsValidating(true);
      setValidationResults([]); // 清空之前的结果
      setShowValidationModal(false); // 立即关闭弹窗

      // 初始化所有视频源为检测中状态
      const initialResults = sources.map((source) => ({
        key: source.key,
        name: source.name,
        status: 'validating' as const,
        message: '检测中...',
        resultCount: 0,
      }));
      setValidationResults(initialResults);

      try {
        // 使用EventSource接收流式数据
        const eventSource = new EventSource(
          `/api/admin/source/validate?q=${encodeURIComponent(
            searchKeyword.trim()
          )}`
        );

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            switch (data.type) {
              case 'start':
                console.log(`开始检测 ${data.totalSources} 个视频源`);
                break;

              case 'source_result':
              case 'source_error':
                // 更新验证结果
                setValidationResults((prev) => {
                  const existing = prev.find((r) => r.key === data.source);
                  if (existing) {
                    return prev.map((r) =>
                      r.key === data.source
                        ? {
                            key: data.source,
                            name:
                              sources.find((s) => s.key === data.source)
                                ?.name || data.source,
                            status: data.status,
                            message:
                              data.status === 'valid'
                                ? '搜索正常'
                                : data.status === 'no_results'
                                ? '无法搜索到结果'
                                : '连接失败',
                            resultCount: data.status === 'valid' ? 1 : 0,
                          }
                        : r
                    );
                  } else {
                    return [
                      ...prev,
                      {
                        key: data.source,
                        name:
                          sources.find((s) => s.key === data.source)?.name ||
                          data.source,
                        status: data.status,
                        message:
                          data.status === 'valid'
                            ? '搜索正常'
                            : data.status === 'no_results'
                            ? '无法搜索到结果'
                            : '连接失败',
                        resultCount: data.status === 'valid' ? 1 : 0,
                      },
                    ];
                  }
                });
                break;

              case 'complete':
                console.log(
                  `检测完成，共检测 ${data.completedSources} 个视频源`
                );
                eventSource.close();
                setIsValidating(false);
                break;
            }
          } catch (error) {
            console.error('解析EventSource数据失败:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('EventSource错误:', error);
          eventSource.close();
          setIsValidating(false);
          showAlert({
            type: 'error',
            title: '验证失败',
            message: '连接错误，请重试',
          });
        };

        // 设置超时，防止长时间等待
        setTimeout(() => {
          if (eventSource.readyState === EventSource.OPEN) {
            eventSource.close();
            setIsValidating(false);
            showAlert({
              type: 'warning',
              title: '验证超时',
              message: '检测超时，请重试',
            });
          }
        }, 60000); // 60秒超时
      } catch (error) {
        setIsValidating(false);
        showAlert({
          type: 'error',
          title: '验证失败',
          message: error instanceof Error ? error.message : '未知错误',
        });
        throw error;
      }
    });
  };

  // 获取有效性状态显示
  const getValidationStatus = (sourceKey: string) => {
    const result = validationResults.find((r) => r.key === sourceKey);
    if (!result) return null;

    switch (result.status) {
      case 'validating':
        return {
          text: '检测中',
          className:
            'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300',
          icon: '⟳',
          message: result.message,
        };
      case 'valid':
        return {
          text: '有效',
          className:
            'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300',
          icon: '✓',
          message: result.message,
        };
      case 'no_results':
        return {
          text: '无法搜索',
          className:
            'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300',
          icon: '⚠',
          message: result.message,
        };
      case 'invalid':
        return {
          text: '无效',
          className:
            'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300',
          icon: '✗',
          message: result.message,
        };
      default:
        return null;
    }
  };

  // 可拖拽行封装 (dnd-kit)
  const DraggableRow = ({ source }: { source: DataSource }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: source.key });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    } as React.CSSProperties;

    return (
      <tr
        ref={setNodeRef}
        style={style}
        className='hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors select-none'
      >
        <td
          className='px-2 py-4 cursor-grab text-gray-400'
          style={{ touchAction: 'none' }}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </td>
        <td className='px-2 py-4 text-center'>
          <input
            type='checkbox'
            checked={selectedSources.has(source.key)}
            onChange={(e) => handleSelectSource(source.key, e.target.checked)}
            className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
          />
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
          {source.name}
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
          {source.key}
        </td>
        <td
          className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 max-w-[12rem] truncate'
          title={source.api}
        >
          {source.api}
        </td>
        <td
          className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 max-w-[8rem] truncate'
          title={source.detail || '-'}
        >
          {source.detail || '-'}
        </td>
        <td className='px-6 py-4 whitespace-nowrap max-w-[1rem]'>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              !source.disabled
                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
            }`}
          >
            {!source.disabled ? '启用中' : '已禁用'}
          </span>
        </td>
        <td className='px-6 py-4 whitespace-nowrap max-w-[1rem]'>
          {(() => {
            const status = getValidationStatus(source.key);
            if (!status) {
              return (
                <span className='px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400'>
                  未检测
                </span>
              );
            }
            return (
              <span
                className={`px-2 py-1 text-xs rounded-full ${status.className}`}
                title={status.message}
              >
                {status.icon} {status.text}
              </span>
            );
          })()}
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
          <button
            onClick={() => handleToggleEnable(source.key)}
            disabled={isLoading(`toggleSource_${source.key}`)}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
              !source.disabled ? styles.roundedDanger : styles.roundedSuccess
            } transition-colors ${
              isLoading(`toggleSource_${source.key}`)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {!source.disabled ? '禁用' : '启用'}
          </button>
          {source.from !== 'config' && (
            <button
              onClick={() => handleDelete(source.key)}
              disabled={isLoading(`deleteSource_${source.key}`)}
              className={`${styles.roundedSecondary} ${
                isLoading(`deleteSource_${source.key}`)
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              删除
            </button>
          )}
        </td>
      </tr>
    );
  };

  // 全选/取消全选
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        const allKeys = sources.map((s) => s.key);
        setSelectedSources(new Set(allKeys));
      } else {
        setSelectedSources(new Set());
      }
    },
    [sources]
  );

  // 单个选择
  const handleSelectSource = useCallback((key: string, checked: boolean) => {
    setSelectedSources((prev) => {
      const newSelected = new Set(prev);
      if (checked) {
        newSelected.add(key);
      } else {
        newSelected.delete(key);
      }
      return newSelected;
    });
  }, []);

  // 批量操作
  const handleBatchOperation = async (
    action: 'batch_enable' | 'batch_disable' | 'batch_delete'
  ) => {
    if (selectedSources.size === 0) {
      showAlert({
        type: 'warning',
        title: '请先选择要操作的视频源',
        message: '请选择至少一个视频源',
      });
      return;
    }

    const keys = Array.from(selectedSources);
    let confirmMessage = '';
    let actionName = '';

    switch (action) {
      case 'batch_enable':
        confirmMessage = `确定要启用选中的 ${keys.length} 个视频源吗？`;
        actionName = '批量启用';
        break;
      case 'batch_disable':
        confirmMessage = `确定要禁用选中的 ${keys.length} 个视频源吗？`;
        actionName = '批量禁用';
        break;
      case 'batch_delete':
        confirmMessage = `确定要删除选中的 ${keys.length} 个视频源吗？此操作不可恢复！`;
        actionName = '批量删除';
        break;
    }

    // 显示确认弹窗
    setConfirmModal({
      isOpen: true,
      title: '确认操作',
      message: confirmMessage,
      onConfirm: async () => {
        try {
          await withLoading(`batchSource_${action}`, () =>
            callSourceApi({ action, keys })
          );
          showAlert({
            type: 'success',
            title: `${actionName}成功`,
            message: `${actionName}了 ${keys.length} 个视频源`,
            timer: 2000,
          });
          // 重置选择状态
          setSelectedSources(new Set());
        } catch (err) {
          showAlert({
            type: 'error',
            title: `${actionName}失败`,
            message: err instanceof Error ? err.message : '操作失败',
          });
        }
        setConfirmModal({
          isOpen: false,
          title: '',
          message: '',
          onConfirm: () => {},
          onCancel: () => {},
        });
      },
      onCancel: () => {
        setConfirmModal({
          isOpen: false,
          title: '',
          message: '',
          onConfirm: () => {},
          onCancel: () => {},
        });
      },
    });
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载中...
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className={`${styles.roundedCard}`}>
        {/* 添加视频源表单 */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
          <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'></h4>
          <div className='flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2'>
            {/* 批量操作按钮 - 移动端显示在下一行，PC端显示在左侧 */}
            {selectedSources.size > 0 && (
              <>
                <div className='flex flex-wrap items-center gap-3 order-2 sm:order-1'>
                  <span className='text-sm text-gray-600 dark:text-gray-400'>
                    <span className='sm:hidden'>
                      已选 {selectedSources.size}
                    </span>
                    <span className='hidden sm:inline'>
                      已选择 {selectedSources.size} 个视频源
                    </span>
                  </span>
                  <button
                    onClick={() => handleBatchOperation('batch_enable')}
                    disabled={isLoading('batchSource_batch_enable')}
                    className={`px-3 py-1 text-sm ${
                      isLoading('batchSource_batch_enable')
                        ? styles.disabled
                        : styles.success
                    }`}
                  >
                    {isLoading('batchSource_batch_enable')
                      ? '启用中...'
                      : '批量启用'}
                  </button>
                  <button
                    onClick={() => handleBatchOperation('batch_disable')}
                    disabled={isLoading('batchSource_batch_disable')}
                    className={`px-3 py-1 text-sm ${
                      isLoading('batchSource_batch_disable')
                        ? styles.disabled
                        : styles.warning
                    }`}
                  >
                    {isLoading('batchSource_batch_disable')
                      ? '禁用中...'
                      : '批量禁用'}
                  </button>
                  <button
                    onClick={() => handleBatchOperation('batch_delete')}
                    disabled={isLoading('batchSource_batch_delete')}
                    className={`px-3 py-1 text-sm ${
                      isLoading('batchSource_batch_delete')
                        ? styles.disabled
                        : styles.danger
                    }`}
                  >
                    {isLoading('batchSource_batch_delete')
                      ? '删除中...'
                      : '批量删除'}
                  </button>
                </div>
                <div className='hidden sm:block w-px h-6 bg-gray-300 dark:bg-gray-600 order-2'></div>
              </>
            )}
            <div className='flex items-center gap-2 order-1 sm:order-2'>
              <button
                onClick={() => setShowValidationModal(true)}
                disabled={isValidating}
                className={`px-3 py-1 text-sm rounded-lg transition-colors flex items-center space-x-1 ${
                  isValidating ? styles.disabled : styles.primary
                }`}
              >
                {isValidating ? (
                  <>
                    <div className='w-3 h-3 border border-white border-t-transparent rounded-full animate-spin'></div>
                    <span>检测中...</span>
                  </>
                ) : (
                  '有效性检测'
                )}
              </button>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className={showAddForm ? styles.secondary : styles.success}
              >
                {showAddForm ? '取消' : '添加视频源'}
              </button>
            </div>
          </div>
        </div>

        {showAddForm && (
          <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <input
                type='text'
                placeholder='名称'
                value={newSource.name}
                onChange={(e) =>
                  setNewSource((prev) => ({ ...prev, name: e.target.value }))
                }
                className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
              <input
                type='text'
                placeholder='Key'
                value={newSource.key}
                onChange={(e) =>
                  setNewSource((prev) => ({ ...prev, key: e.target.value }))
                }
                className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
              <input
                type='text'
                placeholder='API 地址'
                value={newSource.api}
                onChange={(e) =>
                  setNewSource((prev) => ({ ...prev, api: e.target.value }))
                }
                className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
              <input
                type='text'
                placeholder='Detail 地址（选填）'
                value={newSource.detail}
                onChange={(e) =>
                  setNewSource((prev) => ({ ...prev, detail: e.target.value }))
                }
                className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
            <div className='flex justify-end'>
              <button
                onClick={handleAddSource}
                disabled={
                  !newSource.name ||
                  !newSource.key ||
                  !newSource.api ||
                  isLoading('addSource')
                }
                className={`w-full sm:w-auto px-4 py-2 ${
                  !newSource.name ||
                  !newSource.key ||
                  !newSource.api ||
                  isLoading('addSource')
                    ? styles.disabled
                    : styles.success
                }`}
              >
                {isLoading('addSource') ? '添加中...' : '添加'}
              </button>
            </div>
          </div>
        )}

        {/* 视频源表格 */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          autoScroll={false}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        >
          <div
            className='border border-gray-200 dark:border-gray-700 rounded-lg max-h-[28rem] overflow-y-auto overflow-x-auto relative'
            data-table='source-list'
          >
            <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
              <thead className='bg-gray-50 dark:bg-gray-900 sticky top-0 z-10'>
                <tr>
                  <th className='w-8' />
                  <th className='w-12 px-2 py-3 text-center'>
                    <input
                      type='checkbox'
                      checked={selectAll}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
                    />
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                    名称
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                    Key
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                    API 地址
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                    Detail 地址
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                    状态
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                    有效性
                  </th>
                  <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                    操作
                  </th>
                </tr>
              </thead>

              <SortableContext
                items={sources.map((s) => s.key)}
                strategy={verticalListSortingStrategy}
              >
                <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                  {sources.map((source) => (
                    <DraggableRow key={source.key} source={source} />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </div>
        </DndContext>

        {/* 保存排序按钮 */}
        {orderChanged && (
          <div className='flex justify-end'>
            <button
              onClick={handleSaveOrder}
              disabled={isLoading('saveSourceOrder')}
              className={`px-3 py-1.5 text-sm ${
                isLoading('saveSourceOrder') ? styles.disabled : styles.primary
              }`}
            >
              {isLoading('saveSourceOrder') ? '保存中...' : '保存排序'}
            </button>
          </div>
        )}

        {/* 有效性检测弹窗 */}
        {showValidationModal &&
          createPortal(
            <div
              className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
              onClick={() => setShowValidationModal(false)}
            >
              <div
                className='bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4'
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-4'>
                  视频源有效性检测
                </h3>
                <p className='text-sm text-gray-600 dark:text-gray-400 mb-4'>
                  请输入检测用的搜索关键词
                </p>
                <div className='space-y-4'>
                  <input
                    type='text'
                    placeholder='请输入搜索关键词'
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    onKeyPress={(e) =>
                      e.key === 'Enter' && handleValidateSources()
                    }
                  />
                  <div className='flex justify-end space-x-3'>
                    <button
                      onClick={() => setShowValidationModal(false)}
                      className='px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors'
                    >
                      取消
                    </button>
                    <button
                      onClick={handleValidateSources}
                      disabled={!searchKeyword.trim()}
                      className={`px-4 py-2 ${
                        !searchKeyword.trim() ? styles.disabled : styles.primary
                      }`}
                    >
                      开始检测
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* 批量操作确认弹窗 */}
        {confirmModal.isOpen &&
          createPortal(
            <div
              className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
              onClick={confirmModal.onCancel}
            >
              <div
                className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full'
                onClick={(e) => e.stopPropagation()}
              >
                <div className='p-6'>
                  <div className='flex items-center justify-between mb-4'>
                    <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                      {confirmModal.title}
                    </h3>
                    <button
                      onClick={confirmModal.onCancel}
                      className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                    >
                      <svg
                        className='w-5 h-5'
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
                    <p className='text-sm text-gray-600 dark:text-gray-400'>
                      {confirmModal.message}
                    </p>
                  </div>

                  {/* 操作按钮 */}
                  <div className='flex justify-end space-x-3'>
                    <button
                      onClick={confirmModal.onCancel}
                      className={`px-4 py-2 text-sm font-medium ${styles.secondary}`}
                    >
                      取消
                    </button>
                    <button
                      onClick={confirmModal.onConfirm}
                      disabled={
                        isLoading('batchSource_batch_enable') ||
                        isLoading('batchSource_batch_disable') ||
                        isLoading('batchSource_batch_delete')
                      }
                      className={`px-4 py-2 text-sm font-medium ${
                        isLoading('batchSource_batch_enable') ||
                        isLoading('batchSource_batch_disable') ||
                        isLoading('batchSource_batch_delete')
                          ? styles.disabled
                          : styles.primary
                      }`}
                    >
                      {isLoading('batchSource_batch_enable') ||
                      isLoading('batchSource_batch_disable') ||
                      isLoading('batchSource_batch_delete')
                        ? '操作中...'
                        : '确认'}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
};
export default SourceSection;
