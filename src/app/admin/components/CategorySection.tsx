/* eslint-disable no-console */
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
import React, { useEffect, useState } from 'react';

import { SectionConfigProps } from '@/lib/admin.types';

import { styles, useLoadingState } from '@/app/admin/components/UIComponents';
// 自定义分类数据类型
interface CustomCategory {
  name?: string;
  type: 'movie' | 'tv';
  query: string;
  disabled?: boolean;
  from: 'config' | 'custom';
}
const CategorySection = ({
  config,
  refresh,
  showAlert,
  showError,
}: SectionConfigProps) => {
  const { isLoading, withLoading } = useLoadingState();
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);
  const [newCategory, setNewCategory] = useState<CustomCategory>({
    name: '',
    type: 'movie',
    query: '',
    disabled: false,
    from: 'config',
  });

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
    if (config?.CustomCategories) {
      setCategories(config.CustomCategories);
      // 进入时重置 orderChanged
      setOrderChanged(false);
    }
  }, [config]);

  // 通用 API 请求
  const callCategoryApi = async (body: Record<string, any>) => {
    try {
      const resp = await fetch('/api/admin/category', {
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

  const handleToggleEnable = (query: string, type: 'movie' | 'tv') => {
    const target = categories.find((c) => c.query === query && c.type === type);
    if (!target) return;
    const action = target.disabled ? 'enable' : 'disable';
    withLoading(`toggleCategory_${query}_${type}`, () =>
      callCategoryApi({ action, query, type })
    ).catch(() => {
      console.error('操作失败', action, query, type);
    });
  };

  const handleDelete = (query: string, type: 'movie' | 'tv') => {
    withLoading(`deleteCategory_${query}_${type}`, () =>
      callCategoryApi({ action: 'delete', query, type })
    ).catch(() => {
      console.error('操作失败', 'delete', query, type);
    });
  };

  const handleAddCategory = () => {
    if (!newCategory.name || !newCategory.query) return;
    withLoading('addCategory', async () => {
      await callCategoryApi({
        action: 'add',
        name: newCategory.name,
        type: newCategory.type,
        query: newCategory.query,
      });
      setNewCategory({
        name: '',
        type: 'movie',
        query: '',
        disabled: false,
        from: 'custom',
      });
      setShowAddForm(false);
    }).catch(() => {
      console.error('操作失败', 'add', newCategory);
    });
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex(
      (c) => `${c.query}:${c.type}` === active.id
    );
    const newIndex = categories.findIndex(
      (c) => `${c.query}:${c.type}` === over.id
    );
    setCategories((prev) => arrayMove(prev, oldIndex, newIndex));
    setOrderChanged(true);
  };

  const handleSaveOrder = () => {
    const order = categories.map((c) => `${c.query}:${c.type}`);
    withLoading('saveCategoryOrder', () =>
      callCategoryApi({ action: 'sort', order })
    )
      .then(() => {
        setOrderChanged(false);
      })
      .catch(() => {
        console.error('操作失败', 'sort', order);
      });
  };

  // 可拖拽行封装 (dnd-kit)
  const DraggableRow = ({ category }: { category: CustomCategory }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: `${category.query}:${category.type}` });

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
          {...{ ...attributes, ...listeners }}
        >
          <GripVertical size={16} />
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
          {category.name || '-'}
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              category.type === 'movie'
                ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                : 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
            }`}
          >
            {category.type === 'movie' ? '电影' : '电视剧'}
          </span>
        </td>
        <td
          className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 max-w-[12rem] truncate'
          title={category.query}
        >
          {category.query}
        </td>
        <td className='px-6 py-4 whitespace-nowrap max-w-[1rem]'>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              !category.disabled
                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
            }`}
          >
            {!category.disabled ? '启用中' : '已禁用'}
          </span>
        </td>
        <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
          <button
            onClick={() => handleToggleEnable(category.query, category.type)}
            disabled={isLoading(
              `toggleCategory_${category.query}_${category.type}`
            )}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
              !category.disabled ? styles.roundedDanger : styles.roundedSuccess
            } transition-colors ${
              isLoading(`toggleCategory_${category.query}_${category.type}`)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            {!category.disabled ? '禁用' : '启用'}
          </button>
          {category.from !== 'config' && (
            <button
              onClick={() => handleDelete(category.query, category.type)}
              disabled={isLoading(
                `deleteCategory_${category.query}_${category.type}`
              )}
              className={`${styles.roundedSecondary} ${
                isLoading(`deleteCategory_${category.query}_${category.type}`)
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
        {/* 添加分类表单 */}
        <div className='flex items-center justify-between'>
          <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'></h4>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              showAddForm ? styles.secondary : styles.success
            }`}
          >
            {showAddForm ? '取消' : '添加分类'}
          </button>
        </div>

        {showAddForm && (
          <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <input
                type='text'
                placeholder='分类名称'
                value={newCategory.name}
                onChange={(e) =>
                  setNewCategory((prev) => ({ ...prev, name: e.target.value }))
                }
                className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
              <select
                value={newCategory.type}
                onChange={(e) =>
                  setNewCategory((prev) => ({
                    ...prev,
                    type: e.target.value as 'movie' | 'tv',
                  }))
                }
                className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              >
                <option value='movie'>电影</option>
                <option value='tv'>电视剧</option>
              </select>
              <input
                type='text'
                placeholder='搜索关键词'
                value={newCategory.query}
                onChange={(e) =>
                  setNewCategory((prev) => ({ ...prev, query: e.target.value }))
                }
                className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
            <div className='flex justify-end'>
              <button
                onClick={handleAddCategory}
                disabled={
                  !newCategory.name ||
                  !newCategory.query ||
                  isLoading('addCategory')
                }
                className={`w-full sm:w-auto px-4 py-2 ${
                  !newCategory.name ||
                  !newCategory.query ||
                  isLoading('addCategory')
                    ? styles.disabled
                    : styles.success
                }`}
              >
                {isLoading('addCategory') ? '添加中...' : '添加'}
              </button>
            </div>
          </div>
        )}

        {/* 分类表格 */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          autoScroll={false}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        >
          <div className='border border-gray-200 dark:border-gray-700 rounded-lg max-h-[28rem] overflow-y-auto overflow-x-auto relative'>
            <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
              <thead className='bg-gray-50 dark:bg-gray-900 sticky top-0 z-10'>
                <tr>
                  <th className='w-8' />
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                    分类名称
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                    类型
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                    搜索关键词
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                    状态
                  </th>
                  <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                    操作
                  </th>
                </tr>
              </thead>
              <SortableContext
                items={categories.map((c) => `${c.query}:${c.type}`)}
                strategy={verticalListSortingStrategy}
              >
                <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                  {categories.map((category) => (
                    <DraggableRow
                      key={`${category.query}:${category.type}`}
                      category={category}
                    />
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
              disabled={isLoading('saveCategoryOrder')}
              className={`px-3 py-1.5 text-sm ${
                isLoading('saveCategoryOrder')
                  ? styles.disabled
                  : styles.primary
              }`}
            >
              {isLoading('saveCategoryOrder') ? '保存中...' : '保存排序'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default CategorySection;
