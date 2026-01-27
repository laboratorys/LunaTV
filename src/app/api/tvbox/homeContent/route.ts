/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { TVBOX_HOME_KEY } from '@/lib/keys';
import { TvboxContentItem } from '@/lib/types';

import { fetchDoubanHotList, getUrlPrefix } from '@/app/api/tvbox/common';

import { classes, filters } from './constant';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HomeContent {
  list: TvboxContentItem[];
  class: HomeContentClass[];
  filters: any;
}
interface HomeContentClass {
  type_id: string;
  type_name: string;
}
export async function GET(request: NextRequest) {
  try {
    const urlPrefix = getUrlPrefix(request);
    const config = await getConfig();
    const isCached = (config.TvBoxConfig?.expireSeconds ?? 0) > 0;

    if (isCached) {
      const cacheData = await db.getCacheByKey(TVBOX_HOME_KEY);
      if (cacheData) {
        console.log(`【tvbox】homeContent return from cache:${TVBOX_HOME_KEY}`);
        return NextResponse.json(cacheData);
      }
    }
    const items = await fetchDoubanHotList(urlPrefix);
    const content: HomeContent = {
      list: items,
      class: classes,
      filters: filters,
    };
    if (isCached) {
      await db.setCacheByKey(
        TVBOX_HOME_KEY,
        content,
        config?.TvBoxConfig?.expireSeconds ?? 60 * 60 * 2
      );
    }
    return NextResponse.json(content);
  } catch (error) {
    console.error('【tvbox】获取主页数据失败:', error);
    return NextResponse.json({ error: '获取主页数据失败' }, { status: 500 });
  }
}
