/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { CURRENT_VERSION } from '@/lib/utils';
import { checkForUpdates, UpdateStatus } from '@/lib/version_check';

import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

// VersionDisplay 组件保持不变...
function VersionDisplay() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const { status } = await checkForUpdates();
        setUpdateStatus(status);
      } catch (_) {
        /* ignore */
      } finally {
        setIsChecking(false);
      }
    };
    checkUpdate();
  }, []);

  return (
    <button
      onClick={() =>
        window.open(
          `https://github.com/${process.env.GIT_USER}/${process.env.GIT_REPO}`,
          '_blank'
        )
      }
      className='absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 transition-colors cursor-pointer'
    >
      <span className='font-mono'>v{CURRENT_VERSION} </span>
      {!isChecking && updateStatus !== UpdateStatus.FETCH_FAILED && (
        <div
          className={`flex items-center gap-1.5 ${
            updateStatus === UpdateStatus.HAS_UPDATE
              ? 'text-yellow-600 dark:text-yellow-400'
              : updateStatus === UpdateStatus.NO_UPDATE
              ? 'text-green-600 dark:text-green-400'
              : ''
          }`}
        >
          {updateStatus === UpdateStatus.HAS_UPDATE && (
            <>
              <AlertCircle className='w-3.5 h-3.5' />
              <span className='font-semibold text-xs'>有新版本</span>
            </>
          )}
          {updateStatus === UpdateStatus.NO_UPDATE && (
            <>
              <CheckCircle className='w-3.5 h-3.5' />
              <span className='font-semibold text-xs'>已是最新</span>
            </>
          )}
        </div>
      )}
    </button>
  );
}

function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { siteName } = useSite();

  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // 新增：确认密码状态

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shouldAskUsername, setShouldAskUsername] = useState(false);
  const [shouldRegister, setShouldRegister] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storageType = (window as any).RUNTIME_CONFIG?.STORAGE_TYPE;
      setShouldAskUsername(storageType && storageType !== 'localstorage');
      const openRegister = (window as any).RUNTIME_CONFIG?.OPEN_REGISTER;
      setShouldRegister(storageType && openRegister === true);
    }
  }, [isRegister]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // 基础校验
    if (!password || (shouldAskUsername && !username)) return;

    // 注册模式下的额外校验
    if (isRegister && password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    try {
      setLoading(true);
      const endpoint = isRegister ? '/api/register' : '/api/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          ...(shouldAskUsername ? { username } : {}),
        }),
      });

      if (res.ok) {
        if (isRegister) {
          setIsRegister(false);
          setPassword('');
          setConfirmPassword('');
          setError('注册成功，请登录');
        } else {
          const redirect = searchParams.get('redirect') || '/';
          router.replace(redirect);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? (isRegister ? '注册失败' : '密码错误'));
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-slate-50 dark:bg-zinc-950'>
      <div className='absolute top-4 right-4'>
        <ThemeToggle size={24} />
      </div>

      <div className='relative z-10 w-full max-w-md rounded-3xl bg-gradient-to-b from-white/90 via-white/70 to-white/40 dark:from-zinc-900/90 dark:via-zinc-900/70 dark:to-zinc-900/40 backdrop-blur-xl shadow-2xl p-10 dark:border dark:border-zinc-800 transition-all duration-300'>
        <div className='flex flex-col items-center justify-center mb-8'>
          <div className='flex items-center mb-2'>
            <Image
              src='/logo.png'
              alt='Logo'
              width={32}
              height={32}
              className='mr-2'
            />
            <h1 className='text-green-600 tracking-tight text-3xl font-extrabold bg-clip-text'>
              {siteName}
            </h1>
          </div>
          <p className='text-gray-500 text-sm dark:text-gray-400'>
            {isRegister ? '创建您的账户' : '欢迎回来'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-5'>
          {/* 用户名 */}
          {shouldAskUsername && (
            <div className='animate-in fade-in slide-in-from-top-2 duration-300'>
              <div className='relative'>
                <div className='absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10'>
                  <User className='w-5 h-5 text-gray-400 dark:text-gray-300' />
                </div>
                <input
                  type='text'
                  autoComplete='username'
                  className='block w-full rounded-lg border-0 py-3 pl-10 pr-4 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-white/60 dark:ring-white/20 placeholder:text-gray-500 focus:ring-2 focus:ring-green-500 focus:outline-none bg-white/60 dark:bg-zinc-800/60'
                  placeholder='输入用户名'
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* 密码 */}
          <div>
            <div className='relative'>
              <div className='absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10'>
                <LockKeyhole className='w-5 h-5 text-gray-400 dark:text-gray-300' />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                className='block w-full rounded-lg border-0 py-3 pl-10 pr-12 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-white/60 dark:ring-white/20 placeholder:text-gray-500 focus:ring-2 focus:ring-green-500 focus:outline-none bg-white/60 dark:bg-zinc-800/60'
                placeholder={isRegister ? '设置访问密码' : '输入访问密码'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type='button'
                onClick={() => setShowPassword(!showPassword)}
                className='absolute inset-y-0 right-0 flex items-center pr-3 z-10 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200'
              >
                {showPassword ? (
                  <EyeOff className='w-5 h-5' />
                ) : (
                  <Eye className='w-5 h-5' />
                )}
              </button>
            </div>
          </div>

          {/* 确认密码 (仅注册模式显示) */}
          {isRegister && shouldRegister && (
            <div className='animate-in fade-in slide-in-from-top-2 duration-300'>
              <div className='relative'>
                <div className='absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10'>
                  <ShieldCheck className='w-5 h-5 text-gray-400 dark:text-gray-300' />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete='new-password'
                  className='block w-full rounded-lg border-0 py-3 pl-10 pr-4 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-white/60 dark:ring-white/20 placeholder:text-gray-500 focus:ring-2 focus:ring-green-500 focus:outline-none bg-white/60 dark:bg-zinc-800/60'
                  placeholder='确认访问密码'
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          {error && (
            <p
              className={`text-sm text-center ${
                error.includes('成功')
                  ? 'text-green-600 font-medium'
                  : 'text-red-600'
              } dark:text-red-400`}
            >
              {error}
            </p>
          )}

          <button
            type='submit'
            disabled={!password || loading || (isRegister && !confirmPassword)}
            className='inline-flex w-full justify-center items-center gap-2 rounded-lg bg-green-600 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50'
          >
            {isRegister ? (
              <UserPlus className='w-5 h-5' />
            ) : (
              <LogIn className='w-5 h-5' />
            )}
            {loading ? '处理中...' : isRegister ? '立即注册' : '登录'}
          </button>
        </form>
        {shouldAskUsername && shouldRegister && (
          <div className='mt-6 text-center border-t border-gray-100 dark:border-zinc-800 pt-6'>
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
                setConfirmPassword('');
              }}
              className='text-sm text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors font-medium'
            >
              {isRegister ? '已经有账号？去登录' : '没有账号？立即注册'}
            </button>
          </div>
        )}
      </div>
      <VersionDisplay />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPageClient />
    </Suspense>
  );
}
