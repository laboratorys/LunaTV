import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getCacheTime } from '@/lib/config';
import { searchWithNoCache } from '@/lib/downstream';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const sourceCode = searchParams.get('source');
  const ids = searchParams.get('ids');
  const wd = searchParams.get('wd');
  const h = searchParams.get('h');
  const pg = searchParams.get('pg');
  const t = searchParams.get('t');
  try {
    const apiSites = await getAvailableApiSites(authInfo.username);
    const apiSite = apiSites.find((site) => site.key === sourceCode);

    if (!apiSite) {
      return NextResponse.json({ error: '无效的API来源' }, { status: 400 });
    }
    const searchResult = await searchWithNoCache(
      apiSite,
      ids ? ids : '',
      wd || '',
      pg ? parseInt(pg) : 1,
      t || '',
      h || ''
    );
    const finalResult = searchResult.map((item: any) => ({
      id: item.id,
      title: item.title,
      poster: item.poster,
      source: item.source,
      source_name: item.source_name,
      class: item.class,
      year: item.year,
      douban_id: item.douban_id,
      remarks: item.remarks,
    }));
    const cacheTime = await getCacheTime();
    return NextResponse.json(finalResult, {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Netlify-Vary': 'query',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
