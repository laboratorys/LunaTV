/* eslint-disable no-console */

import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// PCR 广告过滤结果缓存：以播放地址（m3u8）为标识，全局共享（不分用户）。
// 失效策略：不依赖 TTL，而是比对 playlist 内容哈希（内容变了才主动失效）。
const CACHE_PREFIX = 'pcrad:';
const CACHE_TTL_SECONDS = -1; // -1 = 永不过期，由 playlist 内容哈希控制失效

const cacheKey = (url: string): string =>
  CACHE_PREFIX + createHash('md5').update(url).digest('hex');

const authorize = async (request: NextRequest): Promise<string | null> => {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) return null;
  if (authInfo.username === process.env.USERNAME) return authInfo.username;
  const config = await getConfig();
  const user = config.UserConfig.Users.find(
    (u) => u.username === authInfo.username,
  );
  if (!user || user.banned) return null;
  return authInfo.username;
};

export async function GET(request: NextRequest) {
  try {
    const username = await authorize(request);
    if (!username) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    if (!url) {
      return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
    }
    const cached = await db.getCacheByKey(cacheKey(url));
    return NextResponse.json(cached);
  } catch (error) {
    console.error('查询 PCR 广告缓存失败:', error);
    return NextResponse.json(
      { error: '查询 PCR 广告缓存失败' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const username = await authorize(request);
    if (!username) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    const body = await request.json();
    const { url, adUrls, adCount, adBreaks, playlistHash } = body || {};
    if (!url || !Array.isArray(adUrls)) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }
    await db.setCacheByKey(
      cacheKey(url),
      {
        adUrls,
        adCount: Number(adCount) || 0,
        adBreaks: Number(adBreaks) || 0,
        playlistHash: typeof playlistHash === 'string' ? playlistHash : '',
        ts: Date.now(),
      },
      CACHE_TTL_SECONDS,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('保存 PCR 广告缓存失败:', error);
    return NextResponse.json(
      { error: '保存 PCR 广告缓存失败' },
      { status: 500 },
    );
  }
}
