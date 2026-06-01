/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const DETAIL_PATH = '?ac=detail&ids=';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getConfig();
    if (authInfo.username !== process.env.USERNAME) {
      const user = config.UserConfig?.Users?.find(
        (u) => u.username === authInfo.username,
      );
      if (!user) {
        return NextResponse.json({ error: '用户不存在' }, { status: 401 });
      }
      if (user.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }
    const favorites = await db.getAllFavorites(authInfo.username);
    if (!favorites || Object.keys(favorites).length === 0) {
      return NextResponse.json({}, { status: 200 });
    }
    const response = NextResponse.json(favorites, { status: 200 });

    (async () => {
      try {
        const apiSites = await getAvailableApiSites(authInfo.username);

        const updatePromises = Object.entries(favorites).map(
          async ([key, favItem]: [string, any]) => {
            const [source, id] = key.split('+');
            if (!source || !id) return;

            const apiSite = apiSites.find((site) => site.key === source);
            if (!apiSite) return;

            try {
              const detailUrl = `${apiSite.api}${DETAIL_PATH}${id}`;
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时防止死锁

              const res = await fetch(detailUrl, {
                headers: HEADERS,
                signal: controller.signal,
              });
              clearTimeout(timeoutId);

              if (!res.ok) return;
              const data = await res.json();

              if (data?.list?.[0]?.vod_pic) {
                const newPic = data.list[0].vod_pic;
                console.log(newPic);
                if (newPic !== favItem.cover) {
                  favItem.cover = newPic;
                  // 异步写回数据库单个收藏记录
                  if (typeof db.saveFavorite === 'function') {
                    await db.saveFavorite(
                      authInfo.username ?? '',
                      source,
                      id,
                      favItem,
                    );
                  }
                }
              }
            } catch (err) {
              console.warn(`后台异步刷新收藏海报失败 [${favItem.title}]:`, err);
            }
          },
        );

        await Promise.all(updatePromises);
      } catch (bgErr) {
        console.error('后台刷新收藏线程错误:', bgErr);
      }
    })();

    return response;
  } catch (err) {
    console.error('触发刷新失败:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
