import { NextResponse } from 'next/server';

import { AdminConfig } from '@/lib/admin.types';
import { db } from '@/lib/db';
import { fetchWithTimeout } from '@/lib/douban.client';
import { TvboxContentItem } from '@/lib/types';

export async function commonReturn(
  items: TvboxContentItem[],
  pageSize: number
) {
  return NextResponse.json({
    list: items || [],
    limit: pageSize,
  });
}
export async function fetchDoubanCategoryList(
  kind = 'movie',
  category = '热门',
  type = '全部',
  pageStart = 1,
  pageLimit = 25
): Promise<TvboxContentItem[]> {
  if (pageLimit < 1 || pageLimit > 100) {
    throw new Error('pageLimit 必须在 1-100 之间');
  }

  if (pageStart < 0) {
    throw new Error('pageStart 不能小于 0');
  }
  const { proxyUrl, useTencentCDN, useAliCDN } = await getDoubanProxyConfig();
  const target = useTencentCDN
    ? `https://m.douban.cmliussss.net/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`
    : useAliCDN
    ? `https://m.douban.cmliussss.com/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`
    : `https://m.douban.com/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`;
  try {
    const response = await fetchWithTimeout(
      target,
      useTencentCDN || useAliCDN ? '' : proxyUrl
    );
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const doubanData = await response.json();

    // 转换数据格式
    const list: TvboxContentItem[] = doubanData.items.map((item: any) => ({
      vod_id: item.title,
      vod_name: item.title,
      vod_pic: item.pic?.normal || item.pic?.large || '',
      vod_remarks: '',
    }));
    return list;
  } catch (error) {
    throw new Error(`获取豆瓣热门数据失败: ${(error as Error).message}`);
  }
}
export async function fetchDoubanRecommendList(
  kind = 'movie',
  selectedCategories = {},
  tags = [] as Array<string>,
  sort: string,
  pageStart = 1,
  pageLimit = 25
): Promise<TvboxContentItem[]> {
  if (pageLimit < 1 || pageLimit > 100) {
    throw new Error('pageLimit 必须在 1-100 之间');
  }

  if (pageStart < 0) {
    throw new Error('pageStart 不能小于 0');
  }
  const { proxyUrl, useTencentCDN, useAliCDN } = await getDoubanProxyConfig();
  const baseUrl = useTencentCDN
    ? `https://m.douban.cmliussss.net/rexxar/api/v2/${kind}/recommend`
    : useAliCDN
    ? `https://m.douban.cmliussss.com/rexxar/api/v2/${kind}/recommend`
    : `https://m.douban.com/rexxar/api/v2/${kind}/recommend`;
  const params = new URLSearchParams();
  params.append('refresh', '0');
  params.append('start', pageStart.toString());
  params.append('count', pageLimit.toString());
  params.append('selected_categories', JSON.stringify(selectedCategories));
  params.append('uncollect', 'false');
  params.append('score_range', '0,10');
  params.append('tags', tags.join(','));
  if (sort) {
    params.append('sort', sort);
  }
  const target = `${baseUrl}?${params.toString()}`;
  try {
    // 调用豆瓣 API
    const response = await fetchWithTimeout(
      target,
      useTencentCDN || useAliCDN ? '' : proxyUrl
    );
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const doubanData = await response.json();
    // 转换数据格式
    const list: TvboxContentItem[] = doubanData.items.map((item: any) => ({
      vod_id: item.title,
      vod_name: item.title,
      vod_pic: item.pic?.normal || item.pic?.large || '',
      vod_remarks: '',
    }));
    return list;
  } catch (error) {
    throw new Error(`获取豆瓣热门数据失败: ${(error as Error).message}`);
  }
}

export async function fetchDoubanHotList(
  type = 'tv',
  pageStart = 0,
  pageLimit = 50
): Promise<TvboxContentItem[]> {
  const tag = '热门';
  if (pageLimit < 1 || pageLimit > 100) {
    throw new Error('pageLimit 必须在 1-100 之间');
  }

  if (pageStart < 0) {
    throw new Error('pageStart 不能小于 0');
  }
  const { proxyUrl, useTencentCDN, useAliCDN } = await getDoubanProxyConfig();
  const target = useTencentCDN
    ? `https://movie.douban.cmliussss.net/j/search_subjects?type=${type}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`
    : useAliCDN
    ? `https://movie.douban.cmliussss.com/j/search_subjects?type=${type}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`
    : `https://movie.douban.com/j/search_subjects?type=${type}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`;
  try {
    const response = await fetchWithTimeout(
      target,
      useTencentCDN || useAliCDN ? '' : proxyUrl
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const doubanData = await response.json();

    // 转换数据格式
    const list: TvboxContentItem[] = doubanData.subjects.map((item: any) => ({
      vod_id: item.title,
      vod_name: item.title,
      vod_pic: item.cover,
      vod_remarks: '',
    }));

    return list;
  } catch (error) {
    // 触发全局错误提示
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('globalError', {
          detail: { message: '获取豆瓣热门数据失败' },
        })
      );
    }
    throw new Error(`获取豆瓣热门数据失败: ${(error as Error).message}`);
  }
}
interface DoubanProxyConfig {
  proxyUrl: string;
  useTencentCDN: boolean;
  useAliCDN: boolean;
}
export async function getDoubanProxyConfig(): Promise<DoubanProxyConfig> {
  const config: AdminConfig | null = await db.getAdminConfig();
  const proxy = config?.SiteConfig.DoubanProxy;
  const proxyType = config?.SiteConfig.DoubanImageProxyType;
  switch (proxyType) {
    case 'cors-proxy-zwei':
      return {
        proxyUrl: 'https://ciao-cors.is-an.org/',
        useTencentCDN: false,
        useAliCDN: false,
      };
    case 'cmliussss-cdn-tencent':
      return {
        proxyUrl: '',
        useTencentCDN: true,
        useAliCDN: false,
      };
    case 'cmliussss-cdn-ali':
      return {
        proxyUrl: '',
        useTencentCDN: false,
        useAliCDN: true,
      };
    case 'custom':
      return {
        proxyUrl: proxy || '',
        useTencentCDN: false,
        useAliCDN: false,
      };
    case 'direct':
    default:
      return {
        proxyUrl: '',
        useTencentCDN: false,
        useAliCDN: false,
      };
  }
}
