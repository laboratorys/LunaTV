/* eslint-disable @typescript-eslint/no-explicit-any,no-console */
import CryptoJS from 'crypto-js';
import he from 'he';
import Hls from 'hls.js';

import { Favorite, KeepItem, PlayRecord, TVBoxRecord } from '@/lib/types';
import { CURRENT_VERSION as CURRENT_VERSION_DEV } from '@/lib/version-dev';
import { CURRENT_VERSION as CURRENT_VERSION_MAIN } from '@/lib/version-main';

function getDoubanImageProxyConfig(): {
  proxyType:
    | 'direct'
    | 'server'
    | 'img3'
    | 'cmliussss-cdn-tencent'
    | 'cmliussss-cdn-ali'
    | 'custom';
  proxyUrl: string;
} {
  const doubanImageProxyType =
    localStorage.getItem('doubanImageProxyType') ||
    (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE ||
    'cmliussss-cdn-tencent';
  const doubanImageProxy =
    localStorage.getItem('doubanImageProxyUrl') ||
    (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY ||
    '';
  return {
    proxyType: doubanImageProxyType,
    proxyUrl: doubanImageProxy,
  };
}

/**
 * 处理图片 URL，如果设置了图片代理则使用代理
 */
export function processImageUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  // 仅处理豆瓣图片代理
  if (!originalUrl.includes('doubanio.com')) {
    return originalUrl;
  }

  const { proxyType, proxyUrl } = getDoubanImageProxyConfig();
  switch (proxyType) {
    case 'server':
      return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
    case 'img3':
      return originalUrl.replace(/img\d+\.doubanio\.com/g, 'img3.doubanio.com');
    case 'cmliussss-cdn-tencent':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.net'
      );
    case 'cmliussss-cdn-ali':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.com'
      );
    case 'custom':
      return `${proxyUrl}${encodeURIComponent(originalUrl)}`;
    case 'direct':
    default:
      return originalUrl;
  }
}

/**
 * 从m3u8地址获取视频质量等级和网络信息
 * @param m3u8Url m3u8播放列表的URL
 * @returns Promise<{quality: string, loadSpeed: string, pingTime: number}> 视频质量等级和网络信息
 */
export async function getVideoResolutionFromM3u8(m3u8Url: string): Promise<{
  quality: string; // 如720p、1080p等
  loadSpeed: string; // 自动转换为KB/s或MB/s
  pingTime: number; // 网络延迟（毫秒）
}> {
  try {
    // 直接使用m3u8 URL作为视频源，避免CORS问题
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.preload = 'metadata';

      // 测量网络延迟（ping时间） - 使用m3u8 URL而不是ts文件
      const pingStart = performance.now();
      let pingTime = 0;

      // 测量ping时间（使用m3u8 URL）
      fetch(m3u8Url, { method: 'HEAD', mode: 'no-cors' })
        .then(() => {
          pingTime = performance.now() - pingStart;
        })
        .catch(() => {
          pingTime = performance.now() - pingStart; // 记录到失败为止的时间
        });

      // 固定使用hls.js加载
      const hls = new Hls();

      // 设置超时处理
      const timeout = setTimeout(() => {
        hls.destroy();
        video.remove();
        reject(new Error('Timeout loading video metadata'));
      }, 4000);

      video.onerror = () => {
        clearTimeout(timeout);
        hls.destroy();
        video.remove();
        reject(new Error('Failed to load video metadata'));
      };

      let actualLoadSpeed = '未知';
      let hasSpeedCalculated = false;
      let hasMetadataLoaded = false;

      let fragmentStartTime = 0;

      // 检查是否可以返回结果
      const checkAndResolve = () => {
        if (
          hasMetadataLoaded &&
          (hasSpeedCalculated || actualLoadSpeed !== '未知')
        ) {
          clearTimeout(timeout);
          const width = video.videoWidth;
          if (width && width > 0) {
            hls.destroy();
            video.remove();

            // 根据视频宽度判断视频质量等级，使用经典分辨率的宽度作为分割点
            const quality =
              width >= 3840
                ? '4K' // 4K: 3840x2160
                : width >= 2560
                ? '2K' // 2K: 2560x1440
                : width >= 1920
                ? '1080p' // 1080p: 1920x1080
                : width >= 1280
                ? '720p' // 720p: 1280x720
                : width >= 854
                ? '480p'
                : 'SD'; // 480p: 854x480

            resolve({
              quality,
              loadSpeed: actualLoadSpeed,
              pingTime: Math.round(pingTime),
            });
          } else {
            // webkit 无法获取尺寸，直接返回
            resolve({
              quality: '未知',
              loadSpeed: actualLoadSpeed,
              pingTime: Math.round(pingTime),
            });
          }
        }
      };

      // 监听片段加载开始
      hls.on(Hls.Events.FRAG_LOADING, () => {
        fragmentStartTime = performance.now();
      });

      // 监听片段加载完成，只需首个分片即可计算速度
      hls.on(Hls.Events.FRAG_LOADED, (event: any, data: any) => {
        if (
          fragmentStartTime > 0 &&
          data &&
          data.payload &&
          !hasSpeedCalculated
        ) {
          const loadTime = performance.now() - fragmentStartTime;
          const size = data.payload.byteLength || 0;

          if (loadTime > 0 && size > 0) {
            const speedKBps = size / 1024 / (loadTime / 1000);

            // 立即计算速度，无需等待更多分片
            const avgSpeedKBps = speedKBps;

            if (avgSpeedKBps >= 1024) {
              actualLoadSpeed = `${(avgSpeedKBps / 1024).toFixed(1)} MB/s`;
            } else {
              actualLoadSpeed = `${avgSpeedKBps.toFixed(1)} KB/s`;
            }
            hasSpeedCalculated = true;
            checkAndResolve(); // 尝试返回结果
          }
        }
      });

      hls.loadSource(m3u8Url);
      hls.attachMedia(video);

      // 监听hls.js错误
      hls.on(Hls.Events.ERROR, (event: any, data: any) => {
        console.error('HLS错误:', data);
        if (data.fatal) {
          clearTimeout(timeout);
          hls.destroy();
          video.remove();
          reject(new Error(`HLS播放失败: ${data.type}`));
        }
      });

      // 监听视频元数据加载完成
      video.onloadedmetadata = () => {
        hasMetadataLoaded = true;
        checkAndResolve(); // 尝试返回结果
      };
    });
  } catch (error) {
    throw new Error(
      `Error getting video resolution: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function cleanHtmlTags(text: string): string {
  if (!text) return '';

  const cleanedText = text
    .replace(/<[^>]+>/g, '\n') // 将 HTML 标签替换为换行
    .replace(/\n+/g, '\n') // 将多个连续换行合并为一个
    .replace(/[ \t]+/g, ' ') // 将多个连续空格和制表符合并为一个空格，但保留换行符
    .replace(/^\n+|\n+$/g, '') // 去掉首尾换行
    .trim(); // 去掉首尾空格

  // 使用 he 库解码 HTML 实体
  return he.decode(cleanedText);
}

export const CURRENT_VERSION =
  (process.env.GIT_BRANCH || 'main') === 'dev'
    ? CURRENT_VERSION_DEV
    : CURRENT_VERSION_MAIN;

export const generateShortKey = (username: string) => {
  const timestamp = Date.now().toString();
  const hash = CryptoJS.SHA256(username + timestamp);
  const hashHex = hash.toString(CryptoJS.enc.Hex);
  const substring = hashHex.substring(0, 8);
  const decimal = parseInt(substring, 16);
  const chars =
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let key = '';
  let num = decimal;
  if (num === 0) return chars[0];
  while (num > 0) {
    key = chars[num % 62] + key;
    num = Math.floor(num / 62);
  }
  return key;
};

/**
 * 从 TVBox 原始数据创建一个完整的 PlayRecord
 */
export function createPlayRecordFromTVBox(tvbox: TVBoxRecord): PlayRecord {
  const toSeconds = (ms: number) => (ms > 0 ? Math.floor(ms / 1000) : 0);
  return {
    title: tvbox.vodName,
    source_name: tvbox.vodFlag,
    cover: tvbox.vodPic,
    year: parseYearFromTVBoxKey(tvbox.key),
    index: 0,
    total_episodes: 0,
    play_time: toSeconds(tvbox.position),
    total_time: toSeconds(tvbox.duration),
    save_time: tvbox.createTime,
    search_title: '',
    episode_title: tvbox.vodRemarks,
    episode_url: tvbox.episodeUrl,
    tvbox_record: tvbox,
  };
}

/**
 * 处理WEB播放记录
 */
export const handleWebPlayRecord = (record: PlayRecord): PlayRecord => {
  const now = Date.now();
  const updatedRecord: PlayRecord = {
    ...record,
    save_time: now,
  };
  if (!updatedRecord.tvbox_record) {
    // 此记录是在 Web 端新创建的，需要初始化 TVBox 结构
    updatedRecord.tvbox_record = createDefaultTVBoxRecord(updatedRecord);
  } else {
    // 已有记录，同步关键进度和时间戳
    const tb = updatedRecord.tvbox_record;
    tb.createTime = now;
    tb.position = updatedRecord.play_time * 1000;
    tb.duration = updatedRecord.total_time * 1000;
    tb.vodName = updatedRecord.title;
    tb.vodPic = updatedRecord.cover;
    tb.vodRemarks = updatedRecord.episode_title;
    tb.vodFlag = updatedRecord.source_name;
    tb.episodeUrl = updatedRecord.episode_url;
    updatedRecord.tvbox_record = tb;
  }
  return updatedRecord;
};

/**
 * 处理WEB播放记录
 */
export const handleTVBoxPlayRecord = (record: PlayRecord): PlayRecord => {
  const now = Date.now();
  const updatedRecord: PlayRecord = {
    ...record,
    save_time: now,
  };
  if (!updatedRecord.tvbox_record) {
    // 此记录是在 Web 端新创建的，需要初始化 TVBox 结构
    updatedRecord.tvbox_record = createDefaultTVBoxRecord(updatedRecord);
  } else {
    // 已有记录，同步关键进度和时间戳
    const tb = updatedRecord.tvbox_record;
    tb.createTime = now;
    tb.position = updatedRecord.play_time * 1000;
    tb.duration = updatedRecord.total_time * 1000;
    tb.vodName = updatedRecord.title;
    tb.vodPic = updatedRecord.cover;
    tb.vodRemarks = updatedRecord.episode_title;
    tb.vodFlag = updatedRecord.source_name;
    tb.episodeUrl = updatedRecord.episode_url;
    updatedRecord.tvbox_record = tb;
  }
  return updatedRecord;
};

/**
 * 1. 内部私有方法：根据 Web 数据构建 TVBoxRecord
 * 包含对 TVBox 特殊占位符和毫秒单位的处理
 */
const createDefaultTVBoxRecord = (record: PlayRecord): TVBoxRecord => {
  const ms = (s: number) => Math.floor(s * 1000);
  const PLACEHOLDER = getPlaceholder();
  return {
    cid: 1, //tvbox中配置的标识
    createTime: record.save_time || Date.now(),
    duration: ms(record.total_time),
    position: ms(record.play_time),
    vodName: record.title,
    vodPic: record.cover,
    vodFlag: record.source_name,
    vodRemarks: `${record.index}/${record.total_episodes}`,
    key: `csp_Zhuiju@@@${encodeURIComponent(record.title)}&year=${
      record.year
    }@@@1`,
    episodeUrl: '',
    opening: PLACEHOLDER,
    ending: PLACEHOLDER,
    revPlay: false,
    revSort: false,
    scale: 0,
    speed: 1.0,
  };
};

const getPlaceholder = (): number => {
  return Number('-9223372036854775808');
};

/**
 * key 字符串中解析年份
 */
export function parseYearFromTVBoxKey(key: string): string {
  if (!key || !key.includes('@@@')) return '';
  try {
    const parts = key.split('@@@');
    const paramsSegment = parts[1];
    if (!paramsSegment) return '';
    const decodedParams = decodeURIComponent(paramsSegment);
    const match = decodedParams.match(/[?&]year=(\d{4})/);
    const simpleMatch = match || decodedParams.match(/year=(\d{4})/);
    return simpleMatch ? simpleMatch[1] : '';
  } catch (error) {
    console.error('Failed to parse year from TVBox key:', error);
    return '';
  }
}

export interface LifeTreeData {
  name: string;
  year: string | null;
  douban_id: string | null;
  short_drama: string | null;
}

export const parseTVBoxId = (input: string): LifeTreeData => {
  const params = new URLSearchParams(`name=${input}`);

  return {
    name: params.get('name') || '',
    year: params.get('year'),
    douban_id: params.get('douban_id'),
    short_drama: params.get('short_drama'),
  };
};

export function createFavRecordFromTVBox(tvbox: KeepItem): Favorite {
  return {
    source_name: tvbox.ext_param,
    total_episodes: 0, // 总集数
    title: tvbox.vodName,
    year: parseYearFromTVBoxKey(tvbox.key),
    cover: tvbox.vodPic,
    save_time: tvbox.createTime, // 记录保存时间（时间戳）
    search_title: '', // 搜索时使用的标题
    origin: tvbox.type == 0 ? 'vod' : 'live',
    tvbox_record: tvbox, //TVBox记录
  };
}
export function handleTVBoxFromFavRecord(
  record: Favorite,
  siteName: string
): Favorite {
  return {
    ...record,
    tvbox_record: {
      cid: 1,
      createTime: record.save_time,
      key: `csp_Zhuiju@@@${encodeURIComponent(record.title)}&year=${
        record.year
      }@@@1`,
      siteName: siteName,
      type: record.origin === 'live' ? 1 : 0,
      vodName: record.title,
      vodPic: record.cover,
      ext_param: record.source_name,
    },
  };
}
