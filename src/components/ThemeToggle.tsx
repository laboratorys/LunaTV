/* eslint-disable @typescript-eslint/no-explicit-any,react-hooks/exhaustive-deps */
'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

interface ThemeToggleProps {
  size?: number; // 允许从父组件传入图标大小
}

export function ThemeToggle({ size = 20 }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme, theme } = useTheme();
  const pathname = usePathname();

  const setThemeColor = (t?: string) => {
    if (typeof window === 'undefined') return;
    const meta = document.querySelector('meta[name="theme-color"]');
    // 如果是 system 模式，需要根据媒体查询判断实际颜色
    const actualTheme =
      t === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : t;

    const color = actualTheme === 'dark' ? '#0c111c' : '#f9fbfe';

    if (!meta) {
      const newMeta = document.createElement('meta');
      newMeta.name = 'theme-color';
      newMeta.content = color;
      document.head.appendChild(newMeta);
    } else {
      meta.setAttribute('content', color);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      setThemeColor(theme);
    }
  }, [mounted, theme, resolvedTheme, pathname]);

  if (!mounted) {
    return <div style={{ width: size + 16, height: size + 16 }} />;
  }

  const toggleTheme = () => {
    // 轮转逻辑：dark -> light -> system -> dark
    let nextTheme = 'dark';
    if (theme === 'dark') {
      nextTheme = 'light';
    } else if (theme === 'light') {
      nextTheme = 'system';
    } else {
      nextTheme = 'dark';
    }

    // 更新 Meta Theme Color
    setThemeColor(nextTheme);

    // 视图过渡动画
    if (!(document as any).startViewTransition) {
      setTheme(nextTheme);
      return;
    }

    (document as any).startViewTransition(() => {
      setTheme(nextTheme);
    });
  };

  return (
    <button
      onClick={toggleTheme}
      style={{ width: size + 16, height: size + 16 }}
      className='rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors'
      aria-label='Toggle theme'
    >
      {theme === 'system' ? (
        <Monitor style={{ width: size, height: size }} />
      ) : theme === 'dark' ? (
        <Sun style={{ width: size, height: size }} />
      ) : (
        <Moon style={{ width: size, height: size }} />
      )}
    </button>
  );
}
