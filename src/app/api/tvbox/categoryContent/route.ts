/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import { fetchDoubanData } from '@/lib/douban';
import { TvboxContentItem } from '@/lib/types';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const { tid, pg = 1, query } = requestBody;
    const pageSize = 25;
    let category = '热门';
    let kind = 'movie';
    let type = '全部';
    if (tid === 'tv') {
      kind = 'tv';
      type = query?.type as string | 'tv';
      category = 'tv';
    } else if (tid === 'show') {
      kind = 'tv';
      category = 'show';
      type = query?.type as string | 'show';
    } else if (tid === 'movie') {
      kind = 'movie';
      category = query?.type as string | '热门';
      type = query?.area as string | '全部';
    } else if (tid === 'anime') {
      //默认：每日放送
      const selectedCategories = { 类型: category } as any;
      if (!query || query.category === 'recommends_tv') {
        kind = 'tv';
        category = '电视剧';
        type = '动画';
        selectedCategories['形式'] = category;
      } else {
        kind = 'movie';
        category = '';
        type = '动画';
      }
      const tags = [] as Array<string>;
      if (type) {
        tags.push(type);
      }
      if (query && query.type) {
        tags.push(query.type);
      }
      if (query && query.area) {
        tags.push(query.area);
        selectedCategories['地区'] = query.area;
      }
      if (query && query.year) {
        tags.push(query.year);
      }
      let sort = '';
      if (query && query.sort != 'T') {
        sort = query.sort;
      }
      const items = await fetchDoubanRecommendList(
        false,
        true,
        kind,
        selectedCategories,
        tags,
        sort,
        pg,
        pageSize
      );
      return commonReturn(items, pageSize);
    }
    const items = await fetchDoubanCategoryList(
      false,
      true,
      kind,
      category,
      type,
      pg,
      pageSize
    );
    return commonReturn(items, pageSize);
  } catch (error) {
    console.error('【tvbox】分类数据：', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
async function commonReturn(items: TvboxContentItem[], pageSize: number) {
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
