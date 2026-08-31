import { NextRequest, NextResponse } from 'next/server';

import { fetchHotShortDramaPaged } from '@/lib/short-drama.client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const snapshotId = searchParams.get('snapshotId') || undefined;
  const nextOffsetRaw = searchParams.get('nextOffset');
  const nextOffset = nextOffsetRaw !== null ? Number(nextOffsetRaw) : undefined;
  const data = await fetchHotShortDramaPaged(snapshotId, nextOffset);

  if (data.list.length === 0) {
    return NextResponse.json({ error: 'No data found' }, { status: 404 });
  }

  return NextResponse.json({
    code: 200,
    message: '获取成功',
    data: data,
  });
}
