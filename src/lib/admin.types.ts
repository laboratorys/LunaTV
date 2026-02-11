export interface AdminConfig {
  ConfigSubscribtion: {
    URL: string;
    AutoUpdate: boolean;
    LastCheck: string;
  };
  ConfigFile: string;
  SiteConfig: {
    SiteName: string;
    Announcement: string;
    SearchDownstreamMaxPage: number;
    SiteInterfaceCacheTime: number;
    DoubanProxyType: string;
    DoubanProxy: string;
    DoubanImageProxyType: string;
    DoubanImageProxy: string;
    DisableYellowFilter: boolean;
    FluidSearch: boolean;
    OpenRegister: boolean;
  };
  UserConfig: {
    Users: {
      username: string;
      key: string;
      role: 'user' | 'admin' | 'owner';
      banned?: boolean;
      enabledApis?: string[]; // 优先级高于tags限制
      tags?: string[]; // 多 tags 取并集限制
    }[];
    Tags?: {
      name: string;
      enabledApis: string[];
    }[];
  };
  SourceConfig: {
    key: string;
    name: string;
    api: string;
    detail?: string;
    from: 'config' | 'custom';
    disabled?: boolean;
  }[];
  CustomCategories: {
    name?: string;
    type: 'movie' | 'tv';
    query: string;
    from: 'config' | 'custom';
    disabled?: boolean;
  }[];
  LiveConfig?: {
    key: string;
    name: string;
    url: string; // m3u 地址
    ua?: string;
    epg?: string; // 节目单
    from: 'config' | 'custom';
    channelNumber?: number;
    disabled?: boolean;
  }[];
  TvBoxConfig?: {
    disabled: boolean;
    sync: boolean;
    proxyFilterAds: boolean;
    expireSeconds: number;
  };
  FeaturesConfig?: {
    douban: boolean;
    shortDrama: boolean;
    source: boolean;
    live: boolean;
  };
}

export interface AdminConfigResult {
  Role: 'owner' | 'admin';
  Config: AdminConfig;
}

export interface SectionConfigProps {
  config: AdminConfig | null;
  role: 'owner' | 'admin' | null;
  refresh: () => Promise<void>;
  showError: (message: string, showAlert?: (config: any) => void) => void;
  showAlert: (config: any) => void;
  showSuccess: (message: string, showAlert?: (config: any) => void) => void;
}
