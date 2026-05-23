import React, { useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, X } from 'lucide-react';
import { APP_VERSION } from '../../constants/appVersion';
import { compareVersions, releaseCheckService, type LatestReleaseInfo } from '../../services/releaseCheckService';
import ReleaseNotesContent from './ReleaseNotesContent';

interface ReleaseUpdateButtonProps {
  className?: string;
}

const ReleaseUpdateButton: React.FC<ReleaseUpdateButtonProps> = ({ className = '' }) => {
  const [loading, setLoading] = useState(false);
  const [latestRelease, setLatestRelease] = useState<LatestReleaseInfo | null>(null);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const versionState = useMemo(() => {
    if (!latestRelease) return 'unknown';
    const diff = compareVersions(APP_VERSION, latestRelease.tagName);
    if (diff < 0) return 'outdated';
    if (diff === 0) return 'latest';
    return 'ahead';
  }, [latestRelease]);

  const statusText = useMemo(() => {
    if (error) return error;
    if (!latestRelease) return '暂未获取到最新正式版信息。';
    if (versionState === 'outdated') {
      return `发现新版本 ${latestRelease.tagName}，你当前使用的是 ${APP_VERSION}。`;
    }
    if (versionState === 'latest') {
      return `当前已是最新正式版 ${APP_VERSION}。`;
    }
    return `当前版本 ${APP_VERSION} 高于最新正式版 ${latestRelease.tagName}。`;
  }, [error, latestRelease, versionState]);

  const handleCheckUpdate = async () => {
    setLoading(true);
    setError('');
    setDialogOpen(true);
    try {
      const result = await releaseCheckService.fetchLatestRelease();
      setLatestRelease(result);
    } catch {
      setLatestRelease(null);
      setError('检查更新失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  const latestUrl = latestRelease?.url || releaseCheckService.releasesPageUrl;

  return (
    <>
      <button
        type="button"
        onClick={() => void handleCheckUpdate()}
        disabled={loading}
        className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded bg-white text-gray-600 border-gray-300 hover:bg-gray-50 disabled:opacity-50 ${className}`}
      >
        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        检查更新
      </button>

      {dialogOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4" onClick={() => setDialogOpen(false)}>
          <div
            className="w-full max-w-md rounded-xl border border-theme bg-theme-card shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-theme px-4 py-3">
              <div>
                <div className="font-semibold">版本更新</div>
                <div className="text-xs theme-text-secondary mt-1">当前版本：{APP_VERSION}</div>
              </div>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="text-gray-400 hover:text-gray-700"
                aria-label="关闭更新提示"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-4 py-4 space-y-3">
              <div className="text-sm theme-text-secondary">
                {loading ? '正在检查最新正式版...' : statusText}
              </div>
              {latestRelease && (
                <div className="rounded-lg border border-theme bg-theme-card/60 p-3 text-sm">
                  <div>最新正式版：{latestRelease.tagName}</div>
                  <div className="mt-1 theme-text-secondary truncate">发布名称：{latestRelease.releaseName}</div>
                  {latestRelease.publishedAt && (
                    <div className="mt-1 theme-text-secondary">
                      发布时间：{new Date(latestRelease.publishedAt).toLocaleString()}
                    </div>
                  )}
                  <div className="mt-3">
                    <div className="text-xs font-medium theme-text-secondary">更新内容</div>
                    <div className="mt-1 max-h-56 overflow-auto rounded border border-theme bg-theme-card px-3 py-2">
                      <ReleaseNotesContent
                        content={latestRelease.releaseNotes}
                        className="text-xs leading-6 theme-text-secondary"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-theme px-4 py-3">
              <button
                type="button"
                onClick={() => void handleCheckUpdate()}
                disabled={loading}
                className="inline-flex items-center gap-1 px-3 py-2 border border-theme rounded hover:bg-primary-light text-sm disabled:opacity-50"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                重新检查
              </button>
              <button
                type="button"
                onClick={() => window.open(latestUrl, '_blank', 'noopener,noreferrer')}
                className="inline-flex items-center gap-1 px-3 py-2 bg-primary text-white rounded hover:bg-primary-dark text-sm"
              >
                <ExternalLink size={15} />
                最新发布页
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReleaseUpdateButton;
