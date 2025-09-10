/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { AdminConfig } from './admin.types';
import { Favorite, IStorage, PlayRecord, SkipConfig } from './types';

// 搜索历史最大条数
const SEARCH_HISTORY_LIMIT = 20;

// 数据类型转换辅助函数
function ensureString(value: any): string {
  return String(value);
}

function ensureStringArray(value: any[]): string[] {
  return value.map((item) => String(item));
}

class DB {
  private static instance: Database.Database;

  static getInstance(): Database.Database {
    if (!DB.instance) {
      const dbPath = process.env.SQLITE_PATH || '/app/data/tv.db';
      if (!fs.existsSync(path.dirname(dbPath))) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      }
      DB.instance = new Database(dbPath);
      DB.instance.pragma('journal_mode = WAL');
      // 初始化表结构
      DB.instance.exec(`
        CREATE TABLE IF NOT EXISTS play_records (
          user_name TEXT,
          key TEXT,
          record TEXT,
          PRIMARY KEY (user_name, key)
        );
        CREATE TABLE IF NOT EXISTS favorites (
          user_name TEXT,
          key TEXT,
          favorite TEXT,
          PRIMARY KEY (user_name, key)
        );
        CREATE TABLE IF NOT EXISTS users (
          user_name TEXT PRIMARY KEY,
          password TEXT
        );
        CREATE TABLE IF NOT EXISTS search_history (
          user_name TEXT,
          keyword TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_name, keyword)
        );
        CREATE TABLE IF NOT EXISTS cache (
          key TEXT PRIMARY KEY,
          data TEXT,
          expiry TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS admin_config (
          key TEXT PRIMARY KEY,
          config TEXT
        );
        CREATE TABLE IF NOT EXISTS skip_configs (
          user_name TEXT,
          source TEXT,
          id TEXT,
          config TEXT,
          PRIMARY KEY (user_name, source, id)
        );
      `);
    }
    return DB.instance;
  }

  static close(): void {
    if (DB.instance) {
      DB.instance.close();
    }
  }
}

// 抽象基类，包含所有通用的 SQLite 操作逻辑
export class SqliteStorage implements IStorage {
  private db: Database.Database;

  constructor() {
    this.db = DB.getInstance();
  }

  // ---------- 播放记录 ----------
  private prKey(user: string, key: string) {
    return { user_name: user, key };
  }

  async getPlayRecord(
    userName: string,
    key: string
  ): Promise<PlayRecord | null> {
    const stmt = this.db.prepare(
      'SELECT record FROM play_records WHERE user_name = ? AND key = ?'
    );
    const row = stmt.get(userName, key) as { record: string } | undefined;
    return row ? (JSON.parse(row.record) as PlayRecord) : null;
  }

  async setPlayRecord(
    userName: string,
    key: string,
    record: PlayRecord
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO play_records (user_name, key, record)
      VALUES (?, ?, ?)
    `);
    stmt.run(userName, key, JSON.stringify(record));
  }

  async getAllPlayRecords(
    userName: string
  ): Promise<Record<string, PlayRecord>> {
    const stmt = this.db.prepare(
      'SELECT key, record FROM play_records WHERE user_name = ?'
    );
    const rows = stmt.all(userName) as { key: string; record: string }[];
    const result: Record<string, PlayRecord> = {};
    for (const row of rows) {
      result[row.key] = JSON.parse(row.record) as PlayRecord;
    }
    return result;
  }

  async deletePlayRecord(userName: string, key: string): Promise<void> {
    const stmt = this.db.prepare(
      'DELETE FROM play_records WHERE user_name = ? AND key = ?'
    );
    stmt.run(userName, key);
  }

  // ---------- 收藏 ----------
  private favKey(user: string, key: string) {
    return { user_name: user, key };
  }

  async getFavorite(userName: string, key: string): Promise<Favorite | null> {
    const stmt = this.db.prepare(
      'SELECT favorite FROM favorites WHERE user_name = ? AND key = ?'
    );
    const row = stmt.get(userName, key) as { favorite: string } | undefined;
    return row ? (JSON.parse(row.favorite) as Favorite) : null;
  }

  async setFavorite(
    userName: string,
    key: string,
    favorite: Favorite
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO favorites (user_name, key, favorite)
      VALUES (?, ?, ?)
    `);
    stmt.run(userName, key, JSON.stringify(favorite));
  }

  async getAllFavorites(userName: string): Promise<Record<string, Favorite>> {
    const stmt = this.db.prepare(
      'SELECT key, favorite FROM favorites WHERE user_name = ?'
    );
    const rows = stmt.all(userName) as { key: string; favorite: string }[];
    const result: Record<string, Favorite> = {};
    for (const row of rows) {
      result[row.key] = JSON.parse(row.favorite) as Favorite;
    }
    return result;
  }

  async deleteFavorite(userName: string, key: string): Promise<void> {
    const stmt = this.db.prepare(
      'DELETE FROM favorites WHERE user_name = ? AND key = ?'
    );
    stmt.run(userName, key);
  }

  // ---------- 用户注册 / 登录 ----------
  private userPwdKey(user: string) {
    return { user_name: user };
  }

  async registerUser(userName: string, password: string): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO users (user_name, password) VALUES (?, ?)'
    );
    stmt.run(userName, password);
  }

  async verifyUser(userName: string, password: string): Promise<boolean> {
    const stmt = this.db.prepare(
      'SELECT password FROM users WHERE user_name = ?'
    );
    const row = stmt.get(userName) as { password: string } | undefined;
    return row ? ensureString(row.password) === password : false;
  }

  async checkUserExist(userName: string): Promise<boolean> {
    const stmt = this.db.prepare('SELECT 1 FROM users WHERE user_name = ?');
    const row = stmt.get(userName);
    return !!row;
  }

  async changePassword(userName: string, newPassword: string): Promise<void> {
    const stmt = this.db.prepare(
      'UPDATE users SET password = ? WHERE user_name = ?'
    );
    stmt.run(newPassword, userName);
  }

  async deleteUser(userName: string): Promise<void> {
    const tables = [
      'play_records',
      'favorites',
      'search_history',
      'skip_configs',
    ];
    this.db.transaction(() => {
      for (const table of tables) {
        const stmt = this.db.prepare(
          `DELETE FROM ${table} WHERE user_name = ?`
        );
        stmt.run(userName);
      }
      const stmt = this.db.prepare('DELETE FROM users WHERE user_name = ?');
      stmt.run(userName);
    })();
  }

  // ---------- 搜索历史 ----------
  private shKey(user: string) {
    return { user_name: user };
  }

  async getSearchHistory(userName: string): Promise<string[]> {
    const stmt = this.db.prepare(
      'SELECT keyword FROM search_history WHERE user_name = ? ORDER BY created_at DESC'
    );
    const rows = stmt.all(userName) as { keyword: string }[];
    return ensureStringArray(rows.map((row) => row.keyword));
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    this.db.transaction(() => {
      // 删除重复的关键词
      const deleteStmt = this.db.prepare(
        'DELETE FROM search_history WHERE user_name = ? AND keyword = ?'
      );
      deleteStmt.run(userName, ensureString(keyword));
      // 插入新关键词
      const insertStmt = this.db.prepare(
        'INSERT INTO search_history (user_name, keyword) VALUES (?, ?)'
      );
      insertStmt.run(userName, ensureString(keyword));
      // 限制最大长度
      const countStmt = this.db.prepare(
        'SELECT COUNT(*) as count FROM search_history WHERE user_name = ?'
      );
      const { count } = countStmt.get(userName) as { count: number };
      if (count > SEARCH_HISTORY_LIMIT) {
        const deleteOldStmt = this.db.prepare(`
          DELETE FROM search_history
          WHERE user_name = ? AND keyword IN (
            SELECT keyword FROM search_history
            WHERE user_name = ?
            ORDER BY created_at ASC
            LIMIT ?
          )
        `);
        deleteOldStmt.run(userName, userName, count - SEARCH_HISTORY_LIMIT);
      }
    })();
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    if (keyword) {
      const stmt = this.db.prepare(
        'DELETE FROM search_history WHERE user_name = ? AND keyword = ?'
      );
      stmt.run(userName, ensureString(keyword));
    } else {
      const stmt = this.db.prepare(
        'DELETE FROM search_history WHERE user_name = ?'
      );
      stmt.run(userName);
    }
  }

  // ---------- 获取缓存 ----------
  async getCacheByKey(key: string): Promise<any> {
    const stmt = this.db.prepare(
      'SELECT data FROM cache WHERE key = ? AND (expiry IS NULL OR expiry > ?)'
    );
    const row = stmt.get(key, new Date().toISOString()) as
      | { data: string }
      | undefined;
    return row ? JSON.parse(row.data) : null;
  }

  // ---------- 设置缓存 ----------
  async setCacheByKey(key: string, data: any, ttl: number): Promise<void> {
    const expiry =
      ttl === -1 ? null : new Date(Date.now() + ttl * 1000).toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cache (key, data, expiry)
      VALUES (?, ?, ?)
    `);
    stmt.run(key, JSON.stringify(data), expiry);
  }

  // ---------- 清理过期缓存 ----------
  async clearExpiredCache(): Promise<number> {
    const stmt = this.db.prepare(
      'DELETE FROM cache WHERE expiry IS NOT NULL AND expiry <= ?'
    );
    const currentTime = new Date().toISOString();
    const result = stmt.run(currentTime);
    const deletedCount = result.changes;
    return deletedCount;
  }

  // ---------- 清理全部缓存 ----------
  async clearAllCache(keysPrefix: string): Promise<number> {
    const stmt = this.db.prepare('DELETE FROM cache WHERE key LIKE ?');
    const result = stmt.run(`${keysPrefix}%`);
    return result.changes || 0;
  }

  // ---------- 获取全部用户 ----------
  async getAllUsers(): Promise<string[]> {
    const stmt = this.db.prepare('SELECT user_name FROM users');
    const rows = stmt.all() as { user_name: string }[];
    return rows.map((row) => ensureString(row.user_name));
  }

  // ---------- 管理员配置 ----------
  private adminConfigKey() {
    return 'admin:config';
  }

  async getAdminConfig(): Promise<AdminConfig | null> {
    const stmt = this.db.prepare(
      'SELECT config FROM admin_config WHERE key = ?'
    );
    const row = stmt.get(this.adminConfigKey()) as
      | { config: string }
      | undefined;
    return row ? (JSON.parse(row.config) as AdminConfig) : null;
  }

  async setAdminConfig(config: AdminConfig): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO admin_config (key, config)
      VALUES (?, ?)
    `);
    stmt.run(this.adminConfigKey(), JSON.stringify(config));
  }

  // ---------- 跳过片头片尾配置 ----------
  private skipConfigKey(user: string, source: string, id: string) {
    return { user_name: user, source, id };
  }

  async getSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<SkipConfig | null> {
    const stmt = this.db.prepare(
      'SELECT config FROM skip_configs WHERE user_name = ? AND source = ? AND id = ?'
    );
    const row = stmt.get(userName, source, id) as
      | { config: string }
      | undefined;
    return row ? (JSON.parse(row.config) as SkipConfig) : null;
  }

  async setSkipConfig(
    userName: string,
    source: string,
    id: string,
    config: SkipConfig
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO skip_configs (user_name, source, id, config)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(userName, source, id, JSON.stringify(config));
  }

  async deleteSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<void> {
    const stmt = this.db.prepare(
      'DELETE FROM skip_configs WHERE user_name = ? AND source = ? AND id = ?'
    );
    stmt.run(userName, source, id);
  }

  async getAllSkipConfigs(
    userName: string
  ): Promise<{ [key: string]: SkipConfig }> {
    const stmt = this.db.prepare(
      'SELECT source, id, config FROM skip_configs WHERE user_name = ?'
    );
    const rows = stmt.all(userName) as {
      source: string;
      id: string;
      config: string;
    }[];
    const configs: { [key: string]: SkipConfig } = {};
    for (const row of rows) {
      configs[`${row.source}+${row.id}`] = JSON.parse(row.config) as SkipConfig;
    }
    return configs;
  }

  // 清空所有数据
  async clearAllData(): Promise<void> {
    try {
      this.db.transaction(() => {
        this.db.exec(`
          DELETE FROM play_records;
          DELETE FROM favorites;
          DELETE FROM users;
          DELETE FROM search_history;
          DELETE FROM cache;
          DELETE FROM admin_config;
          DELETE FROM skip_configs;
        `);
      })();
      console.log('所有数据已清空');
    } catch (error) {
      console.error('清空数据失败:', error);
      throw new Error('清空数据失败');
    }
  }
}
