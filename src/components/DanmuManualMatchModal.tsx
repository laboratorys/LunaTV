'use client';

import { useEffect, useState } from 'react';

import { DanmuCandidate } from '@/hooks/useDanmu';

interface DanmuManualMatchModalProps {
  open: boolean;
  title: string;
  candidates: DanmuCandidate[];
  loading?: boolean;
  onClose: () => void;
  onSearch: (keyword: string) => Promise<DanmuCandidate[]>;
  onSelect: (candidate: DanmuCandidate) => void;
  onResetAuto?: () => void;
}

const DanmuManualMatchModal = ({
  open,
  title,
  candidates,
  loading = false,
  onClose,
  onSearch,
  onSelect,
  onResetAuto,
}: DanmuManualMatchModalProps) => {
  const [keyword, setKeyword] = useState(title);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setKeyword(title);
      setError(null);
    }
  }, [open, title]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const result = await onSearch(keyword.trim());
      if (result.length === 0) {
        setError('未搜索到匹配的弹幕');
      }
    } catch (err) {
      setError((err as Error).message || '搜索失败');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div
      className='fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4'
      onClick={onClose}
    >
      <div
        className='w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700'>
          <h3 className='text-base font-semibold text-gray-900 dark:text-gray-100'>
            弹幕匹配
          </h3>
          <button
            type='button'
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none px-2'
            aria-label='关闭'
          >
            ×
          </button>
        </div>

        <div className='p-5 space-y-4'>
          <div className='flex gap-2'>
            <input
              type='text'
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleSearch();
              }}
              placeholder='输入剧名关键词搜索'
              className='flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-primary-500'
            />
            <button
              type='button'
              onClick={() => void handleSearch()}
              disabled={searching || !keyword.trim()}
              className='px-4 py-2 text-sm rounded-lg bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            >
              {searching ? '搜索中' : '搜索'}
            </button>
          </div>

          {error && <p className='text-sm text-red-500'>{error}</p>}

          {loading ? (
            <p className='text-sm text-gray-500 dark:text-gray-400'>
              加载中...
            </p>
          ) : candidates.length === 0 ? (
            <p className='text-sm text-gray-500 dark:text-gray-400'>
              暂无候选，可更换关键词后重试
            </p>
          ) : (
            <ul className='max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800'>
              {candidates.map((candidate) => (
                <li key={`${candidate.animeId}-${candidate.episodeId ?? 0}`}>
                  <button
                    type='button'
                    onClick={() => onSelect(candidate)}
                    className='w-full text-left px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                  >
                    <div className='flex items-baseline justify-between gap-3'>
                      <span className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                        {candidate.animeTitle || `剧集 ${candidate.animeId}`}
                      </span>
                      {candidate.source && (
                        <span className='text-xs px-2 py-0.5 rounded bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 shrink-0'>
                          {candidate.source}
                        </span>
                      )}
                    </div>
                    {candidate.episodeTitle && (
                      <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                        {candidate.episodeTitle}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {onResetAuto && (
            <button
              type='button'
              onClick={onResetAuto}
              className='text-xs text-gray-500 dark:text-gray-400 hover:text-primary-500 transition-colors'
            >
              清除手动选择，恢复自动匹配
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DanmuManualMatchModal;
