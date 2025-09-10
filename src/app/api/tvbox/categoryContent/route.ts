/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { TVBOX_CATEGORY_KEY } from '@/lib/keys';

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
    const config = await getConfig();
    const keySuffix = jsonToUrlParams(tid, pg, query);
    const isCached =
      config.TvBoxConfig?.expireSeconds &&
      config.TvBoxConfig?.expireSeconds > 0;
    if (isCached) {
      const cacheData = await db.getCacheByKey(
        `${TVBOX_CATEGORY_KEY}${keySuffix}`
      );
      if (cacheData) {
        console.log(
          `【tvbox】categoryContent return from cache:${TVBOX_CATEGORY_KEY}${keySuffix}`
        );
        return NextResponse.json(cacheData);
      }
    }
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
        kind,
        selectedCategories,
        tags,
        sort,
        pageStart,
        pageSize
      );
      if (isCached) {
        db.setCacheByKey(
          `${TVBOX_CATEGORY_KEY}${keySuffix}`,
          {
            list: items || [],
            limit: pageSize,
          },
          config?.TvBoxConfig?.expireSeconds ?? 60 * 60 * 2
        );
      }

      return commonReturn(items, pageSize);
    }
    const items = await fetchDoubanCategoryList(
      kind,
      category,
      type,
      pageStart,
      pageSize
    );
    if (isCached) {
      db.setCacheByKey(
        `${TVBOX_CATEGORY_KEY}${keySuffix}`,
        {
          list: items || [],
          limit: pageSize,
        },
        config?.TvBoxConfig?.expireSeconds ?? 60 * 60 * 2
      );
    }
    return commonReturn(items, pageSize);
  } catch (error) {
    console.error('【tvbox】分类数据：', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

function jsonToUrlParams(tid: string, pg: number, query: JSON) {
  const params = new URLSearchParams();
  params.append('tid', String(tid));
  params.append('pg', String(pg));
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value != null && value !== '') params.append(key, String(value));
    });
  }
  return params.toString();
}
