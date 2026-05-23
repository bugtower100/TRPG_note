import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { APP_VERSION } from '../../constants/appVersion';
import { compareVersions, releaseCheckService, type LatestReleaseInfo } from '../../services/releaseCheckService';
import ReleaseNotesContent from './ReleaseNotesContent';

interface ReleaseUpdatePanelProps {
  compact?: boolean;
  className?: string;
}

const ReleaseUpdatePanel: React.FC<ReleaseUpdatePanelProps> = ({ compact = false, className = '' }) => {
  const [latestRelease, setLatestRelease] = useState<LatestReleaseInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');

  const loadLatestRelease = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await releaseCheckService.fetchLatestRelease();
      setLatestRelease(result);
      setChecked(true);
    } catch {
      setChecked(true);
      setLatestRelease(null);
      setError('检查更新失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLatestRelease();
  }, [loadLatestRelease]);

  const versionState = useMemo(() => {
    if (!latestRelease) return 'unknown';
    const diff = compareVersions(APP_VERSION, latestRelease.tagName);
    if (diff < 0) return 'outdated';
    if (diff === 0) return 'latest';
    return 'ahead';
  }, [latestRelease]);

  const statusText = useMemo(() => {
    if (loading && !checked) return '正在检查最新正式版...';
    if (error) return error;
    if (!latestRelease) return '暂未获取到最新正式版信息。';
    if (versionState === 'outdated') {
      return `发现新版本 ${latestRelease.tagName}，当前为 ${APP_VERSION}。`;
    }
    if (versionState === 'latest') {
      return `当前已是最新正式版 ${APP_VERSION}。`;
    }
    return `当前版本 ${APP_VERSION} 高于最新正式版 ${latestRelease.tagName}。`;
  }, [APP_VERSION, checked, error, latestRelease, loading, versionState]);

  const latestUrl = latestRelease?.url || releaseCheckService.releasesPageUrl;

  return (
    <div className={`rounded-lg border border-theme bg-theme-card/70 ${compact ? 'px-3 py-2' : 'p-4'} ${className}`}>
      <div className={`flex ${compact ? 'flex-col gap-2' : 'flex-col sm:flex-row sm:items-center sm:justify-between gap-3'}`}>
        <div className="min-w-0">
          <div className={`${compact ? 'text-sm' : 'text-base'} font-medium`}>版本更新</div>
          <div className={`${compact ? 'text-xs' : 'text-sm'} theme-text-secondary mt-1`}>
            当前版本：{APP_VERSION}
            {latestRelease && ` · 最新正式版：${latestRelease.tagName}`}
          </div>
          <div className={`${compact ? 'text-xs' : 'text-sm'} theme-text-secondary mt-1`}>
            {statusText}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void loadLatestRelease()}
            disabled={loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 border border-theme rounded hover:bg-primary-light text-sm disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            检查更新
          </button>
          <button
            type="button"
            onClick={() => window.open(latestUrl, '_blank', 'noopener,noreferrer')}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded hover:bg-primary-dark text-sm"
          >
            <ExternalLink size={15} />
            最新发布页
          </button>
        </div>
      </div>
      {latestRelease && (
        <div className={`${compact ? 'mt-2' : 'mt-4'}`}>
          <div className={`${compact ? 'text-xs' : 'text-sm'} font-medium theme-text-secondary`}>更新内容</div>
          <div className={`${compact ? 'mt-1 max-h-32' : 'mt-2 max-h-48'} overflow-auto rounded border border-theme bg-theme-card px-3 py-2`}>
            <ReleaseNotesContent
              content={latestRelease.releaseNotes}
              className={`${compact ? 'text-xs leading-5' : 'text-sm leading-6'} theme-text-secondary`}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ReleaseUpdatePanel;
