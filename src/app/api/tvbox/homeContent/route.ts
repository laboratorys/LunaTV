/* eslint-disable no-console */

import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { TVBOX_HOME_KEY } from '@/lib/keys';
import { TvboxContentItem } from '@/lib/types';

import { fetchDoubanHotList } from '@/app/api/tvbox/common';

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
    const config = await getConfig();
    const isCached =
      config.TvBoxConfig?.expireSeconds &&
      config.TvBoxConfig?.expireSeconds > 0;
    if (isCached) {
      const cacheData = await db.getCacheByKey(TVBOX_HOME_KEY);
      if (cacheData) {
        console.log(`【tvbox】homeContent return from cache:${TVBOX_HOME_KEY}`);
        return NextResponse.json(cacheData);
      }
    }
    const items = await fetchDoubanHotList();
    const content: HomeContent = {
      list: items,
      class: classes,
      filters: filters,
    };
    if (isCached) {
      db.setCacheByKey(
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
