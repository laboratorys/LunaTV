/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAvailableApiSites, getCacheTime, getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { yellowWords } from '@/lib/yellow';
export const runtime = 'nodejs';

interface DetailContentItem {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  type_name: string;
  vod_year: string;
  vod_area: string;
  vod_remarks: string;
  vod_actor: string;
  vod_director: string;
  vod_content: string;
  vod_play_from: string;
  vod_play_url: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('id');

  if (!query) {
    const cacheTime = await getCacheTime();
    return NextResponse.json(
      { list: [] },
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

  const config = await getConfig();
  //获取所有可用的API站点
  const apiSites = await getAvailableApiSites();

  // 添加超时控制和错误处理，避免慢接口拖累整体响应
  const searchPromises = apiSites.map((site) =>
    Promise.race([
      searchFromApi(site, query),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${site.name} timeout`)), 20000)
      ),
    ]).catch((err) => {
      console.warn(`查询失败 ${site.name}:`, err.message);
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
    const cacheTime = await getCacheTime();

    if (flattenedResults.length === 0) {
      // no cache if empty
      return NextResponse.json({ list: [] }, { status: 200 });
    }
    //处理成tvbox支持的数据格式
    const baseInfo = flattenedResults[0];
    //取出播放源集合
    const sourceNames = flattenedResults.map((item) => item.source_name);
    const playFrom = sourceNames.join('$$$');
    //取出播放源集合
    const playUrl = flattenedResults
      .map((item) => {
        const pairedEpisodes = item.episodes_titles.map(
          (title: string, index: number) => {
            return `${title}$${item.episodes[index]}`;
          }
        );

        return pairedEpisodes.join('#');
      })
      .join('$$$');
    const detailContentItem: DetailContentItem[] = [
      {
        vod_id: baseInfo.id,
        vod_name: baseInfo.title,
        vod_pic: baseInfo.poster,
        type_name: baseInfo.type_name,
        vod_year: baseInfo.year,
        vod_area: baseInfo.area,
        vod_remarks: baseInfo.remarks,
        vod_actor: baseInfo.actor,
        vod_director: baseInfo.director,
        vod_content: baseInfo.desc,
        vod_play_from: playFrom,
        vod_play_url: playUrl,
      },
    ];
    return NextResponse.json(
      { list: detailContentItem },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Netlify-Vary': 'query',
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
