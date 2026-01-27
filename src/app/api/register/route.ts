/* eslint-disable no-console,@typescript-eslint/no-explicit-any,@typescript-eslint/no-non-null-assertion*/
import { NextRequest, NextResponse } from 'next/server';

import { getConfig, setCachedConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// 读取存储类型环境变量，默认 sqlite
const STORAGE_TYPE =
  (process.env.NEXT_PUBLIC_STORAGE_TYPE as
    | 'localstorage'
    | 'redis'
    | 'upstash'
    | 'kvrocks'
    | 'sqlite'
    | undefined) || 'sqlite';

export async function POST(req: NextRequest) {
  try {
    if (STORAGE_TYPE === 'localstorage') {
      return NextResponse.json({ error: '不支持用户注册' }, { status: 500 });
    }
    const { username, password } = await req.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: '用户名不能为空' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
    }
    // 无法注册站长
    if (username === process.env.USERNAME) {
      return NextResponse.json({ error: '用户已存在' }, { status: 500 });
    }

    const config = await getConfig();
    const user = config.UserConfig.Users.find((u) => u.username === username);
    if (user) {
      return NextResponse.json({ error: '用户已存在' }, { status: 500 });
    }
    // 执行注册
    try {
      const key = await db.registerUser(username, password);

      // 更新配置
      const newUser: any = {
        username: username!,
        key: key,
        role: 'user',
      };
      const adminConfig = await getConfig();
      adminConfig.UserConfig.Users.push(newUser);
      await setCachedConfig(adminConfig);
      await db.saveAdminConfig(adminConfig);
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('数据库验证失败', err);
      return NextResponse.json({ error: '数据库错误' }, { status: 500 });
    }
  } catch (error) {
    console.error('注册接口异常', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
