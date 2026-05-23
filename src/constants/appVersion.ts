import appVersionRaw from '../../server/version.txt?raw';

const normalized = appVersionRaw.trim();

export const APP_VERSION = normalized.startsWith('v') ? normalized : `v${normalized}`;
