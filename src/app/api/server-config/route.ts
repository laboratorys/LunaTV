/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { resolveDanmuApiConfig } from '@/lib/danmu';
import { CURRENT_VERSION } from '@/lib/utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  console.log('server-config called: ', request.url);

  const config = await getConfig();
  const danmuApi = resolveDanmuApiConfig(config);
  const result = {
    SiteName: config.SiteConfig.SiteName,
    StorageType: process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage',
    Version: CURRENT_VERSION,
    DanmuEnabled: danmuApi.source !== 'none',
  };
  return NextResponse.json(result);
}
