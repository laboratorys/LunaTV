/* eslint-disable no-console */
'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import DoubanCardSkeleton from '@/components/DoubanCardSkeleton';
import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

// 假设你的接口定义如下
async function fetchShortDramaData(page: number) {
  const res = await fetch(`/api/short-drama?page=${page}&pageSize=24`);
  return res.json();
}

function ShortDramaPageClient() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadingRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 初始加载
  useEffect(() => {
    const initLoad = async () => {
      try {
        setLoading(true);
        const res = await fetchShortDramaData(1);
        if (res.code === 200) {
          setData(res.data.list);
          setHasMore(res.data.list.length > 0);
        }
      } catch (err) {
        console.error('加载短剧失败:', err);
      } finally {
        setLoading(false);
      }
    };
    initLoad();
  }, []);

  // 加载更多
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetchShortDramaData(nextPage);
      if (res.code === 200 && res.data.list.length > 0) {
        setData((prev) => [...prev, ...res.data.list]);
        setPage(nextPage);
        setHasMore(res.data.list.length === 24); // 假设 pageSize 是 24
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('加载更多失败:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, isLoadingMore, hasMore]);

  // 滚动监听
  useEffect(() => {
    if (!hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadingRef.current) observer.observe(loadingRef.current);
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [loadMore, hasMore, loading]);

  return (
    <PageLayout activePath='/short-drama'>
      <div className='px-4 sm:px-10 py-4 sm:py-8'>
        {/* 简洁的标题区域 */}
        <div className='mb-8'>
          <h1 className='text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200'>
            热门短剧
          </h1>
          <p className='text-sm text-gray-600 dark:text-gray-400 mt-2'>
            海量精彩短剧，全集畅看
          </p>
        </div>

        {/* 内容网格 */}
        <div className='max-w-[95%] mx-auto overflow-visible'>
          <div className='grid grid-cols-3 gap-x-2 gap-y-12 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20'>
            {loading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <DoubanCardSkeleton key={i} />
                ))
              : data.map((item, i) => (
                  <VideoCard
                    key={`${item.vod_id}-${i}`}
                    from='douban'
                    title={item.vod_name}
                    poster={item.vod_pic}
                    remark={item.vod_remarks}
                  />
                ))}
          </div>

          {/* 加载更多指示器 */}
          {hasMore && (
            <div ref={loadingRef} className='flex justify-center mt-12 py-8'>
              {isLoadingMore && (
                <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500'></div>
              )}
            </div>
          )}

          {!hasMore && data.length > 0 && (
            <div className='text-center text-gray-500 py-8 text-sm'>
              —— 到底啦，更多剧集准备中 ——
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

export default function ShortDramaPage() {
  return (
    <Suspense fallback={null}>
      <ShortDramaPageClient />
    </Suspense>
  );
}
