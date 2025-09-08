/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('key');

  if (!query) {
    return new Response(JSON.stringify({ error: '搜索关键词不能为空' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  const detailContentData = await fetchDetailContent(query);
  const processedData = processData(detailContentData);
  return NextResponse.json(processedData);
}
async function fetchDetailContent(id: string) {
  const detailContentUrl = new URL(
    `http://localhost:3000/api/tvbox/detailContent?id=${id}`
  );
  const response = await fetch(detailContentUrl.toString());
  return await response.json();
}

function processData(data: any) {
  if (data.list.length > 0) {
    return {
      list: {
        vod_id: data.list[0].vod_name,
        vod_name: data.list[0].vod_name,
        vod_pic: data.list[0].vod_pic,
        vod_remarks: data.list[0].vod_remarks,
      },
    };
  }
  return { list: [] };
}
