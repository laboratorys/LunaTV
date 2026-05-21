/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAvailableApiSites, getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { searchFromApi } from '@/lib/downstream';
import { TVBOX_DETAIL_KEY } from '@/lib/keys';
import { getFormattedRuleJson } from '@/lib/utils';
import { yellowWords } from '@/lib/yellow';

import { getUrlPrefix } from '@/app/api/tvbox/common';
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
  const urlPrefix = getUrlPrefix(request);
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('id'); // 这里输入的 name 通常是搜索关键字
  const year = searchParams.get('year');
  const doubanId = searchParams.get('douban_id');
  const shortDrama = searchParams.get('short_drama');

  if (!name) {
    return NextResponse.json({ list: [] });
  }
  const config = await getConfig();
  const ruleJson = await getFormattedRuleJson(config.AdRules || '');
  const isCached = (config.TvBoxConfig?.expireSeconds ?? 0) > 0;
  const isProxyFilterAds = config.TvBoxConfig?.proxyFilterAds;
  if (isCached) {
    const cacheData = await db.getCacheByKey(`${TVBOX_DETAIL_KEY}${name}`);
    if (cacheData) {
      console.log(
        `【tvbox】detailContent return from cache:${TVBOX_DETAIL_KEY}${name}`
      );
      return NextResponse.json(cacheData);
    }
  }

  //获取所有可用的API站点
  const apiSites = await getAvailableApiSites();

  // 添加超时控制和错误处理，避免慢接口拖累整体响应
  const searchPromises = apiSites.map((site) =>
    Promise.race([
      searchFromApi(site, name).then((results) => {
        if (Array.isArray(results)) {
          return results.map((item) => ({
            ...item,
            siteKey: site.key,
          }));
        }
        return [];
      }),
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

    if (flattenedResults.length === 0) {
      return NextResponse.json({ list: [] }, { status: 200 });
    }

    // 1. 基础过滤（短剧、年份、豆瓣ID）
    const filteredResults = flattenedResults.filter((result) => {
      if (shortDrama === '1') {
        const isShortDrama = (result.class || '').includes('短剧');
        if (!isShortDrama) return false;
      }
      const yearMatch = !year || !result.year || result.year === year;
      const doubanIdMatch =
        !doubanId ||
        result.douban_id == '0' ||
        String(result.douban_id) === String(doubanId);
      return yearMatch && doubanIdMatch;
    });

    // 2. 核心修改：计算文本匹配度并排序（完全匹配 > 模糊包含 > 其他）
    const sortedResults = filteredResults
      .map((item) => {
        const searchTarget = name.trim();
        const resultTitle = (item.title || '').trim();

        let score = 0;
        if (resultTitle === searchTarget) {
          score = 2; // 完全匹配，权重最高
        } else if (resultTitle.includes(searchTarget)) {
          score = 1; // 包含搜索词，模糊匹配
        }

        return { ...item, _score: score };
      })
      .sort((a, b) => b._score - a._score); // 从高到低排序

    // 3. 去重：由于已经按匹配度从高到低排序，Map 遇到的第一个 source_name 一定是质量最好的
    const uniqueResults = Array.from(
      sortedResults
        .reduce((map, item) => {
          if (item.source_name && !map.has(item.source_name)) {
            map.set(item.source_name, item);
          }
          return map;
        }, new Map())
        .values()
    );

    flattenedResults = uniqueResults;
    if (flattenedResults.length === 0) {
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
        const source = item.siteKey || '';
        const hasAdRule = ruleJson && ruleJson[source];
        const pairedEpisodes = item.episodes_titles.map(
          (title: string, index: number) => {
            let url = `${item.episodes[index]}`;
            if (isProxyFilterAds && hasAdRule) {
              url =
                urlPrefix + '/api/proxy/ad?source=' + source + '&url=' + url;
            }
            return `${title}$${url}`;
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
    if (isCached) {
      db.setCacheByKey(
        `${TVBOX_DETAIL_KEY}${name}`,
        { list: detailContentItem },
        config?.TvBoxConfig?.expireSeconds ?? 60 * 60 * 2
      );
    }
    return NextResponse.json({ list: detailContentItem });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
