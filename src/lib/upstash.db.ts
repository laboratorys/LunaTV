/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import { Redis } from '@upstash/redis';

import { AdminConfig } from './admin.types';
import { hashPassword, verifyPassword } from './bcrypt';
import { DbUser, Favorite, IStorage, PlayRecord, SkipConfig } from './types';
import { generateShortKey } from './utils';

// 搜索历史最大条数
const SEARCH_HISTORY_LIMIT = 20;

// 数据类型转换辅助函数
function ensureString(value: any): string {
  return String(value);
}

function ensureStringArray(value: any[]): string[] {
  return value.map((item) => String(item));
}

// 添加Upstash Redis操作重试包装器
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (err: any) {
      const isLastAttempt = i === maxRetries - 1;
      const isConnectionError =
        err.message?.includes('Connection') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('ENOTFOUND') ||
        err.code === 'ECONNRESET' ||
        err.code === 'EPIPE' ||
        err.name === 'UpstashError';

      if (isConnectionError && !isLastAttempt) {
        console.log(
          `Upstash Redis operation failed, retrying... (${i + 1}/${maxRetries})`
        );
        console.error('Error:', err.message);

        // 等待一段时间后重试
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }

      throw err;
    }
  }

  throw new Error('Max retries exceeded');
}

export class UpstashRedisStorage implements IStorage {
  private client: Redis;

  constructor() {
    this.client = getUpstashRedisClient();
  }

  // ---------- 播放记录 ----------
  private prKey(user: string, key: string) {
    return `u:${user}:pr:${key}`; // u:username:pr:source+id
  }

  async getPlayRecord(
    userName: string,
    key: string
  ): Promise<PlayRecord | null> {
    const val = await withRetry(() =>
      this.client.get(this.prKey(userName, key))
    );
    return val ? (val as PlayRecord) : null;
  }

  async setPlayRecord(
    userName: string,
    key: string,
    record: PlayRecord
  ): Promise<void> {
    await withRetry(() => this.client.set(this.prKey(userName, key), record));
  }

  async getAllPlayRecords(
    userName: string
  ): Promise<Record<string, PlayRecord>> {
    const pattern = `u:${userName}:pr:*`;
    const keys: string[] = await withRetry(() => this.client.keys(pattern));
    if (keys.length === 0) return {};

    const result: Record<string, PlayRecord> = {};
    for (const fullKey of keys) {
      const value = await withRetry(() => this.client.get(fullKey));
      if (value) {
        // 截取 source+id 部分
        const keyPart = ensureString(fullKey.replace(`u:${userName}:pr:`, ''));
        result[keyPart] = value as PlayRecord;
      }
    }
    return result;
  }

  async deletePlayRecord(userName: string, key: string): Promise<void> {
    await withRetry(() => this.client.del(this.prKey(userName, key)));
  }

  // ---------- 收藏 ----------
  private favKey(user: string, key: string) {
    return `u:${user}:fav:${key}`;
  }

  async getFavorite(userName: string, key: string): Promise<Favorite | null> {
    const val = await withRetry(() =>
      this.client.get(this.favKey(userName, key))
    );
    return val ? (val as Favorite) : null;
  }

  async setFavorite(
    userName: string,
    key: string,
    favorite: Favorite
  ): Promise<void> {
    await withRetry(() =>
      this.client.set(this.favKey(userName, key), favorite)
    );
  }

  async getAllFavorites(userName: string): Promise<Record<string, Favorite>> {
    const pattern = `u:${userName}:fav:*`;
    const keys: string[] = await withRetry(() => this.client.keys(pattern));
    if (keys.length === 0) return {};

    const result: Record<string, Favorite> = {};
    for (const fullKey of keys) {
      const value = await withRetry(() => this.client.get(fullKey));
      if (value) {
        const keyPart = ensureString(fullKey.replace(`u:${userName}:fav:`, ''));
        result[keyPart] = value as Favorite;
      }
    }
    return result;
  }

  async deleteFavorite(userName: string, key: string): Promise<void> {
    await withRetry(() => this.client.del(this.favKey(userName, key)));
  }

  // ---------- 用户注册 / 登录 ----------
  private userPwdKey(user: string) {
    return `u:${user}:pwd`;
  }

  async registerUser(userName: string, password: string): Promise<string> {
    const key = generateShortKey(userName);
    // 简单存储明文密码，生产环境应加密
    await withRetry(() =>
      this.client.set(this.userPwdKey(userName), {
        key: key,
        password,
      })
    );
    return key;
  }

  async verifyUser(userName: string, password: string): Promise<boolean> {
    const userData = await this.getUser(userName);
    if (userData === null) return false;
    return verifyPassword(password, userData.password);
  }

  async getUser(userName: string): Promise<any> {
    const stored = await withRetry(() =>
      this.client.get(this.userPwdKey(userName))
    );
    if (stored === null) return null;
    return JSON.parse(ensureString(stored));
  }

  // 生成新Key
  async generateNewKey(userName: string): Promise<void> {
    const key = generateShortKey(userName);
    const userData = await this.getUser(userName);
    userData.key = key;
    await withRetry(() =>
      this.client.set(this.userPwdKey(userName), JSON.stringify(userData))
    );
  }

  // 检查用户是否存在
  async checkUserExist(userName: string): Promise<boolean> {
    // 使用 EXISTS 判断 key 是否存在
    const exists = await withRetry(() =>
      this.client.exists(this.userPwdKey(userName))
    );
    return exists === 1;
  }

  // 修改用户密码
  async changePassword(userName: string, newPassword: string): Promise<void> {
    const userData = await this.getUser(userName);
    userData.password = await hashPassword(newPassword);
    await withRetry(() =>
      this.client.set(this.userPwdKey(userName), JSON.stringify(userData))
    );
  }

  // 删除用户及其所有数据
  async deleteUser(userName: string): Promise<void> {
    // 删除用户密码
    await withRetry(() => this.client.del(this.userPwdKey(userName)));

    // 删除搜索历史
    await withRetry(() => this.client.del(this.shKey(userName)));

    // 删除播放记录
    const playRecordPattern = `u:${userName}:pr:*`;
    const playRecordKeys = await withRetry(() =>
      this.client.keys(playRecordPattern)
    );
    if (playRecordKeys.length > 0) {
      await withRetry(() => this.client.del(...playRecordKeys));
    }

    // 删除收藏夹
    const favoritePattern = `u:${userName}:fav:*`;
    const favoriteKeys = await withRetry(() =>
      this.client.keys(favoritePattern)
    );
    if (favoriteKeys.length > 0) {
      await withRetry(() => this.client.del(...favoriteKeys));
    }

    // 删除跳过片头片尾配置
    const skipConfigPattern = `u:${userName}:skip:*`;
    const skipConfigKeys = await withRetry(() =>
      this.client.keys(skipConfigPattern)
    );
    if (skipConfigKeys.length > 0) {
      await withRetry(() => this.client.del(...skipConfigKeys));
    }
  }

  // ---------- 搜索历史 ----------
  private shKey(user: string) {
    return `u:${user}:sh`; // u:username:sh
  }

  async getSearchHistory(userName: string): Promise<string[]> {
    const result = await withRetry(() =>
      this.client.lrange(this.shKey(userName), 0, -1)
    );
    // 确保返回的都是字符串类型
    return ensureStringArray(result as any[]);
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    const key = this.shKey(userName);
    // 先去重
    await withRetry(() => this.client.lrem(key, 0, ensureString(keyword)));
    // 插入到最前
    await withRetry(() => this.client.lpush(key, ensureString(keyword)));
    // 限制最大长度
    await withRetry(() => this.client.ltrim(key, 0, SEARCH_HISTORY_LIMIT - 1));
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    const key = this.shKey(userName);
    if (keyword) {
      await withRetry(() => this.client.lrem(key, 0, ensureString(keyword)));
    } else {
      await withRetry(() => this.client.del(key));
    }
  }

  // ---------- 获取缓存 ----------
  async getCacheByKey(key: string): Promise<any> {
    const result = await withRetry(() => this.client.get(key));
    return result as any;
  }

  // ---------- 设置缓存 ----------
  async setCacheByKey(key: string, data: any, ttl: number): Promise<void> {
    await withRetry(() => {
      if (ttl != -1) {
        return this.client.set(key, data, { ex: ttl });
      }
      return this.client.set(key, data);
    });
  }

  // ---------- 清理过期缓存 ----------
  async clearExpiredCache(): Promise<number> {
    //无需清理，ttl到期自动失效
    return 1;
  }

  // ---------- 清理全部缓存 ----------
  async clearAllCache(keysPrefix: string): Promise<number> {
    const keys = await withRetry(() => this.client.keys(`${keysPrefix}*`));
    if (!keys || keys.length === 0) {
      return 0;
    }
    const deleteCount = await withRetry(() => this.client.del(...keys));
    return deleteCount;
  }

  // ---------- 获取全部用户 ----------
  async getAllUsers(): Promise<DbUser[]> {
    const keys = await withRetry(() => this.client.keys('u:*:pwd'));
    if (keys.length === 0) return [];
    const values = await withRetry(() => this.client.mget<string[]>(keys));
    return values
      .map((val, index) => {
        if (!val) return undefined;

        try {
          const data = JSON.parse(val);
          const match = keys[index].match(/^u:(.+?):pwd$/);
          const userName = match ? match[1] : 'unknown';

          return {
            user_name: userName,
            password: data.password || '',
            key: data.key || generateShortKey(userName),
          };
        } catch (e) {
          return undefined;
        }
      })
      .filter((u): u is DbUser => !!u);
  }

  // ---------- 管理员配置 ----------
  private adminConfigKey() {
    return 'admin:config';
  }

  async getAdminConfig(): Promise<AdminConfig | null> {
    const val = await withRetry(() => this.client.get(this.adminConfigKey()));
    return val ? (val as AdminConfig) : null;
  }

  async setAdminConfig(config: AdminConfig): Promise<void> {
    await withRetry(() => this.client.set(this.adminConfigKey(), config));
  }

  // ---------- 跳过片头片尾配置 ----------
  private skipConfigKey(user: string, source: string, id: string) {
    return `u:${user}:skip:${source}+${id}`;
  }

  async getSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<SkipConfig | null> {
    const val = await withRetry(() =>
      this.client.get(this.skipConfigKey(userName, source, id))
    );
    return val ? (val as SkipConfig) : null;
  }

  async setSkipConfig(
    userName: string,
    source: string,
    id: string,
    config: SkipConfig
  ): Promise<void> {
    await withRetry(() =>
      this.client.set(this.skipConfigKey(userName, source, id), config)
    );
  }

  async deleteSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<void> {
    await withRetry(() =>
      this.client.del(this.skipConfigKey(userName, source, id))
    );
  }

  async getAllSkipConfigs(
    userName: string
  ): Promise<{ [key: string]: SkipConfig }> {
    const pattern = `u:${userName}:skip:*`;
    const keys = await withRetry(() => this.client.keys(pattern));

    if (keys.length === 0) {
      return {};
    }

    const configs: { [key: string]: SkipConfig } = {};

    // 批量获取所有配置
    const values = await withRetry(() => this.client.mget(keys));

    keys.forEach((key, index) => {
      const value = values[index];
      if (value) {
        // 从key中提取source+id
        const match = key.match(/^u:.+?:skip:(.+)$/);
        if (match) {
          const sourceAndId = match[1];
          configs[sourceAndId] = value as SkipConfig;
        }
      }
    });

    return configs;
  }

  // 清空所有数据
  async clearAllData(): Promise<void> {
    try {
      // 获取所有用户
      const allUsers = await this.getAllUsers();

      // 删除所有用户及其数据
      for (const u of allUsers) {
        await this.deleteUser(u.user_name);
      }

      // 删除管理员配置
      await withRetry(() => this.client.del(this.adminConfigKey()));

      console.log('所有数据已清空');
    } catch (error) {
      console.error('清空数据失败:', error);
      throw new Error('清空数据失败');
    }
  }
}

// 单例 Upstash Redis 客户端
function getUpstashRedisClient(): Redis {
  const globalKey = Symbol.for('__LUNA_UPSTASH_REDIS_CLIENT__');
  let client: Redis | undefined = (global as any)[globalKey];

  if (!client) {
    const upstashUrl = process.env.UPSTASH_URL;
    const upstashToken = process.env.UPSTASH_TOKEN;

    if (!upstashUrl || !upstashToken) {
      throw new Error(
        'UPSTASH_URL and UPSTASH_TOKEN env variables must be set'
      );
    }

    // 创建 Upstash Redis 客户端
    client = new Redis({
      url: upstashUrl,
      token: upstashToken,
      // 可选配置
      retry: {
        retries: 3,
        backoff: (retryCount: number) =>
          Math.min(1000 * Math.pow(2, retryCount), 30000),
      },
    });

    console.log('Upstash Redis client created successfully');

    (global as any)[globalKey] = client;
  }

  return client;
}
