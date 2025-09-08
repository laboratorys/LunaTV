/* eslint-disable no-console */

import fs from 'fs';
import { NextResponse } from 'next/server';
import path from 'path';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const spiderJarFilePath = path.join(
      process.cwd(),
      'public',
      'spider',
      'custom_spider.jar'
    );
    const fileData = fs.readFileSync(spiderJarFilePath);
    return new NextResponse(fileData, {
      headers: {
        'Content-Type': 'application/java-archive',
        'Content-Disposition': 'attachment; filename="custom_spider.jar"',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('custom_spider.jar:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
