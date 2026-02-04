/* eslint-disable no-console,react-hooks/exhaustive-deps,@typescript-eslint/no-explicit-any */
'use client';

import { Search, X } from 'lucide-react';
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
  rate: string;
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
  const [keyword, setKeyword] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');

  // 核心控制：触发器与模式引用
  const [trigger, setTrigger] = useState(0);
  const isAppendMode = useRef(false);

  // 1. 初始化获取源列表
  useEffect(() => {
    const fetchSources = async () => {
      try {
        const res = await fetch('/api/sources/list');
        const data = await res.json();
        setSources(data);
        if (data.length > 0) {
          // 这里是关键：设置初始源的同时触发第一次请求
          setSelectedSource(data[0].key);
          handleFilterChange(true); // 👈 显式触发初始数据加载
        }
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
        // 仅更新分类，不在这里重置 parentCat/subCat 以免干扰 initial trigger
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

  // 4. 数据加载函数
  const fetchDetails = useCallback(
    async (
      sourceCode: string,
      hour: string,
      page: number,
      typeId: string | number,
      append: boolean,
      wd: string
    ) => {
      if (!sourceCode) return;
      try {
        if (append) setIsLoadingMore(true);
        else setLoading(true);

        const res = await fetch(
          `/api/sources/detail?source=${sourceCode}&wd=${encodeURIComponent(
            wd
          )}&h=${hour}&t=${typeId}&pg=${page}`
        );
        const data: SourceDetailItem[] = await res.json();

        if (append) {
          setVideoData((prev) => [...prev, ...data]);
        } else {
          setVideoData(data);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
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

  // 5. 统一的网络请求监听器（只监听 trigger）
  useEffect(() => {
    if (!selectedSource) return;
    const targetType = subCat || parentCat || '';
    fetchDetails(
      selectedSource,
      selectedHour,
      currentPage,
      targetType,
      isAppendMode.current,
      keyword
    );
  }, [trigger, fetchDetails]);

  // 6. 交互处理函数：手动触发 trigger
  const handleFilterChange = (resetPage = true) => {
    if (resetPage) {
      setCurrentPage(1);
      isAppendMode.current = false;
    } else {
      isAppendMode.current = true;
    }
    setTrigger((prev) => prev + 1);
  };

  const handleSearch = () => {
    setKeyword(searchInput);
    handleFilterChange(true);
  };

  const handleSourceChange = (val: string) => {
    setSelectedSource(val);
    setParentCat('');
    setSubCat('');
    handleFilterChange(true);
  };

  const handleChannelChange = (val: string | number, isChild?: boolean) => {
    if (isChild) {
      setSubCat(val);
    } else {
      setParentCat(val);
      setSubCat('');
    }
    handleFilterChange(true);
  };

  const handleTimeChange = (val: string) => {
    setSelectedHour(val);
    handleFilterChange(true);
  };

  // 7. 无限滚动
  useEffect(() => {
    if (!hasMore || isLoadingMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setCurrentPage((prev) => {
            const nextPage = prev + 1;
            isAppendMode.current = true;
            setTrigger((t) => t + 1);
            return nextPage;
          });
        }
      },
      { threshold: 0.1 }
    );
    if (loadingRef.current) observer.observe(loadingRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loading]);

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
        <div className='mb-6 sm:mb-8'>
          <h1 className='text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200'>
            播放源
          </h1>
          <p className='text-sm text-gray-600 dark:text-gray-400 mt-2'>
            多源聚合，实时更新
          </p>
        </div>

        {/* --- 筛选器区域 --- */}
        <div className='bg-white/60 dark:bg-gray-800/40 rounded-2xl p-3 sm:p-5 border border-gray-200/30 dark:border-gray-700/30 backdrop-blur-sm mb-6 sm:mb-10 space-y-3 sm:space-y-4 relative z-50'>
          {/* 搜索框 */}
          <div className='relative group w-full mb-2'>
            <div
              className={`
    relative flex items-center w-full h-10 sm:h-11 px-4 
    bg-gray-100/50 dark:bg-gray-900/50 
    rounded-xl border border-transparent
    transition-all duration-300
    focus-within:bg-white dark:focus-within:bg-gray-900 
    focus-within:border-emerald-500/50 focus-within:ring-4 focus-within:ring-emerald-500/10
    focus-within:shadow-sm
  `}
            >
              <Search
                size={18}
                className='text-gray-400 group-focus-within:text-emerald-500 transition-colors shrink-0'
              />

              <input
                type='text'
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                placeholder='搜索影片标题、演员...'
                // 这里的 flex-1 会占据剩余空间，但我们要确保它不把按钮挤走
                className='flex-1 min-w-0 bg-transparent border-none outline-none ring-0 focus:ring-0 px-3 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500'
              />

              {searchInput && (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setKeyword('');
                    handleFilterChange(true);
                  }}
                  className='p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors shrink-0'
                >
                  <X size={14} className='text-gray-400' />
                </button>
              )}

              {/* 搜索按钮：添加 shrink-0 和 whitespace-nowrap */}
              <button
                onClick={handleSearch}
                className='ml-2 px-4 py-1.5 shrink-0 whitespace-nowrap bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-medium rounded-lg transition-all active:scale-95 shadow-sm shadow-emerald-500/20'
              >
                搜索
              </button>
            </div>
          </div>

          <div className='h-px w-full bg-gray-200/50 dark:bg-gray-700/50 my-2' />

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
                onChange={(val) => handleSourceChange(val as string)}
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
                onChange={(val) => handleTimeChange(val as string)}
              />
            </>
          )}
        </div>

        {/* 内容网格 */}
        {/* 内容网格 */}
        <div className='max-w-[95%] mx-auto overflow-visible relative z-0'>
          {loading ? (
            // 1. 加载中状态
            <div className='grid grid-cols-3 gap-x-2 gap-y-12 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20'>
              {Array.from({ length: 12 }).map((_, i) => (
                <DoubanCardSkeleton key={i} />
              ))}
            </div>
          ) : videoData.length > 0 ? (
            // 2. 有数据状态
            <div className='grid grid-cols-3 gap-x-2 gap-y-12 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20'>
              {videoData.map((item, index) => (
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
                  rate={item.rate}
                />
              ))}
            </div>
          ) : (
            // 3. 搜索为空状态
            <div className='flex flex-col items-center justify-center py-20 px-4'>
              <div className='w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4'>
                <Search
                  size={32}
                  className='text-gray-300 dark:text-gray-600'
                />
              </div>
              <h3 className='text-lg font-medium text-gray-800 dark:text-gray-200'>
                未找到相关影片
              </h3>
              <p className='text-sm text-gray-500 dark:text-gray-400 mt-2 text-center max-w-xs'>
                试试换个关键词，或者切换到其他“源站”和“频道”看看吧
              </p>
              {keyword && (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setKeyword('');
                    handleFilterChange(true);
                  }}
                  className='mt-6 px-6 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 text-gray-600 dark:text-gray-400 rounded-xl transition-all text-sm font-medium'
                >
                  重置搜索条件
                </button>
              )}
            </div>
          )}

          {/* 加载更多指示器 - 仅在有数据时显示 */}
          {videoData.length > 0 && (
            <div ref={loadingRef} className='flex justify-center mt-12 py-8'>
              {isLoadingMore && (
                <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500' />
              )}
              {!hasMore && (
                <div className='text-center text-gray-500 text-sm'>
                  —— 到底啦，更多剧集准备中 ——
                </div>
              )}
            </div>
          )}
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
