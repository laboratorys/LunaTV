/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import {
  commonReturn,
  fetchDoubanCategoryList,
  fetchDoubanRecommendList,
} from '@/app/api/tvbox/common';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const { tid, pg = 1, query } = requestBody;
    const pageSize = 25;
    const pageStart = (pg - 1) * pageSize;
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
        pageStart,
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
      pageStart,
      pageSize
    );
    return commonReturn(items, pageSize);
  } catch (error) {
    console.error('【tvbox】分类数据：', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
