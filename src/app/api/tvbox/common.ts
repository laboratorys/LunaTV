import { NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import { fetchDoubanData } from '@/lib/douban';
import { TvboxContentItem } from '@/lib/types';
export async function commonReturn(
  items: TvboxContentItem[],
  pageSize: number
) {
  const cacheTime = await getCacheTime();
  return NextResponse.json(
    {
      list: items || [],
      limit: pageSize,
    },
    {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Netlify-Vary': 'query',
      },
    }
  );
}
export async function fetchDoubanCategoryList(
  useTencentCDN = false,
  useAliCDN = false,
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
  const target = useTencentCDN
    ? `https://m.douban.cmliussss.net/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`
    : useAliCDN
    ? `https://m.douban.cmliussss.com/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`
    : `https://m.douban.com/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`;
  try {
    // 调用豆瓣 API
    const doubanData: any = await fetchDoubanData(target);
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
  useTencentCDN = false,
  useAliCDN = false,
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
    const doubanData: any = await fetchDoubanData(target);
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
