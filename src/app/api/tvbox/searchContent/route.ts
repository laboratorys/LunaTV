/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAvailableApiSites, getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { searchFromApi } from '@/lib/downstream';
import { TVBOX_SEARCH_KEY } from '@/lib/keys';
import { yellowWords } from '@/lib/yellow';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('key');
  if (!query) {
    return NextResponse.json({ results: [] });
  }
  const config = await getConfig();
  const isCached =
    config.TvBoxConfig?.expireSeconds && config.TvBoxConfig?.expireSeconds > 0;
  if (isCached) {
    const cacheData = await db.getCacheByKey(`${TVBOX_SEARCH_KEY}${query}`);
    if (cacheData) {
      console.log(
        `【tvbox】searchContent return from cache:${TVBOX_SEARCH_KEY}${query}`
      );
      return NextResponse.json(cacheData);
    }
  }
  const apiSites = await getAvailableApiSites();

  // 添加超时控制和错误处理，避免慢接口拖累整体响应
  const searchPromises = apiSites.map((site) =>
    Promise.race([
      searchFromApi(site, query),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${site.name} timeout`)), 20000)
      ),
    ]).catch((err) => {
      console.warn(`搜索失败 ${site.name}:`, err.message);
      return []; // 返回空数组而不是抛出错误
    })
  );

  try {
    const results = await Promise.allSettled(searchPromises);
    const successResults = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<any>).value);
    let flattenedResults = successResults.flat();
    if (!config.SiteConfig.DisableYellowFilter) {
      flattenedResults = flattenedResults.filter((result) => {
        const typeName = result.type_name || '';
        return !yellowWords.some((word: string) => typeName.includes(word));
      });
    }

    if (flattenedResults.length === 0) {
      // no cache if empty
      return NextResponse.json({ results: [] }, { status: 200 });
    }
    const uniqueResults = Array.from(
      new Map(
        flattenedResults.map((item) => [
          item.title,
          {
            vod_id: item.title,
            vod_name: item.title,
            vod_pic: item.poster || '',
            vod_remarks: item.remarks,
          },
        ])
      ).values()
    );
    if (isCached) {
      db.setCacheByKey(
        `${TVBOX_SEARCH_KEY}${query}`,
        {
          list: uniqueResults,
        },
        config?.TvBoxConfig?.expireSeconds ?? 60 * 60 * 2
      );
    }
    return NextResponse.json({
      list: uniqueResults,
    });
  } catch (error) {
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }
}
