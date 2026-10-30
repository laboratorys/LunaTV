'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * 全屏时把内容挂到全屏元素内部。
 * 浏览器全屏只会渲染全屏元素子树，页面层的浮层（fixed 弹窗）会直接不可见。
 */
const FullscreenPortal = ({ children }: { children: ReactNode }) => {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const sync = () =>
      setTarget((document.fullscreenElement as HTMLElement) ?? null);
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  if (!target) return <>{children}</>;
  return createPortal(children, target);
};

export default FullscreenPortal;
