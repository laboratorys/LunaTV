/* eslint-disable react-hooks/exhaustive-deps */
import React, { useLayoutEffect, useRef, useState } from 'react';

interface CapsuleSwitchProps {
  options: { label: string; value: string }[];
  active: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * 优化版胶囊切换组件
 * 1. 自动适配内容宽度，防止长文字换行
 * 2. 移除移动端点击高亮，提升触感
 * 3. 响应式监听，确保在窗口缩放或横屏时位置依然精准
 */
const CapsuleSwitch: React.FC<CapsuleSwitchProps> = ({
  options,
  active,
  onChange,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({
    left: 0,
    width: 0,
    opacity: 0, // 初始隐藏，防止计算时的闪烁
  });

  const activeIndex = options.findIndex((opt) => opt.value === active);

  // 更新滑块位置的核心逻辑
  const updateIndicatorPosition = () => {
    const activeButton = buttonRefs.current[activeIndex];
    const container = containerRef.current;

    if (activeButton && container) {
      // 使用 offsetLeft 是相对于父容器的偏移，比 getBoundingClientRect 更稳定
      setIndicatorStyle({
        left: activeButton.offsetLeft,
        width: activeButton.offsetWidth,
        opacity: 1,
      });
    }
  };

  // 使用 useLayoutEffect 在 DOM 更新后、浏览器绘制前同步计算位置
  useLayoutEffect(() => {
    updateIndicatorPosition();

    // 监听容器大小变化（涵盖窗口缩放、动态内容加载等场景）
    const resizeObserver = new ResizeObserver(() => {
      updateIndicatorPosition();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [activeIndex]);

  return (
    <div
      ref={containerRef}
      className={`
        relative inline-flex items-center 
        bg-gray-200/80 dark:bg-gray-800 
        p-1 rounded-full select-none
        ${className || ''}
      `}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* 动画指示器：白色滑块 */}
      <div
        className='absolute top-1 bottom-1 bg-white dark:bg-gray-600 rounded-full shadow-sm transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]'
        style={{
          left: `${indicatorStyle.left}px`,
          width: `${indicatorStyle.width}px`,
          opacity: indicatorStyle.opacity,
        }}
      />

      {options.map((opt, index) => {
        const isActive = active === opt.value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            onClick={() => {
              onChange(opt.value);
              // 根据之前的约定，如果这里用于切换主题，
              // 可以在父组件的 onChange 中执行保存到 localStorage 的逻辑。
            }}
            className={`
              relative z-10 
              px-4 py-1.5 
              text-xs sm:text-sm font-medium 
              whitespace-nowrap transition-colors duration-200
              ${
                isActive
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }
            `}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default CapsuleSwitch;
