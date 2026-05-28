# LabTV

<div align="center">
  <img src="public/logo.png" alt="LunaTV Logo" width="120">
</div>

> 🎬 **LabTV** 是一个开箱即用的、跨平台的影视聚合播放器。它基于 **Next.js 16** + **Tailwind&nbsp;CSS 4.x** + **TypeScript 6.x** 构建，支持多资源搜索、在线播放、收藏同步、播放记录、云端存储，让你可以随时随地畅享海量免费影视内容。

<div align="center">

![GitHub Release](https://img.shields.io/github/v/release/laboratorys/LunaTV)
![Next.js](https://img.shields.io/badge/Next.js-16.2.0-000?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19.2.6-61dafb?logo=react)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38bdf8?logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-green)
![Docker Ready](https://img.shields.io/badge/Docker-ready-blue?logo=docker)

</div>

---

## 🎩 魔改版

### 📢 声明

1. 本项目仅作简单维护，主要修复 BUG，对于新功能会特别慎重，主要增加对 tvbox 的支持。
2. 你可以[反馈](https://github.com/laboratorys/LunaTV/issues)，但是我不一定（能）解决，主打一个随性。
3. 尽量保证原汁原味，感谢原作者的付出，站在巨人的肩膀上！

### 🚀 新特性概览

- [x] 开放注册
- [x] 无痕浏览
- [x] TVBOX 支持
- [x] 支持 sqlite 存储
- [x] 短剧分类
- [x] 视频源浏览
- [ ] 边下边播

### 🌿 版本分支

- v100 分支：原项目 v100 版本的最终代码，不会再做任何修改，仅做同步
- main 分支：稳定版
- dev 分支：开发版
- 魔改版的初始版本是:5.0.0

### 🐳 Docker 镜像

1. latest 最新版本：`ghcr.io/laboratorys/lunatv:latest`
2. 对应 release 版本的 TAG：`ghcr.io/laboratorys/lunatv:v5.0.0`
3. dev 开发版本，该版本未正式发布可能存在不稳定因素，谨慎食用：`ghcr.io/laboratorys/lunatv:dev`
4. 如果 tag 不连续，那么中间的开发版本是做过渡使用
5. 同步更新 docker.io：[iicm/lunatv](https://hub.docker.com/r/iicm/lunatv/tags)

## ✨ 功能特性

- 🔍 **多源聚合搜索**：一次搜索立刻返回全源结果。
- 📄 **丰富详情页**：支持剧集列表、演员、年份、简介等完整信息展示。
- ▶️ **流畅在线播放**：集成 HLS.js & ArtPlayer。
- ❤️ **收藏 + 继续观看**：支持 Sqlite3/Kvrocks/Redis/Upstash 存储，多端同步进度。
- 📱 **PWA**：离线缓存、安装到桌面/主屏，移动端原生体验。
- 🌗 **响应式布局**：桌面侧边栏 + 移动底部导航，自适应各种屏幕尺寸。
- 👿 **智能去广告**：自动跳过视频中的切片广告（实验性）。

### 注意：部署后项目为空壳项目，无内置播放源，需要自行搜寻

<details>
  <summary>点击查看项目截图</summary>
  <img src="public/screenshot1.png" alt="项目截图" style="max-width:600px">
  <img src="public/screenshot2.png" alt="项目截图" style="max-width:600px">
  <img src="public/screenshot3.png" alt="项目截图" style="max-width:600px">
</details>

## 🗺 目录

- [技术栈](#技术栈)
- [部署](#部署)
  - [一键部署](#zeabur-一键部署)
  - [Docker 部署](#Kvrocks-存储推荐)
- [配置文件](#配置文件)
- [订阅](#订阅)
- [自动更新](#自动更新)
- [环境变量](#环境变量)
- [客户端](#客户端)
- [AndroidTV 使用](#AndroidTV-使用)
- [Roadmap](#roadmap)
- [安全与隐私提醒](#安全与隐私提醒)
- [License](#license)
- [致谢](#致谢)

## 技术栈

| 分类      | 主要依赖                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------- |
| 前端框架  | [Next.js 16](https://nextjs.org/) · App Router                                                        |
| UI & 样式 | [Tailwind&nbsp;CSS 4](https://tailwindcss.com/)                                                       |
| 语言      | TypeScript 6                                                                                          |
| 播放器    | [ArtPlayer](https://github.com/zhw2590582/ArtPlayer) · [HLS.js](https://github.com/video-dev/hls.js/) |
| 代码质量  | ESLint · Prettier · Jest                                                                              |
| 部署      | Docker                                                                                                |

## 部署

本项目**仅支持 Docker 或其他基于 Docker 的平台** 部署。

### sqlite 存储（方式 1-手动创建目录）

**由于容器中以非 root 账户运行，需要在宿主机创建目录并设置权限**

```
sudo mkdir -p /opt/lunatv/data
sudo chown -R 1001:1001 /opt/lunatv/data
```

```yml
services:
  lunatv-core:
    image: ghcr.io/laboratorys/lunatv:latest
    container_name: lunatv-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=sqlite
    volumes:
      - /opt/lunatv/data:/app/data
```

### sqlite 存储（方式 2-命名卷自动管理）

```yml
services:
  lunatv-core:
    image: ghcr.io/laboratorys/lunatv:latest
    container_name: lunatv-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=sqlite
    volumes:
      - lunatv-data:/app/data
volumes:
  lunatv-data:
```

### Kvrocks 存储

```yml
services:
  lunatv-core:
    image: ghcr.io/laboratorys/lunatv:latest
    container_name: lunatv-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=kvrocks
      - KVROCKS_URL=redis://lunatv-kvrocks:6666
    networks:
      - lunatv-network
    depends_on:
      - lunatv-kvrocks
  lunatv-kvrocks:
    image: apache/kvrocks
    container_name: lunatv-kvrocks
    restart: unless-stopped
    volumes:
      - kvrocks-data:/var/lib/kvrocks
    networks:
      - lunatv-network
networks:
  lunatv-network:
    driver: bridge
volumes:
  kvrocks-data:
    driver: local
    driver_opts:
      type: none
      device: kvrocks-data
      o: bind
```

### Redis 存储（有一定的丢数据风险）

```yml
services:
  lunatv-core:
    image: ghcr.io/laboratorys/lunatv:latest
    container_name: lunatv-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=redis
      - REDIS_URL=redis://lunatv-redis:6379
    networks:
      - lunatv-network
    depends_on:
      - lunatv-redis
  lunatv-redis:
    image: redis:alpine
    container_name: lunatv-redis
    restart: unless-stopped
    networks:
      - lunatv-network
    # 请开启持久化，否则升级/重启后数据丢失
    volumes:
      - ./data:/data
networks:
  lunatv-network:
    driver: bridge
```

### Upstash 存储

1. 在 [upstash](https://upstash.com/) 注册账号并新建一个 Redis 实例，名称任意。
2. 复制新数据库的 **HTTPS ENDPOINT 和 TOKEN**
3. 使用如下 docker compose

```yml
services:
  lunatv-core:
    image: ghcr.io/laboratorys/lunatv:latest
    container_name: lunatv-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=upstash
      - UPSTASH_URL=上面 https 开头的 HTTPS ENDPOINT
      - UPSTASH_TOKEN=上面的 TOKEN
```

## 配置文件

完成部署后为空壳应用，无播放源，需要站长在管理后台的配置文件设置订阅地址

配置文件示例如下：

```json
{
  "cache_time": 7200,
  "api_site": {
    "dyttzy": {
      "api": "http://xxx.com/api.php/provide/vod",
      "name": "示例资源",
      "detail": "http://xxx.com"
    }
    // ...更多站点
  },
  "custom_category": [
    {
      "name": "华语",
      "type": "movie",
      "query": "华语"
    }
  ],
  "ad_rules": ""
}
```

- `cache_time`：接口缓存时间（秒）。
- `api_site`：你可以增删或替换任何资源站，字段说明：
  - `key`：唯一标识，保持小写字母/数字。
  - `api`：资源站提供的 `vod` JSON API 根地址。
  - `name`：在人机界面中展示的名称。
  - `detail`：（可选）部分无法通过 API 获取剧集详情的站点，需要提供网页详情根 URL，用于爬取。
- `custom_category`：自定义分类配置，用于在导航中添加个性化的影视分类。以 type + query 作为唯一标识。支持以下字段：
  - `name`：分类显示名称（可选，如不提供则使用 query 作为显示名）
  - `type`：分类类型，支持 `movie`（电影）或 `tv`（电视剧）
  - `query`：搜索关键词，用于在豆瓣 API 中搜索相关内容
- `live`: （可选）直播
- `ad_rules`: （可选）广告规则订阅地址

custom_category 支持的自定义分类已知如下：

- movie：热门、最新、经典、豆瓣高分、冷门佳片、华语、欧美、韩国、日本、动作、喜剧、爱情、科幻、悬疑、恐怖、治愈
- tv：热门、美剧、英剧、韩剧、日剧、国产剧、港剧、日本动画、综艺、纪录片

也可输入如 "哈利波特" 效果等同于豆瓣搜索

LabTV 支持标准的苹果 CMS V10 API 格式。

## 订阅

将完整的配置文件 base58 编码后提供 http 服务即为订阅链接，可在 LabV 后台/Helios 中使用。

## 自动更新

可借助 [watchtower](https://github.com/containrrr/watchtower) 自动更新镜像容器

dockge/komodo 等 docker compose UI 也有自动更新功能

## 环境变量

| 变量                                | 说明                     | 可选值                         | 默认值                                                                                                                     |
| ----------------------------------- | ------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| USERNAME                            | 站长账号                 | 任意字符串                     | 无默认，必填字段                                                                                                           |
| PASSWORD                            | 站长密码                 | 任意字符串                     | 无默认，必填字段                                                                                                           |
| SITE_BASE                           | 站点 url                 | 形如 https://example.com       | 空                                                                                                                         |
| NEXT_PUBLIC_SITE_NAME               | 站点名称                 | 任意字符串                     | LabTV                                                                                                                      |
| ANNOUNCEMENT                        | 站点公告                 | 任意字符串                     | 本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。 |
| NEXT_PUBLIC_STORAGE_TYPE            | 播放记录/收藏的存储方式  | sqlte、redis、kvrocks、upstash | 无默认，必填字段                                                                                                           |
| KVROCKS_URL                         | kvrocks 连接 url         | 连接 url                       | 空                                                                                                                         |
| REDIS_URL                           | redis 连接 url           | 连接 url                       | 空                                                                                                                         |
| UPSTASH_URL                         | upstash redis 连接 url   | 连接 url                       | 空                                                                                                                         |
| UPSTASH_TOKEN                       | upstash redis 连接 token | 连接 token                     | 空                                                                                                                         |
| NEXT_PUBLIC_SEARCH_MAX_PAGE         | 搜索接口可拉取的最大页数 | 1-50                           | 5                                                                                                                          |
| NEXT_PUBLIC_DOUBAN_PROXY_TYPE       | 豆瓣数据源请求方式       | 见下方                         | direct                                                                                                                     |
| NEXT_PUBLIC_DOUBAN_PROXY            | 自定义豆瓣数据代理 URL   | url prefix                     | (空)                                                                                                                       |
| NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE | 豆瓣图片代理类型         | 见下方                         | direct                                                                                                                     |
| NEXT_PUBLIC_DOUBAN_IMAGE_PROXY      | 自定义豆瓣图片代理 URL   | url prefix                     | (空)                                                                                                                       |
| NEXT_PUBLIC_DISABLE_YELLOW_FILTER   | 关闭色情内容过滤         | true/false                     | false                                                                                                                      |
| NEXT_PUBLIC_FLUID_SEARCH            | 是否开启搜索接口流式输出 | true/ false                    | true                                                                                                                       |

NEXT_PUBLIC_DOUBAN_PROXY_TYPE 选项解释：

- direct: 由服务器直接请求豆瓣源站
- cors-proxy-zwei: 浏览器向 cors proxy 请求豆瓣数据，该 cors proxy 由 [Zwei](https://github.com/bestzwei) 搭建
- cmliussss-cdn-tencent: 浏览器向豆瓣 CDN 请求数据，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由腾讯云 cdn 提供加速
- cmliussss-cdn-ali: 浏览器向豆瓣 CDN 请求数据，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由阿里云 cdn 提供加速
- custom: 用户自定义 proxy，由 NEXT_PUBLIC_DOUBAN_PROXY 定义

NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE 选项解释：

- server：由服务器代理请求豆瓣分配的默认图片域名
- cmliussss-cdn-tencent：由浏览器请求豆瓣 CDN，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由腾讯云 cdn 提供加速
- cmliussss-cdn-ali：由浏览器请求豆瓣 CDN，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由阿里云 cdn 提供加速
- custom: 用户自定义 proxy，由 NEXT_PUBLIC_DOUBAN_IMAGE_PROXY 定义

## 移动端

- [Selene](https://github.com/MoonTechLab/Selene) （含桌面端）
- [TVBOX](https://github.com/laboratorys/TV-Release)

## AndroidTV

- [Selene](https://github.com/MoonTechLab/Selene-TV)
- [TVBOX](https://github.com/laboratorys/TV-Release)
- [OrionTV](https://github.com/zimplexing/OrionTV)

## 安全与隐私提醒

### 请设置密码保护并关闭公网注册

为了您的安全和避免潜在的法律风险，我们要求在部署时**强烈建议关闭公网注册**：

### 部署要求

1. **设置环境变量 `PASSWORD`**：为您的实例设置一个强密码
2. **仅供个人使用**：请勿将您的实例链接公开分享或传播
3. **遵守当地法律**：请确保您的使用行为符合当地法律法规

### 重要声明

- 本项目仅供学习和个人使用
- 请勿将部署的实例用于商业用途或公开服务
- 如因公开分享导致的任何法律问题，用户需自行承担责任
- 项目开发者不对用户的使用行为承担任何法律责任
- 本项目不在中国大陆地区提供服务。如有该项目在向中国大陆地区提供服务，属个人行为。在该地区使用所产生的法律风险及责任，属于用户个人行为，与本项目无关，须自行承担全部责任。特此声明

## License

[MIT](LICENSE) © 2026 LunaTV & Contributors

## 致谢

- [ts-nextjs-tailwind-starter](https://github.com/theodorusclarence/ts-nextjs-tailwind-starter) — 项目最初基于该脚手架。
- [LibreTV](https://github.com/LibreSpark/LibreTV) — 由此启发，站在巨人的肩膀上。
- [ArtPlayer](https://github.com/zhw2590582/ArtPlayer) — 提供强大的网页视频播放器。
- [HLS.js](https://github.com/video-dev/hls.js) — 实现 HLS 流媒体在浏览器中的播放支持。
- [Zwei](https://github.com/bestzwei) — 提供获取豆瓣数据的 cors proxy
- [CMLiussss](https://github.com/cmliu) — 提供豆瓣 CDN 服务
- 感谢所有提供免费影视接口的站点。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=laboratorys/LunaTV&type=Date)](https://www.star-history.com/#laboratorys/LunaTV&Date)
