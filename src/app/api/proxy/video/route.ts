/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reqHeaders = request.headers;
  const url = searchParams.get('url');
  const source = searchParams.get('lunatv-source');

  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  const config = await getConfig();
  const liveSource = config.LiveConfig?.find((s: any) => s.key === source);
  if (!liveSource) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }

  const ua = liveSource.ua || 'AptvPlayer/1.4.10';
  let response: Response | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    const decodedUrl = decodeURIComponent(url);

    // 获取客户端请求的Range头
    const range = reqHeaders.get('range');

    // 准备请求头
    const fetchHeaders: HeadersInit = {
      'User-Agent': ua,
    };

    // 如果有Range头，传递给源服务器
    if (range) {
      fetchHeaders['Range'] = range;
    }

    // 发起请求
    response = await fetch(decodedUrl, {
      headers: fetchHeaders,
    });

    if (!response.ok && response.status !== 206) {
      return NextResponse.json(
        { error: 'Failed to fetch segment' },
        { status: response.status }
      );
    }

    // 准备响应头
    const headers = new Headers();
    headers.set('Content-Type', 'video/mp2t');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Range, Origin, Accept'
    );
    headers.set('Accept-Ranges', 'bytes');
    headers.set(
      'Access-Control-Expose-Headers',
      'Content-Length, Content-Range'
    );

    // 复制源服务器的相关头信息
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');

    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }
    if (contentRange) {
      headers.set('Content-Range', contentRange);
    }

    // 设置正确的状态码（206表示部分内容）
    const status = response.status === 206 ? 206 : 200;

    // 使用流式传输
    const stream = new ReadableStream({
      start(controller) {
        if (!response?.body) {
          controller.close();
          return;
        }
        reader = response.body.getReader();
        const isCancelled = false;

        function pump() {
          if (isCancelled || !reader) {
            return;
          }
          reader
            .read()
            .then(({ done, value }) => {
              if (isCancelled) {
                return;
              }
              if (done) {
                controller.close();
                cleanup();
                return;
              }
              controller.enqueue(value);
              pump();
            })
            .catch((error) => {
              if (!isCancelled) {
                controller.error(error);
                cleanup();
              }
            });
        }

        function cleanup() {
          if (reader) {
            try {
              reader.releaseLock();
            } catch (e) {
              // 忽略错误
            }
            reader = null;
          }
        }

        pump();
      },
      cancel() {
        if (reader) {
          try {
            reader.releaseLock();
          } catch (e) {
            // 忽略错误
          }
          reader = null;
        }
        if (response?.body) {
          try {
            response.body.cancel();
          } catch (e) {
            // 忽略错误
          }
        }
      },
    });

    return new Response(stream, {
      headers,
      status,
    });
  } catch (error) {
    if (reader) {
      try {
        (reader as ReadableStreamDefaultReader<Uint8Array>).releaseLock();
      } catch (e) {
        // 忽略错误
      }
    }
    if (response?.body) {
      try {
        response.body.cancel();
      } catch (e) {
        // 忽略错误
      }
    }
    return NextResponse.json(
      { error: 'Failed to fetch segment' },
      { status: 500 }
    );
  }
}
