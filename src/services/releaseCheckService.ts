export interface LatestReleaseInfo {
  tagName: string;
  releaseName: string;
  url: string;
  publishedAt?: string;
  releaseNotes: string;
}

const GITHUB_LATEST_RELEASE_API = 'https://api.github.com/repos/bugtower100/TRPG_note/releases/latest';
const GITHUB_RELEASES_PAGE = 'https://github.com/bugtower100/TRPG_note/releases';

const normalizeVersion = (value: string) => value.trim().replace(/^v/i, '');

const parseVersion = (value: string): number[] => normalizeVersion(value)
  .split('.')
  .map((part) => Number(part))
  .filter((part) => Number.isFinite(part));

export const compareVersions = (current: string, latest: string) => {
  const left = parseVersion(current);
  const right = parseVersion(latest);
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    if (leftValue === rightValue) continue;
    return leftValue < rightValue ? -1 : 1;
  }
  return 0;
};

export const releaseCheckService = {
  async fetchLatestRelease(): Promise<LatestReleaseInfo> {
    const response = await fetch(GITHUB_LATEST_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`release_check_failed:${response.status}`);
    }
    const payload = await response.json();
    const tagName = String(payload?.tag_name || '').trim();
    if (!tagName) {
      throw new Error('release_tag_missing');
    }
    return {
      tagName,
      releaseName: String(payload?.name || tagName).trim() || tagName,
      url: String(payload?.html_url || GITHUB_RELEASES_PAGE),
      publishedAt: typeof payload?.published_at === 'string' ? payload.published_at : undefined,
      releaseNotes: typeof payload?.body === 'string' ? payload.body.trim() : '',
    };
  },
  releasesPageUrl: GITHUB_RELEASES_PAGE,
};
