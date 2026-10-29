/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getCacheTime, getConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const config = await getConfig();

    // 非站长：校验用户存在且未被封禁
    if (authInfo.username !== process.env.USERNAME) {
      const user = config.UserConfig.Users.find(
        (u) => u.username === authInfo.username,
      );
      if (!user) {
        return NextResponse.json({ error: '用户不存在' }, { status: 401 });
      }
      if (user.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }

    const apiSites = await getAvailableApiSites(authInfo.username);
    const cacheTime = await getCacheTime();

    // 组装按 key 索引的 api_site；filter_ads 默认 true（仅显式 false 才关闭）
    const api_site: Record<
      string,
      { api: string; name: string; filter_ads: boolean }
    > = {};
    for (const site of apiSites) {
      if (!site.api) {
        continue;
      }
      api_site[site.key] = {
        api: site.api,
        name: site.name,
        filter_ads: site.filter_ads !== false,
      };
    }

    // lives：返回全部未禁用且 url/name 有效的直播源
    const lives: Record<string, { name: string; url: string; epg?: string }> =
      {};
    for (const live of config.LiveConfig || []) {
      if (live.disabled || !live.url || !live.name) {
        continue;
      }
      const entry: { name: string; url: string; epg?: string } = {
        name: live.name,
        url: live.url,
      };
      if (live.epg) {
        entry.epg = live.epg;
      }
      lives[live.key] = entry;
    }

    const body = {
      cache_time: cacheTime,
      api_site,
      lives,
    };

    return NextResponse.json(body, {
      headers: {
        // 按用户个性化，禁止 CDN 跨用户缓存
        'Cache-Control': `private, max-age=${cacheTime}`,
      },
    });
  } catch (error) {
    console.error('【sub】获取订阅配置失败:', error);
    return NextResponse.json({ error: '获取订阅配置失败' }, { status: 500 });
  }
}
