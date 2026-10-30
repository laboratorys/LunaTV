import { BackButton } from './BackButton';
import MobileBottomNav from './MobileBottomNav';
import MobileHeader from './MobileHeader';
import Sidebar from './Sidebar';
import { UserMenu } from './UserMenu';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
  title?: string;
}

const PageLayout = ({ children, activePath = '/', title }: PageLayoutProps) => {
  const isDetailView = ['/play', '/live'].includes(activePath);
  return (
    <div className='w-full min-h-screen'>
      {/* 移动端头部 */}
      <MobileHeader
        showBackButton={isDetailView}
        title={isDetailView ? title : undefined}
      />

      {/* 主要布局容器 */}
      <div className='flex md:grid md:grid-cols-[auto_1fr] w-full min-h-screen md:min-h-0'>
        {/* 侧边栏 - 桌面端显示，移动端隐藏 */}
        <div className='hidden md:block'>
          <Sidebar activePath={activePath} />
        </div>

        {/* 主内容区域 */}
        <div className='relative min-w-0 flex-1 transition-all duration-300'>
          {/* 桌面端左上角返回按钮 */}
          {['/play', '/live'].includes(activePath) && (
            <div className='absolute top-3 left-1 z-20 hidden md:flex'>
              <BackButton />
            </div>
          )}

          {/* 桌面端顶部按钮 */}
          <div className='absolute top-2 right-4 z-20 hidden md:flex items-center gap-2'>
            <UserMenu />
          </div>

          {/* 主内容：用 padding 而非 margin 留出头部/底部导航空间，
              避免 margin 撑出 min-h-screen 产生多余的滚动条 */}
          <main className='flex-1 md:min-h-0 pt-14 pb-[calc(4rem_+_env(safe-area-inset-bottom))] md:pt-0 md:pb-0'>
            {children}
          </main>
        </div>
      </div>

      {/* 移动端底部导航 */}
      <div className='md:hidden'>
        <MobileBottomNav activePath={activePath} />
      </div>
    </div>
  );
};

export default PageLayout;
