/* eslint-disable no-console */

import fs from 'fs';
import { NextResponse } from 'next/server';
import path from 'path';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 壁纸目录路径
    const wallpapersDir = path.join(process.cwd(), 'public', 'wallpapers');
    const files = fs
      .readdirSync(wallpapersDir)
      .filter((file) =>
        ['.jpg', '.png', '.webp'].includes(path.extname(file).toLowerCase())
      );

    if (files.length === 0) {
      return NextResponse.json({ error: '未找到壁纸文件' }, { status: 404 });
    }

    // 随机选择一张壁纸
    const randomFile = files[Math.floor(Math.random() * files.length)];
    const filePath = path.join(wallpapersDir, randomFile);
    const fileData = fs.readFileSync(filePath);

    // 返回图片二进制流
    return new NextResponse(fileData, {
      headers: {
        'Content-Type': `image/${path.extname(randomFile).slice(1)}`, // 自动匹配图片类型
        'Cache-Control': 'public, max-age=3600', // 缓存1小时
      },
    });
  } catch (error) {
    console.error('【壁纸】获取失败:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
