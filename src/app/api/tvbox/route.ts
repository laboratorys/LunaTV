/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

import { tvboxConfig } from '@/app/api/tvbox/tvbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = getUrlPrefix(request);
    const userAgent = request.headers.get('user-agent');
    if (!userAgent?.startsWith('okhttp')) {
      return NextResponse.redirect(new URL(url));
    }
    const config = await getConfig();
    if (!config.TvBoxConfig || config.TvBoxConfig.disabled) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    tvboxConfig.warningText = config.SiteConfig.Announcement;
    const lives = config.LiveConfig?.filter((item) => {
      const isValid = item?.url && item?.name && !item.disabled;
      return isValid;
    })?.map((item) => {
      return {
        name: item.name,
        type: 0,
        url: item.url,
        ua: item.ua || '',
        epg: item.epg || '',
        // logo: '',
        timeout: 20,
        playerType: 1,
      };
    }) as any;
    tvboxConfig.lives = lives;
    tvboxConfig.sites[0].ext = `${url}/api/tvbox`;
    tvboxConfig.wallpaper = `${url}/api/tvbox/wallpapers`;
    tvboxConfig.spider = `${url}/api/tvbox/spider`;
    return NextResponse.json(tvboxConfig);
  } catch (error) {
    console.error('【tvbox】获取配置数据失败:', error);
    return NextResponse.json({ error: '获取配置数据失败' }, { status: 500 });
  }
}
function getUrlPrefix(request: NextRequest) {
  const { protocol, host } = request.nextUrl;
  return `${protocol}//${request.headers.get('host') || host}`;
}
