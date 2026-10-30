/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { resolveDanmuApiConfig, searchDanmu } from '@/lib/danmu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getConfig();
    const username = authInfo.username;
    if (username !== process.env.USERNAME) {
      const user = config.UserConfig.Users.find((u) => u.username === username);
      if (!user || user.role !== 'admin' || user.banned) {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const url =
      typeof body.url === 'string' && body.url.trim()
        ? body.url.trim()
        : resolveDanmuApiConfig(config).url;
    const token =
      typeof body.token === 'string' && body.token.trim()
        ? body.token.trim()
        : resolveDanmuApiConfig(config).token;

    if (!url) {
      return NextResponse.json(
        { ok: false, error: '未配置弹幕 API 地址' },
        { status: 400 },
      );
    }

    const startedAt = Date.now();
    const candidates = await searchDanmu(
      { url: url.replace(/\/+$/, ''), token, source: 'site' },
      '测试',
    );
    const elapsed = Date.now() - startedAt;

    return NextResponse.json(
      {
        ok: true,
        elapsed,
        sampleCount: candidates.length,
        sample: candidates.slice(0, 3).map((item) => item.animeTitle),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('测试弹幕API连接失败:', error);
    return NextResponse.json(
      {
        ok: false,
        error: '连接失败',
        details: (error as Error).message,
      },
      { status: 502 },
    );
  }
}
