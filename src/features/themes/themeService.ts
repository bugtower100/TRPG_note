import { CampaignTheme } from '../../types';

export interface CustomThemeConfig {
  name: string;
  bgPage: string;
  bgCard: string;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
  primaryColor: string;
  primaryLight: string;
  fontFamily?: string;
}

export interface ThemeOption {
  id: CampaignTheme;
  label: string;
  desc: string;
}

export interface CustomThemeFile {
  format: 'trpg-note-theme';
  version: 1;
  theme: CustomThemeConfig;
}

export interface StoredCustomThemes {
  themes: CustomThemeConfig[];
  selectedName: string | null;
}

export const BUILTIN_THEME_OPTIONS: ThemeOption[] = [
  { id: 'default', label: '默认风格', desc: '淡雅的紫色调，柔和且适合现代阅读。' },
  { id: 'scroll', label: '羊皮纸与鼠尾草', desc: '暖米色纸页搭配鼠尾草绿，更接近手写卡面与安静阅读。' },
  { id: 'archive', label: '未来科技', desc: '高对比度深色调，适合科幻或调查模组。' },
  { id: 'nature', label: '薄巧清新', desc: '薄荷绿主调搭配棕色文字与边框，清新耐看。' },
  { id: 'custom', label: '自定义主题', desc: '通过 JSON 上传你自己的颜色和字体方案。' },
];

const STORAGE_KEY = 'trpg_custom_themes';

const COLOR_KEYS: Array<keyof CustomThemeConfig> = [
  'bgPage',
  'bgCard',
  'textPrimary',
  'textSecondary',
  'borderColor',
  'primaryColor',
  'primaryLight',
];

const isValidColor = (value: unknown) =>
  typeof value === 'string' &&
  (/^#[0-9a-fA-F]{6}$/.test(value.trim()) || /^#[0-9a-fA-F]{8}$/.test(value.trim()));

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const validateCustomThemeConfig = (input: unknown): CustomThemeConfig => {
  if (!input || typeof input !== 'object') {
    throw new Error('主题文件格式无效。');
  }
  const raw = input as Record<string, unknown>;
  const name = normalizeString(raw.name);
  if (!name) {
    throw new Error('自定义主题必须提供 name。');
  }

  const theme = {
    name,
    bgPage: '',
    bgCard: '',
    textPrimary: '',
    textSecondary: '',
    borderColor: '',
    primaryColor: '',
    primaryLight: '',
    fontFamily: normalizeString(raw.fontFamily) || undefined,
  } satisfies CustomThemeConfig;

  for (const key of COLOR_KEYS) {
    const value = raw[key];
    if (!isValidColor(value)) {
      throw new Error(`主题颜色字段 ${key} 无效，请使用 #RRGGBB 或 #RRGGBBAA 格式。`);
    }
    theme[key] = String(value).trim() as CustomThemeConfig[typeof key];
  }

  return theme;
};

export const parseCustomThemeFile = async (file: File): Promise<CustomThemeConfig> => {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('主题文件不是有效的 JSON。');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('主题文件格式无效。');
  }

  const raw = parsed as Record<string, unknown>;
  if (raw.format === 'trpg-note-theme' && raw.version === 1 && raw.theme) {
    return validateCustomThemeConfig(raw.theme);
  }

  return validateCustomThemeConfig(parsed);
};

export const applyThemeToDocument = (
  theme: CampaignTheme,
  customTheme: CustomThemeConfig | null
) => {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  const hasCustomTheme = theme === 'custom' && customTheme;

  root.style.setProperty('--bg-page', hasCustomTheme ? customTheme.bgPage : '');
  root.style.setProperty('--bg-card', hasCustomTheme ? customTheme.bgCard : '');
  root.style.setProperty('--text-primary', hasCustomTheme ? customTheme.textPrimary : '');
  root.style.setProperty('--text-secondary', hasCustomTheme ? customTheme.textSecondary : '');
  root.style.setProperty('--border-color', hasCustomTheme ? customTheme.borderColor : '');
  root.style.setProperty('--primary-color', hasCustomTheme ? customTheme.primaryColor : '');
  root.style.setProperty('--primary-light', hasCustomTheme ? customTheme.primaryLight : '');
  root.style.setProperty('--primary-dark', hasCustomTheme ? customTheme.primaryColor : '');
  root.style.setProperty('--scrollbar-thumb', hasCustomTheme ? customTheme.borderColor : '');
  root.style.setProperty('--scrollbar-track', hasCustomTheme ? customTheme.bgPage : '');
  root.style.setProperty('--font-family', hasCustomTheme ? customTheme.fontFamily || '' : '');
};

export const loadStoredCustomThemes = (): StoredCustomThemes => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { themes: [], selectedName: null };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredCustomThemes> | CustomThemeConfig[];
    if (Array.isArray(parsed)) {
      const themes = parsed.map((item) => validateCustomThemeConfig(item));
      return { themes, selectedName: themes[0]?.name || null };
    }
    const themes = Array.isArray(parsed.themes)
      ? parsed.themes.map((item) => validateCustomThemeConfig(item))
      : [];
    const selectedName =
      typeof parsed.selectedName === 'string' && themes.some((item) => item.name === parsed.selectedName)
        ? parsed.selectedName
        : themes[0]?.name || null;
    return { themes, selectedName };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return { themes: [], selectedName: null };
  }
};

export const saveCustomThemes = (themes: CustomThemeConfig[], selectedName: string | null) => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      themes,
      selectedName,
    } satisfies StoredCustomThemes)
  );
};

export const upsertCustomTheme = (
  existingThemes: CustomThemeConfig[],
  nextTheme: CustomThemeConfig
) => {
  const index = existingThemes.findIndex((item) => item.name === nextTheme.name);
  if (index < 0) {
    return [...existingThemes, nextTheme].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  }
  return existingThemes.map((item, itemIndex) => (itemIndex === index ? nextTheme : item));
};

export const removeCustomTheme = (themes: CustomThemeConfig[], name: string) =>
  themes.filter((item) => item.name !== name);

export const resolveSelectedCustomTheme = (
  themes: CustomThemeConfig[],
  selectedName: string | null
) => themes.find((item) => item.name === selectedName) || null;

export const buildCustomThemeExport = (theme: CustomThemeConfig): CustomThemeFile => ({
  format: 'trpg-note-theme',
  version: 1,
  theme,
});

export const downloadCustomThemeTemplate = () => {
  const template = buildCustomThemeExport({
    name: '我的自定义主题',
    bgPage: '#f3f4f6',
    bgCard: '#ffffff',
    textPrimary: '#111827',
    textSecondary: '#4b5563',
    borderColor: '#d1d5db',
    primaryColor: '#7c3aed',
    primaryLight: '#ede9fe',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  });
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'trpg-custom-theme-template.json';
  link.click();
  URL.revokeObjectURL(url);
};
