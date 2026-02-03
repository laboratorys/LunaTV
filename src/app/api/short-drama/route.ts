import { NextRequest, NextResponse } from 'next/server';

import { fetchHotShortDramaPaged } from '@/lib/short-drama.client';
import { ShortDramaItem } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';
  const pageSize = searchParams.get('pageSize') || '20';
  const data: {
    list: ShortDramaItem[];
    total: number;
    page: number;
    totalPage: number;
  } = await fetchHotShortDramaPaged(Number(page), Number(pageSize));

  if (data.list.length === 0) {
    return NextResponse.json({ error: 'No data found' }, { status: 404 });
  }

  return NextResponse.json({
    code: 200,
    message: '获取成功',
    data: data,
  });
}
