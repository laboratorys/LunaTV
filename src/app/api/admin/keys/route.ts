/* eslint-disable no-console,@typescript-eslint/no-explicit-any,@typescript-eslint/no-non-null-assertion*/
import { NextRequest, NextResponse } from 'next/server';

import { getConfig, setCachedConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { DbUser } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { usernames } = await req.json();
    try {
      usernames.forEach(async (username: any) => {
        await db.generateNewKey(username);
      });
      const adminConfig = await getConfig();
      let users: DbUser[] = [];
      try {
        users = await db.getAllUsers();
      } catch (e) {
        console.error('获取用户列表失败:', e);
      }
      const allUsers = users.map((u) => ({
        username: u.user_name,
        role: u.user_name !== process.env.USERNAME ? 'user' : 'owner',
        key: u.key,
        banned: false,
      }));
      adminConfig.UserConfig.Users = allUsers as any;
      await db.saveAdminConfig(adminConfig);
      await setCachedConfig(adminConfig);
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('数据库验证失败', err);
      return NextResponse.json({ error: '数据库错误' }, { status: 500 });
    }
  } catch (error) {
    console.error('生成Key接口异常', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
