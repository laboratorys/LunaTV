/* eslint-disable no-console */

import { NextResponse } from 'next/server';

import { fetchWithTimeout } from '@/lib/douban.client';
import { TvboxContentItem } from '@/lib/types';

import { classes, filters } from './constant';
export const runtime = 'nodejs';

interface HomeContent {
  list: TvboxContentItem[];
  class: HomeContentClass[];
  filters: any;
}
interface HomeContentClass {
  type_id: string;
  type_name: string;
}

export async function GET() {
  try {
    const items = await fetchDoubanHotList('', true, false);
    const content: HomeContent = {
      list: items,
      class: classes,
      filters: filters,
    };
    return NextResponse.json(content);
  } catch (error) {
    console.error('【tvbox】获取主页数据失败:', error);
    return NextResponse.json({ error: '获取主页数据失败' }, { status: 500 });
  }
}
export async function fetchDoubanHotList(
  proxyUrl: string,
  useTencentCDN = false,
  useAliCDN = false,
  type = 'tv',
  pageStart = 1,
  pageLimit = 50
): Promise<TvboxContentItem[]> {
  const tag = '热门';
  if (pageLimit < 1 || pageLimit > 100) {
    throw new Error('pageLimit 必须在 1-100 之间');
  }

  if (pageStart < 0) {
    throw new Error('pageStart 不能小于 0');
  }

  const target = useTencentCDN
    ? `https://movie.douban.cmliussss.net/j/search_subjects?type=${type}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`
    : useAliCDN
    ? `https://movie.douban.cmliussss.com/j/search_subjects?type=${type}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`
    : `https://movie.douban.com/j/search_subjects?type=${type}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`;

  console.log('Fetching Douban Hot List from:', target);
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
