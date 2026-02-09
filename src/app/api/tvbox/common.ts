import { NextRequest, NextResponse } from 'next/server';

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
  urlPrefix: string,
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
  const { imageProxyType, imageProxyUrl } = await getDoubanImageProxyConfig();
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
      vod_id: parseId(item),
      vod_name: item.title,
      vod_pic:
        processImageUrl(
          item.pic?.normal,
          imageProxyType,
          imageProxyUrl,
          urlPrefix
        ) ||
        processImageUrl(
          item.pic?.large,
          imageProxyType,
          imageProxyUrl,
          urlPrefix
        ) ||
        '',
      vod_remarks: item.episodes_info,
    }));
    return list;
  } catch (error) {
    throw new Error(`获取豆瓣热门数据失败: ${(error as Error).message}`);
  }
}
export function parseId(item: any): string {
  const year = parseYearFromSubtitle(item.card_subtitle);
  const title = item.title || '';
  const doubanId = item.id || '';
  return `${encodeURIComponent(
    title
  )}&year=${year}&douban_id=${doubanId}&short_drama=0`;
}
export function parseYearFromSubtitle(subtitle: string): string {
  if (!subtitle || typeof subtitle !== 'string') return '';
  const yearMatch = subtitle.match(/\b((19|20)\d{2})\b/);

  if (yearMatch) {
    return yearMatch[1];
  }
  const fallbackMatch = subtitle.match(/\d{4}/);
  return fallbackMatch ? fallbackMatch[0] : '';
}
export async function fetchDoubanRecommendList(
  urlPrefix: string,
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
  const { imageProxyType, imageProxyUrl } = await getDoubanImageProxyConfig();
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
    const list: TvboxContentItem[] = doubanData.items
      .filter((item: any) => item.type == 'movie' || item.type == 'tv')
      .map((item: any) => ({
        vod_id: parseId(item),
        vod_name: item.title,
        vod_pic:
          processImageUrl(
            item.pic?.normal,
            imageProxyType,
            imageProxyUrl,
            urlPrefix
          ) ||
          processImageUrl(
            item.pic?.large,
            imageProxyType,
            imageProxyUrl,
            urlPrefix
          ) ||
          '',
        vod_remarks: '',
      }));
    return list;
  } catch (error) {
    throw new Error(`获取豆瓣热门数据失败: ${(error as Error).message}`);
  }
}

export async function fetchDoubanHotList(
  urlPrefix: string,
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
  const { imageProxyType, imageProxyUrl } = await getDoubanImageProxyConfig();
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
      vod_id: parseId(item),
      vod_name: item.title,
      vod_pic: processImageUrl(
        item.cover,
        imageProxyType,
        imageProxyUrl,
        urlPrefix
      ),
      vod_remarks: item.episodes_info,
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
  const proxyType = config?.SiteConfig.DoubanProxyType;
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

export async function getDoubanImageProxyConfig(): Promise<{
  imageProxyType: string;
  imageProxyUrl: string;
}> {
  const config: AdminConfig | null = await db.getAdminConfig();

  const imageProxyType =
    config?.SiteConfig.DoubanImageProxyType || 'cmliussss-cdn-tencent';
  const imageProxyUrl =
    config?.SiteConfig.DoubanImageProxy || 'cmliussss-cdn-tencent';

  return {
    imageProxyType,
    imageProxyUrl,
  };
}

export function processImageUrl(
  originalUrl: string,
  proxyType: string,
  proxyUrl: string,
  urlPrefix: string
): string {
  if (!originalUrl) return originalUrl;

  // 仅处理豆瓣图片代理
  if (!originalUrl.includes('doubanio.com')) {
    return originalUrl;
  }
  switch (proxyType) {
    case 'server':
      return `${urlPrefix}/api/image-proxy?url=${encodeURIComponent(
        originalUrl
      )}`;
    case 'img3':
      return originalUrl.replace(/img\d+\.doubanio\.com/g, 'img3.doubanio.com');
    case 'cmliussss-cdn-tencent':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.net'
      );
    case 'cmliussss-cdn-ali':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.com'
      );
    case 'custom':
      return `${proxyUrl}${encodeURIComponent(originalUrl)}`;
    case 'direct':
    default:
      return originalUrl;
  }
}
export const getUrlPrefix = (request: NextRequest) => {
  const { protocol, host } = request.nextUrl;
  return `${protocol}//${request.headers.get('host') || host}`;
};
