import { ArrowLeft } from 'lucide-react';

export function BackButton() {
  return (
    <button
      onClick={() => window.history.back()}
      // 移除 hover:bg，改用 active:bg 以适应移动端触摸反馈
      // 使用 select-none 防止长按弹出系统菜单
      className='w-10 h-10 flex items-center justify-center rounded-full text-gray-600 active:bg-gray-200/60 dark:text-gray-300 dark:active:bg-gray-700/60 transition-all duration-200 select-none group'
      aria-label='Back'
    >
      <ArrowLeft
        // strokeWidth 从默认的 2 改为 2.5，增加移动端易读性
        // 添加 group-active 下的位移效果
        size={24}
        strokeWidth={2.5}
        className='transform transition-transform group-active:-translate-x-1'
      />
    </button>
  );
}
