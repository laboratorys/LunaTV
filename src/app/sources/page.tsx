/* eslint-disable no-console,react-hooks/exhaustive-deps,@typescript-eslint/no-explicit-any */
'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Source } from '@/lib/types';

import ButtonTextSelector, {
  SelectorOption,
} from '@/components/ButtonTextSelector';
import DoubanCardSkeleton from '@/components/DoubanCardSkeleton';
import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

// --- 内部小组件：筛选行骨架屏 ---
const SelectorSkeleton = () => (
  <div className='flex items-center gap-2 py-1 animate-pulse'>
    <div className='h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded shrink-0' />
    <div className='flex gap-2 overflow-hidden'>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className='h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-xl shrink-0'
        />
      ))}
    </div>
  </div>
);

interface CategoryNode {
  id: number;
  name: string;
  parentId: number;
  children: CategoryNode[];
}

interface SourceDetailItem {
  id: string;
  title: string;
  poster: string;
  source: string;
  source_name: string;
  class: string;
  year: string;
  douban_id: number;
  remarks: string;
}

function SourcesPageClient() {
  const [sources, setSources] = useState<Source[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryNode[]>([]);
  const [isClassLoading, setIsClassLoading] = useState(false);

  const [selectedSource, setSelectedSource] = useState<string>('');
  const [parentCat, setParentCat] = useState<string | number>('');
  const [subCat, setSubCat] = useState<string | number>('');
  const [selectedHour, setSelectedHour] = useState<string>('24');

  const [videoData, setVideoData] = useState<SourceDetailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadingRef = useRef<HTMLDivElement>(null);

  // 1. 获取源列表
  useEffect(() => {
    const fetchSources = async () => {
      try {
        const res = await fetch('/api/sources/list');
        const data = await res.json();
        setSources(data);
        if (data.length > 0) setSelectedSource(data[0].key);
      } catch (err) {
        console.error('获取源列表失败:', err);
      }
    };
    fetchSources();
  }, []);

  // 2. 获取分类树
  useEffect(() => {
    const fetchCats = async () => {
      if (!selectedSource) return;
      setIsClassLoading(true);
      try {
        const res = await fetch(`/api/sources/class?source=${selectedSource}`);
        const data = await res.json();
        setAllCategories(data);
        setParentCat('');
        setSubCat('');
      } catch (err) {
        console.error('获取分类失败:', err);
        setAllCategories([]);
      } finally {
        setIsClassLoading(false);
      }
    };
    fetchCats();
  }, [selectedSource]);

  // 3. 构造选项
  const channelOptions = useMemo(() => {
    const baseOptions: SelectorOption<string | number>[] = [
      { label: '全部', value: '' },
    ];
    const treeOptions = allCategories.map((c) => ({
      label: c.name,
      value: c.id,
      children: c.children?.length
        ? c.children.map((child) => ({
            label: child.name,
            value: child.id,
          }))
        : undefined,
    }));
    return [...baseOptions, ...treeOptions];
  }, [allCategories]);

  // 4. 数据加载
  const fetchDetails = useCallback(
    async (
      sourceCode: string,
      hour: string,
      page: number,
      typeId: string | number,
      isMore = false
    ) => {
      if (!sourceCode) return;
      try {
        if (isMore) setIsLoadingMore(true);
        else setLoading(true);
        const res = await fetch(
          `/api/sources/detail?source=${sourceCode}&wd=&h=${hour}&t=${typeId}&pg=${page}`
        );
        const data: SourceDetailItem[] = await res.json();
        if (isMore) setVideoData((prev) => [...prev, ...data]);
        else setVideoData(data);
        setHasMore(data.length > 0);
      } catch (err) {
        console.error('获取详情失败:', err);
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    []
  );

  // 5. 监听筛选
  useEffect(() => {
    if (selectedSource) {
      setCurrentPage(1);
      const targetType = subCat || parentCat || '';
      fetchDetails(selectedSource, selectedHour, 1, targetType, false);
    }
  }, [selectedSource, selectedHour, parentCat, subCat, fetchDetails]);

  useEffect(() => {
    if (currentPage > 1) {
      const targetType = subCat || parentCat || '';
      fetchDetails(selectedSource, selectedHour, currentPage, targetType, true);
    }
  }, [currentPage]);

  // 无限滚动
  useEffect(() => {
    if (!hasMore || isLoadingMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setCurrentPage((prev) => prev + 1);
      },
      { threshold: 0.1 }
    );
    if (loadingRef.current) observer.observe(loadingRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loading]);

  const handleChannelChange = (val: string | number, isChild?: boolean) => {
    if (isChild) {
      setSubCat(val);
    } else {
      setParentCat(val);
      setSubCat('');
    }
  };

  const sourceOptions = sources.map((s) => ({ label: s.name, value: s.key }));
  const timeOptions = [
    { label: '24小时', value: '24' },
    { label: '一星期', value: '168' },
    { label: '一个月', value: '720' },
    { label: '全部', value: '' },
  ];

  return (
    <PageLayout activePath='/sources'>
      <div className='px-4 sm:px-10 py-4 sm:py-8'>
        {/* 标题区域 - 与短剧页面一致 */}
        <div className='mb-6 sm:mb-8'>
          <h1 className='text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200'>
            播放源
          </h1>
          <p className='text-sm text-gray-600 dark:text-gray-400 mt-2'>
            多源聚合，实时更新
          </p>
        </div>

        {/* --- 筛选器区域 --- */}
        <div className='bg-white/60 dark:bg-gray-800/40 rounded-2xl p-3 sm:p-5 border border-gray-200/30 dark:border-gray-700/30 backdrop-blur-sm mb-6 sm:mb-10 space-y-3 sm:space-y-4'>
          {sources.length === 0 ? (
            <>
              <SelectorSkeleton />
              <SelectorSkeleton />
              <SelectorSkeleton />
            </>
          ) : (
            <>
              <ButtonTextSelector
                label='源站'
                options={sourceOptions}
                selectedValue={selectedSource}
                onChange={(val, isChild) =>
                  !isChild && setSelectedSource(val as string)
                }
              />
              {isClassLoading ? (
                <SelectorSkeleton />
              ) : (
                <ButtonTextSelector
                  label='频道'
                  options={channelOptions}
                  selectedValue={parentCat}
                  selectedSubValue={subCat}
                  onChange={handleChannelChange}
                  autoSelectFirstChild={true}
                />
              )}
              <ButtonTextSelector
                label='时间'
                options={timeOptions}
                selectedValue={selectedHour}
                onChange={(val, isChild) =>
                  !isChild && setSelectedHour(val as string)
                }
              />
            </>
          )}
        </div>

        {/* 内容网格 - 关键修改点：使用了与短剧一致的 grid 布局 */}
        <div className='max-w-[95%] mx-auto overflow-visible'>
          <div className='grid grid-cols-3 gap-x-2 gap-y-12 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20'>
            {loading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <DoubanCardSkeleton key={i} />
                ))
              : videoData.map((item, index) => (
                  <VideoCard
                    key={`${item.id}-${index}`}
                    id={item.id}
                    from='source'
                    title={item.title}
                    poster={item.poster}
                    source={item.source}
                    source_name={item.source_name}
                    year={item.year}
                    remark={item.remarks}
                  />
                ))}
          </div>

          {/* 加载更多指示器 */}
          <div ref={loadingRef} className='flex justify-center mt-12 py-8'>
            {isLoadingMore && (
              <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500' />
            )}
            {!hasMore && videoData.length > 0 && (
              <div className='text-center text-gray-500 text-sm'>
                —— 到底啦，更多剧集准备中 ——
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default function SourcesPage() {
  return (
    <Suspense fallback={null}>
      <SourcesPageClient />
    </Suspense>
  );
}
