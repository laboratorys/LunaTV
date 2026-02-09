import { AdminConfig } from './admin.types';

// 播放记录数据结构
export interface PlayRecord {
  title: string;
  source_name: string;
  cover: string;
  year: string;
  index: number; // 第几集
  total_episodes: number; // 总集数
  play_time: number; // 播放进度（秒）
  total_time: number; // 总进度（秒）
  save_time: number; // 记录保存时间（时间戳）
  search_title: string; // 搜索时使用的标题
  episode_title: string;
  episode_url: string;
  tvbox_record?: TVBoxRecord; //TVBox记录
}

//TVBox播放记录结构
export interface TVBoxRecord {
  cid: number; //序号
  createTime: number; //创建时间
  duration: number; //时长
  ending: number | bigint; //跳过片尾：默认占位符（-9223372036854776000）
  opening: number | bigint; //跳过片头：默认占位符（-9223372036854776000）
  episodeUrl: string; //视频流具体播放地址
  key: string; //唯一标识，格式: vod_key@@@id@@@cid
  position: number; //播放位置
  revPlay: boolean; //循环播放
  revSort: boolean; //反向排序
  scale: number; //画面比例
  speed: number; //播放倍速
  vodFlag: string; //播放标志（源）
  vodName: string; //名称
  vodPic: string; //海报
  vodRemarks: string; //播放备注
}
// 收藏数据结构
export interface Favorite {
  source_name: string;
  total_episodes: number; // 总集数
  title: string;
  year: string;
  cover: string;
  save_time: number; // 记录保存时间（时间戳）
  search_title: string; // 搜索时使用的标题
  origin?: 'vod' | 'live';
}

export interface DbUser {
  user_name: string;
  key: string; // key
  password: string;
}

// 存储接口
export interface IStorage {
  // 播放记录相关
  getPlayRecord(userName: string, key: string): Promise<PlayRecord | null>;
  setPlayRecord(
    userName: string,
    key: string,
    record: PlayRecord
  ): Promise<void>;
  getAllPlayRecords(userName: string): Promise<{ [key: string]: PlayRecord }>;
  deletePlayRecord(userName: string, key: string): Promise<void>;

  // 收藏相关
  getFavorite(userName: string, key: string): Promise<Favorite | null>;
  setFavorite(userName: string, key: string, favorite: Favorite): Promise<void>;
  getAllFavorites(userName: string): Promise<{ [key: string]: Favorite }>;
  deleteFavorite(userName: string, key: string): Promise<void>;

  // 用户相关
  registerUser(userName: string, password: string): Promise<string>;
  verifyUser(userName: string, password: string): Promise<boolean>;
  //查询用户信息
  getUser(userName: string): Promise<any>;
  //生成新Key
  generateNewKey(userName: string): Promise<void>;
  // 检查用户是否存在（无需密码）
  checkUserExist(userName: string): Promise<boolean>;
  // 修改用户密码
  changePassword(userName: string, newPassword: string): Promise<void>;
  // 删除用户（包括密码、搜索历史、播放记录、收藏夹）
  deleteUser(userName: string): Promise<void>;

  // 搜索历史相关
  getSearchHistory(userName: string): Promise<string[]>;
  addSearchHistory(userName: string, keyword: string): Promise<void>;
  deleteSearchHistory(userName: string, keyword?: string): Promise<void>;

  //缓存相关
  getCacheByKey(key: string): Promise<any>;
  setCacheByKey(key: string, data: any, ttl: number): Promise<void>;
  clearExpiredCache(): Promise<number>;
  clearAllCache(keysPrefix: string): Promise<number>;

  // 用户列表
  getAllUsers(): Promise<DbUser[]>;

  // 管理员配置相关
  getAdminConfig(): Promise<AdminConfig | null>;
  setAdminConfig(config: AdminConfig): Promise<void>;

  // 跳过片头片尾配置相关
  getSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<SkipConfig | null>;
  setSkipConfig(
    userName: string,
    source: string,
    id: string,
    config: SkipConfig
  ): Promise<void>;
  deleteSkipConfig(userName: string, source: string, id: string): Promise<void>;
  getAllSkipConfigs(userName: string): Promise<{ [key: string]: SkipConfig }>;

  // 数据清理相关
  clearAllData(): Promise<void>;
}

// 搜索结果数据结构
export interface SearchResult {
  id: string;
  title: string;
  poster: string;
  episodes: string[];
  episodes_titles: string[];
  source: string;
  source_name: string;
  class?: string;
  year: string;
  desc?: string;
  type_name?: string;
  douban_id?: number;
  rate?: string;
}

// 豆瓣数据结构
export interface DoubanItem {
  id: string;
  title: string;
  poster: string;
  rate: string;
  year: string;
}

export interface DoubanResult {
  code: number;
  message: string;
  list: DoubanItem[];
}

// 跳过片头片尾配置数据结构
export interface SkipConfig {
  enable: boolean; // 是否启用跳过片头片尾
  intro_time: number; // 片头时间（秒）
  outro_time: number; // 片尾时间（秒）
}

// tvbox列表内容数据结构
export interface TvboxContentItem {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_remarks: string;
}

// 豆瓣数据结构
export interface ShortDramaItem {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_tag: string;
  vod_remarks: string;
}

export interface Source {
  key: string;
  name: string;
}

export interface CategoryNode {
  id: number;
  name: string;
  parentId: number;
  children: CategoryNode[];
}
