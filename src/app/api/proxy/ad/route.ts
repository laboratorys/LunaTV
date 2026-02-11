/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

import { getBaseUrl, resolveUrl } from '@/lib/live';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const allowCORS = searchParams.get('allowCORS') === 'true';

  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  try {
    const decodedUrl = decodeURIComponent(url);
    console.log(decodedUrl);
    const response = await fetch(decodedUrl, {
      cache: 'no-cache',
      redirect: 'follow',
    });
    if (!response.ok)
      return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });

    const contentType = response.headers.get('Content-Type') || '';
    const isM3U8 =
      contentType.toLowerCase().includes('mpegurl') ||
      contentType.toLowerCase().includes('octet-stream') ||
      decodedUrl.includes('.m3u8');

    if (isM3U8) {
      const m3u8Content = await response.text();
      const baseUrl = getBaseUrl(response.url);
      const modifiedContent = processM3U8(
        m3u8Content,
        baseUrl,
        request,
        allowCORS
      );

      return new Response(modifiedContent, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}

function processM3U8(
  content: string,
  baseUrl: string,
  req: Request,
  allowCORS: boolean
) {
  const host = req.headers.get('host');
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  const proxyBase = `${protocol}://${host}/api/proxy`;

  // 如果是多码率列表 (Master Playlist)
  if (content.includes('#EXT-X-STREAM-INF')) {
    return content
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          // 这里指向的是 /ad 路由，请确保你的路由路径正确
          return `${proxyBase}/ad?url=${encodeURIComponent(
            resolveUrl(baseUrl, trimmed)
          )}&allowCORS=${allowCORS}`;
        }
        return line;
      })
      .join('\n');
  }

  // 如果是切片列表 (Media Playlist)，调用智能过滤
  return smartFilterAds(content, baseUrl);
}

function smartFilterAds(m3u8Content: string, baseUrl: string): string {
  if (typeof m3u8Content !== 'string') return '';

  const lines = m3u8Content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');
  const headerLines: string[] = [];
  const bodyLines: string[] = [];

  // 1. 严格分离头部和主体
  lines.forEach((line) => {
    if (
      line.startsWith('#EXTM3U') ||
      line.startsWith('#EXT-X-VERSION') ||
      line.startsWith('#EXT-X-TARGETDURATION') ||
      line.startsWith('#EXT-X-PLAYLIST-TYPE') ||
      line.startsWith('#EXT-X-MEDIA-SEQUENCE')
    ) {
      headerLines.push(line);
    } else {
      bodyLines.push(line);
    }
  });

  // 2. 分组
  const groups: any[] = [];
  let currentGroup: any = { isDiscontinuous: false, lines: [], duration: 0 };

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];
    if (line.startsWith('#EXT-X-DISCONTINUITY')) {
      if (currentGroup.lines.length > 0) groups.push(currentGroup);
      currentGroup = { isDiscontinuous: true, lines: [], duration: 0 };
    } else if (line.startsWith('#EXTINF:')) {
      const match = line.match(/#EXTINF:([\d.]+)/);
      const dur = match ? parseFloat(match[1]) : 0;
      currentGroup.duration += dur;
      currentGroup.lines.push({ type: 'INF', val: line });
      if (i + 1 < bodyLines.length && !bodyLines[i + 1].startsWith('#')) {
        currentGroup.lines.push({ type: 'TS', val: bodyLines[++i] });
      }
    } else {
      currentGroup.lines.push({ type: 'OTHER', val: line });
    }
  }
  groups.push(currentGroup);

  // 3. 过滤逻辑 (针对你的文件特别优化)
  const finalBody: string[] = [];
  groups.forEach((group, index) => {
    const tsCount = group.lines.filter((l: any) => l.type === 'TS').length;

    // --- 更加保守的过滤逻辑 ---
    let shouldFilter = false;

    if (group.isDiscontinuous && tsCount > 0) {
      // 只有同时满足以下条件才判定为广告：
      // 1. 不是第一组 (index 0)
      // 2. 总时长极其接近 15s 或 30s (正负误差极小)
      // 3. 切片数量非常少 (通常广告切片多为 3-5 个)
      const isExactly15s = Math.abs(group.duration - 15.0) < 0.05;
      const isExactly30s = Math.abs(group.duration - 30.0) < 0.05;

      if (index > 0 && (isExactly15s || isExactly30s) && tsCount <= 5) {
        shouldFilter = true;
      }
    }

    if (shouldFilter) {
      console.log(`[已拦截真实广告] 索引:${index}, 时长:${group.duration}s`);
      return;
    }

    // 4. 还原
    if (group.isDiscontinuous) finalBody.push('#EXT-X-DISCONTINUITY');
    group.lines.forEach((l: any) => {
      if (l.type === 'TS') {
        finalBody.push(resolveUrl(baseUrl, l.val));
      } else {
        finalBody.push(l.val);
      }
    });
  });

  return [...headerLines, ...finalBody].join('\n');
}
