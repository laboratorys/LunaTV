/* eslint-disable no-console,@typescript-eslint/no-non-null-assertion */

import { NextRequest, NextResponse } from 'next/server';

import { getAvailableApiSites, getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { searchFromApi } from '@/lib/downstream';
import { TVBoxRecord } from '@/lib/types';
import { createPlayRecordFromTVBox } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await validateRequest(searchParams.get('k'));
    if ('error' in auth)
      return NextResponse.json({ error: auth.error }, { status: auth.status });

    const cid = searchParams.get('cid');
    const records = await db.getAllPlayRecords(auth.user.username);

    const tvboxRecords = Object.values(records)
      .filter((r) => r.tvbox_record)
      .map((r) => {
        const record = { ...r.tvbox_record! };
        record.cid = Number(cid);
        const [prefix, id] = record.key.split('@@@');
        record.key = `${prefix}@@@${id}@@@${cid}`;
        return record;
      });

    return NextResponse.json(tvboxRecords);
  } catch (err) {
    console.error('GET Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
};

export const POST = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await validateRequest(searchParams.get('k'));
    if ('error' in auth)
      return NextResponse.json({ error: auth.error }, { status: auth.status });

    const tvboxRecord: TVBoxRecord = await request.json();
    if (!tvboxRecord?.key)
      return NextResponse.json(
        { error: 'Missing record key' },
        { status: 400 }
      );

    // 存在记录则清理
    await findAndDeleteRecord(auth.user.username, tvboxRecord.key);

    // 解析与匹配
    const [_, id] = tvboxRecord.key.split('@@@');
    const apiSites = await getAvailableApiSites(auth.user.username);
    const apiSite = apiSites.find((site) => site.name === tvboxRecord.vodFlag);

    if (apiSite) {
      const result = await getMatchedVodInfo(id, apiSites, auth.config);
      if (result) {
        await db.savePlayRecord(
          auth.user.username,
          apiSite.key,
          result.vodId,
          createPlayRecordFromTVBox(tvboxRecord)
        );
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
};

export const DELETE = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await validateRequest(searchParams.get('k'));
    if ('error' in auth)
      return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { key } = await request.json();
    if (key) {
      await findAndDeleteRecord(auth.user.username, key);
    } else {
      const all = await db.getAllPlayRecords(auth.user.username);
      await Promise.all(
        Object.keys(all).map(async (k) => {
          const [s, i] = k.split('+');
          if (s && i) await db.deletePlayRecord(auth.user.username, s, i);
        })
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
};

// 统一鉴权
const validateRequest = async (k: string | null) => {
  if (!k) return { error: 'Unauthorized', status: 401 };
  const config = await getConfig();
  const user = config.UserConfig.Users.find((u) => u.key === k);
  if (!user) return { error: '用户不存在', status: 401 };
  if (user.banned) return { error: '用户已被封禁', status: 401 };
  return { user, config, ok: true };
};

// 统一通过 tvbox_record.key 查找并删除记录
const findAndDeleteRecord = async (username: string, tvboxKey: string) => {
  const records = await db.getAllPlayRecords(username);
  const target = Object.entries(records).find(
    ([_, r]) => r.tvbox_record?.key === tvboxKey
  );
  if (target) {
    const [fullKey] = target;
    const [source, id] = fullKey.split('+');

    await db.deletePlayRecord(username, source, id);
    return true;
  }
  return false;
};

/**
 * 从解析 ID 到搜索 API 并返回最终匹配结果的封装方法
 * @param id 原始字符串，如 "生命树&year=2026&douban_id=123"
 * @param apiSites 资源站配置列表
 * @param config 全局配置，包含 SiteConfig.DisableYellowFilter
 * @param yellowWords 敏感词过滤数组
 */
async function getMatchedVodInfo(
  id: string,
  apiSites: any[],
  config: any,
  yellowWords: string[] = []
) {
  // 1. 解析原始 ID 信息
  const params = new URLSearchParams(`name=${decodeURIComponent(id)}`);
  const searchCriteria = {
    name: params.get('name') || '',
    year: params.get('year'),
    douban_id: params.get('douban_id'),
    short_drama: params.get('short_drama'),
  };

  if (!searchCriteria.name) return null;

  // 2. 并发搜索并处理超时
  const searchPromises = apiSites.map((site) =>
    Promise.race([
      searchFromApi(site, searchCriteria.name),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${site.name} timeout`)), 20000)
      ),
    ]).catch((err) => {
      console.warn(`查询失败 ${site.name}:`, err.message);
      return [];
    })
  );

  try {
    const results = await Promise.allSettled(searchPromises);
    const successResults = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<any>).value);

    let flattenedResults = successResults.flat();

    // 3. 敏感词过滤 (Yellow Filter)
    if (!config.SiteConfig.DisableYellowFilter) {
      flattenedResults = flattenedResults.filter((result) => {
        const typeName = result.type_name || '';
        return !yellowWords.some((word) => typeName.includes(word));
      });
    }

    // 4. 精准匹配过滤 (年份、豆瓣ID、短剧)
    const filteredResults = flattenedResults.filter((result) => {
      // 短剧匹配
      if (searchCriteria.short_drama === '1') {
        const isShortDrama =
          (result.class || '').includes('短剧') ||
          (result.type_name || '').includes('短剧');
        if (!isShortDrama) return false;
      }
      // 年份匹配 (兼容 vod_year 或 year 字段)
      const rYear = String(result.vod_year || result.year || '');
      const yearMatch =
        !searchCriteria.year || rYear === String(searchCriteria.year);

      // 豆瓣 ID 匹配
      const rDoubanId = String(result.vod_douban_id || result.douban_id || '0');
      const doubanIdMatch =
        !searchCriteria.douban_id ||
        rDoubanId === '0' ||
        rDoubanId === String(searchCriteria.douban_id);

      return yearMatch && doubanIdMatch;
    });

    // 5. 按 source_name 去重并提取
    const uniqueResults = Array.from(
      filteredResults
        .reduce((map, item) => {
          if (item.source_name && !map.has(item.source_name)) {
            map.set(item.source_name, item);
          }
          return map;
        }, new Map())
        .values()
    ) as any[];

    if (uniqueResults.length === 0) return null;

    // 6. 返回核心信息
    const baseInfo = uniqueResults[0];
    return {
      vodId: baseInfo.vod_id || baseInfo.id,
      sourceName: baseInfo.source_name,
      raw: baseInfo, // 保留原始数据以备后续使用
      searchCriteria, // 返回解析出的搜索条件
    };
  } catch (error) {
    console.error('解析与搜索流程异常:', error);
    return null;
  }
}
