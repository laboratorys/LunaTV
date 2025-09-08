const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'LunaTV';
export const tvboxConfig = {
  spider: '/api/tvbox/jar',
  wallpaper: '/api/tvbox/wallpapers',
  logo: 'https://raw.githubusercontent.com/laboratorys/LunaTV/refs/heads/dev/public/favicon.ico',
  warningText: '',
  sites: [
    {
      key: 'csp_Zhuiju',
      name: `${siteName}`,
      type: 3,
      api: 'csp_Zhuiju',
      searchable: 1,
      quickSearch: 1,
      filterable: 1,
      ext: '/api/tvbox',
      timeout: 30,
    },
  ],
  lives: [],
  ijk: [
    {
      group: '软解码',
      options: [
        {
          category: 4,
          name: 'opensles',
          value: '0',
        },
        {
          category: 4,
          name: 'overlay-format',
          value: '842225234',
        },
        {
          category: 4,
          name: 'framedrop',
          value: '1',
        },
        {
          category: 4,
          name: 'soundtouch',
          value: '1',
        },
        {
          category: 4,
          name: 'start-on-prepared',
          value: '1',
        },
        {
          category: 1,
          name: 'http-detect-range-support',
          value: '0',
        },
        {
          category: 1,
          name: 'fflags',
          value: 'fastseek',
        },
        {
          category: 2,
          name: 'skip_loop_filter',
          value: '48',
        },
        {
          category: 4,
          name: 'reconnect',
          value: '1',
        },
        {
          category: 4,
          name: 'max-buffer-size',
          value: '5242880',
        },
        {
          category: 4,
          name: 'enable-accurate-seek',
          value: '0',
        },
        {
          category: 4,
          name: 'mediacodec',
          value: '0',
        },
        {
          category: 4,
          name: 'mediacodec-auto-rotate',
          value: '0',
        },
        {
          category: 4,
          name: 'mediacodec-handle-resolution-change',
          value: '0',
        },
        {
          category: 4,
          name: 'mediacodec-hevc',
          value: '0',
        },
      ],
    },
    {
      group: '硬解码',
      options: [
        {
          category: 4,
          name: 'opensles',
          value: '0',
        },
        {
          category: 4,
          name: 'overlay-format',
          value: '842225234',
        },
        {
          category: 4,
          name: 'framedrop',
          value: '1',
        },
        {
          category: 4,
          name: 'soundtouch',
          value: '1',
        },
        {
          category: 4,
          name: 'start-on-prepared',
          value: '1',
        },
        {
          category: 1,
          name: 'http-detect-range-support',
          value: '0',
        },
        {
          category: 1,
          name: 'fflags',
          value: 'fastseek',
        },
        {
          category: 2,
          name: 'skip_loop_filter',
          value: '48',
        },
        {
          category: 4,
          name: 'reconnect',
          value: '1',
        },
        {
          category: 4,
          name: 'max-buffer-size',
          value: '5242880',
        },
        {
          category: 4,
          name: 'enable-accurate-seek',
          value: '0',
        },
        {
          category: 4,
          name: 'mediacodec',
          value: '1',
        },
        {
          category: 4,
          name: 'mediacodec-auto-rotate',
          value: '1',
        },
        {
          category: 4,
          name: 'mediacodec-handle-resolution-change',
          value: '1',
        },
        {
          category: 4,
          name: 'mediacodec-hevc',
          value: '1',
        },
      ],
    },
  ],
  doh: [
    {
      name: 'Google',
      url: 'https://dns.google/dns-query',
      ips: ['8.8.4.4', '8.8.8.8'],
    },
    {
      name: 'Cloudflare',
      url: 'https://cloudflare-dns.com/dns-query',
      ips: [
        '1.1.1.1',
        '1.0.0.1',
        '2606:4700:4700::1111',
        '2606:4700:4700::1001',
      ],
    },
    {
      name: 'AdGuard',
      url: 'https://dns.adguard.com/dns-query',
      ips: ['94.140.14.140', '94.140.14.141'],
    },
    {
      name: 'DNSWatch',
      url: 'https://resolver2.dns.watch/dns-query',
      ips: ['84.200.69.80', '84.200.70.40'],
    },
    {
      name: 'Quad9',
      url: 'https://dns.quad9.net/dns-quer',
      ips: ['9.9.9.9', '149.112.112.112'],
    },
  ],
  rules: [],
};
