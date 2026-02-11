/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server';

import { AdminConfig } from '@/lib/admin.types';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { fetchWithTimeout } from '@/lib/douban.client';
import { searchFromApi } from '@/lib/downstream';
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
// 统一鉴权
export const validateRequest = async (k: string | null) => {
  if (!k) return { error: 'Unauthorized', status: 401 };
  const config = await getConfig();
  const user = config.UserConfig.Users.find((u) => u.key === k);
  if (!user) return { error: '用户不存在', status: 401 };
  if (user.banned) return { error: '用户已被封禁', status: 401 };
  return { user, config, ok: true };
};
/**
 * 从解析 ID 到搜索 API 并返回最终匹配结果的封装方法
 * @param id 原始字符串，如 "生命树&year=2026&douban_id=123"
 * @param apiSites 资源站配置列表
 * @param config 全局配置，包含 SiteConfig.DisableYellowFilter
 * @param yellowWords 敏感词过滤数组
 */
export const getMatchedVodInfo = async (
  id: string,
  apiSites: any[],
  config: any,
  yellowWords: string[] = []
) => {
  // 1. 解析原始 ID 信息
  const params = new URLSearchParams(`name=${decodeURIComponent(id)}`);
  const searchCriteria = {
    name: params.get('name') || '',
    year: params.get('year'),
    douban_id: params.get('douban_id'),
    short_drama: params.get('short_drama'),
  };

  if (!searchCriteria.name) return null;

  // 2. 并发搜索并处理超时
  const searchPromises = apiSites.map((site) =>
    Promise.race([
      searchFromApi(site, searchCriteria.name),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${site.name} timeout`)), 20000)
      ),
    ]).catch((err) => {
      console.warn(`查询失败 ${site.name}:`, err.message);
      return [];
    })
  );

  try {
    const results = await Promise.allSettled(searchPromises);
    const successResults = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<any>).value);

    let flattenedResults = successResults.flat();

    // 3. 敏感词过滤 (Yellow Filter)
    if (!config.SiteConfig.DisableYellowFilter) {
      flattenedResults = flattenedResults.filter((result) => {
        const typeName = result.type_name || '';
        return !yellowWords.some((word) => typeName.includes(word));
      });
    }

    // 4. 精准匹配过滤 (年份、豆瓣ID、短剧)
    const filteredResults = flattenedResults.filter((result) => {
      // 短剧匹配
      if (searchCriteria.short_drama === '1') {
        const isShortDrama =
          (result.class || '').includes('短剧') ||
          (result.type_name || '').includes('短剧');
        if (!isShortDrama) return false;
      }
      // 年份匹配 (兼容 vod_year 或 year 字段)
      const rYear = String(result.vod_year || result.year || '');
      const yearMatch =
        !searchCriteria.year || rYear === String(searchCriteria.year);

      // 豆瓣 ID 匹配
      const rDoubanId = String(result.vod_douban_id || result.douban_id || '0');
      const doubanIdMatch =
        !searchCriteria.douban_id ||
        rDoubanId === '0' ||
        rDoubanId === String(searchCriteria.douban_id);

      return yearMatch && doubanIdMatch;
    });

    // 5. 按 source_name 去重并提取
    const uniqueResults = Array.from(
      filteredResults
        .reduce((map, item) => {
          if (item.source_name && !map.has(item.source_name)) {
            map.set(item.source_name, item);
          }
          return map;
        }, new Map())
        .values()
    ) as any[];

    if (uniqueResults.length === 0) return null;

    // 6. 返回核心信息
    const baseInfo = uniqueResults[0];
    return {
      vodId: baseInfo.vod_id || baseInfo.id,
      sourceName: baseInfo.source_name,
      raw: baseInfo, // 保留原始数据以备后续使用
      searchCriteria, // 返回解析出的搜索条件
    };
  } catch (error) {
    console.error('解析与搜索流程异常:', error);
    return null;
  }
};
