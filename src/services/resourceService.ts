import { parseJsonResponse } from './apiClient';

export interface ResourceItem {
  ref: string;
  url: string;
  displayName: string;
  size: number;
  updatedAt: number;
  parentPath: string;
}

export interface ResourceFolder {
  path: string;
  name: string;
  parentPath: string;
  updatedAt: number;
}

export interface ResourceListResult {
  folders: ResourceFolder[];
  items: ResourceItem[];
}

export interface ResourceTreeNode {
  path: string;
  name: string;
  folders: ResourceTreeNode[];
  items: ResourceItem[];
}

export const RESOURCE_ROOT_PATH = 'graph_assets';
export const RESOURCE_ROOT_LABEL = '全部资源';

const MAX_IMAGE_EDGE = 1600;
const DEFAULT_WEBP_QUALITY = 0.82;

const fallbackDisplayName = (ref: string) => {
  const name = ref.split('/').pop() || ref;
  return name.replace(/\.[^.]+$/, '');
};

const normalizeFolderPath = (rawPath?: string) => {
  const value = String(rawPath || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!value || value === '.') return RESOURCE_ROOT_PATH;
  return value.startsWith(`${RESOURCE_ROOT_PATH}/`) || value === RESOURCE_ROOT_PATH
    ? value
    : `${RESOURCE_ROOT_PATH}/${value}`;
};

export const buildResourceFileUrl = (ref: string) => {
  const path = String(ref || '').trim().replace(/^\/+/, '');
  const encoded = path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `/api/resources/file/${encoded}`;
};

export const joinResourceFolderPath = (basePath: string, folderName: string) => {
  const base = normalizeFolderPath(basePath);
  const name = String(folderName || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!name) return base;
  return normalizeFolderPath(`${base}/${name}`);
};

export const resourceFolderDisplayName = (path: string) => (
  path === RESOURCE_ROOT_PATH ? RESOURCE_ROOT_LABEL : path.replace(`${RESOURCE_ROOT_PATH}/`, '')
);

export const filterResourceItems = (
  items: ResourceItem[],
  selectedFolderPath: string,
  keyword?: string
) => {
  const folderPath = normalizeFolderPath(selectedFolderPath);
  const keywordText = keyword?.trim().toLowerCase() || '';
  return items.filter((item) => {
    const inFolder = folderPath === RESOURCE_ROOT_PATH
      ? true
      : item.parentPath === folderPath || item.parentPath.startsWith(`${folderPath}/`);
    if (!inFolder) return false;
    if (!keywordText) return true;
    return (
      item.displayName.toLowerCase().includes(keywordText) ||
      item.ref.toLowerCase().includes(keywordText) ||
      item.parentPath.toLowerCase().includes(keywordText)
    );
  });
};

export const flattenResourceFolders = (folders: ResourceFolder[]) => {
  const all = [
    { path: RESOURCE_ROOT_PATH, name: RESOURCE_ROOT_LABEL, parentPath: '', updatedAt: 0 },
    ...folders,
  ];
  return all.sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'));
};

export const buildResourceTree = (
  folders: ResourceFolder[],
  items: ResourceItem[],
  keyword?: string
): ResourceTreeNode => {
  const keywordText = keyword?.trim().toLowerCase() || '';
  const root: ResourceTreeNode = {
    path: RESOURCE_ROOT_PATH,
    name: RESOURCE_ROOT_LABEL,
    folders: [],
    items: [],
  };
  const folderMap = new Map<string, ResourceTreeNode>([[RESOURCE_ROOT_PATH, root]]);

  [...folders]
    .sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'))
    .forEach((folder) => {
      folderMap.set(folder.path, {
        path: folder.path,
        name: folder.name,
        folders: [],
        items: [],
      });
    });

  [...folders]
    .sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'))
    .forEach((folder) => {
      const parent = folderMap.get(folder.parentPath || RESOURCE_ROOT_PATH) || root;
      const current = folderMap.get(folder.path);
      if (current) {
        parent.folders.push(current);
      }
    });

  [...items]
    .sort((a, b) => {
      if (a.parentPath !== b.parentPath) {
        return a.parentPath.localeCompare(b.parentPath, 'zh-CN');
      }
      if (a.updatedAt !== b.updatedAt) {
        return b.updatedAt - a.updatedAt;
      }
      return a.displayName.localeCompare(b.displayName, 'zh-CN');
    })
    .forEach((item) => {
      const parent = folderMap.get(item.parentPath || RESOURCE_ROOT_PATH) || root;
      parent.items.push(item);
    });

  if (!keywordText) return root;

  const filterNode = (node: ResourceTreeNode): ResourceTreeNode | null => {
    const folderMatched = node.path !== RESOURCE_ROOT_PATH && node.name.toLowerCase().includes(keywordText);
    if (folderMatched) {
      return node;
    }
    const filteredFolders = node.folders
      .map((folder) => filterNode(folder))
      .filter((folder): folder is ResourceTreeNode => Boolean(folder));
    const filteredItems = node.items.filter((item) => (
      item.displayName.toLowerCase().includes(keywordText) ||
      item.ref.toLowerCase().includes(keywordText)
    ));
    if (filteredFolders.length === 0 && filteredItems.length === 0 && node.path !== RESOURCE_ROOT_PATH) {
      return null;
    }
    return {
      ...node,
      folders: filteredFolders,
      items: filteredItems,
    };
  };

  return filterNode(root) || root;
};

export const resourceService = {
  async compressImage(file: File): Promise<File> {
    if (file.type === 'image/webp') return file;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('read_failed'));
      reader.readAsDataURL(file);
    });
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode_failed'));
      img.src = dataUrl;
    });
    const ratio = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width || 1, image.height || 1));
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      return file;
    }
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((nextBlob) => resolve(nextBlob), 'image/webp', DEFAULT_WEBP_QUALITY);
    });
    if (!blob) return file;
    const filenameBase = (file.name || 'image').replace(/\.[^.]+$/, '');
    return new File([blob], `${filenameBase}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  },

  async list(): Promise<ResourceListResult> {
    const res = await fetch('/api/resources/list');
    const data = await parseJsonResponse<Record<string, unknown>>(res, 'list_failed');
    const folders = Array.isArray(data?.folders) ? data.folders : [];
    const items = Array.isArray(data?.items) ? data.items : [];
    return {
      folders: folders.map((folder: any) => ({
        path: normalizeFolderPath(folder.path),
        name: String(folder.name || normalizeFolderPath(folder.path).split('/').pop() || ''),
        parentPath: normalizeFolderPath(folder.parentPath),
        updatedAt: Number(folder.updatedAt || Date.now()),
      })),
      items: items.map((item: any) => ({
        ref: String(item.ref || ''),
        url: String(item.url || ''),
        displayName: String(item.displayName || fallbackDisplayName(String(item.ref || ''))),
        size: Number(item.size || 0),
        updatedAt: Number(item.updatedAt || Date.now()),
        parentPath: normalizeFolderPath(item.parentPath),
      })),
    };
  },

  async upload(file: File, folderPath?: string): Promise<{ ref: string; url: string }> {
    const compressedFile = await this.compressImage(file);
    const formData = new FormData();
    formData.append('file', compressedFile);
    formData.append('folderPath', normalizeFolderPath(folderPath));
    const res = await fetch('/api/resources/upload', {
      method: 'POST',
      body: formData,
    });
    return parseJsonResponse<{ ref: string; url: string }>(res, 'upload_failed');
  },

  async deleteOne(ref: string): Promise<void> {
    const res = await fetch(buildResourceFileUrl(ref), { method: 'DELETE' });
    if (!res.ok) throw new Error('delete_failed');
  },

  async deleteMany(refs: string[]): Promise<void> {
    const res = await fetch('/api/resources/delete-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refs }),
    });
    if (!res.ok) throw new Error('delete_batch_failed');
  },

  async createFolder(path: string): Promise<void> {
    const res = await fetch('/api/resources/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: normalizeFolderPath(path) }),
    });
    if (!res.ok) throw new Error('create_folder_failed');
  },

  async moveMany(refs: string[], targetFolder: string): Promise<void> {
    const res = await fetch('/api/resources/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refs,
        targetFolder: normalizeFolderPath(targetFolder),
      }),
    });
    if (!res.ok && res.status !== 207) throw new Error('move_failed');
  },

  async renameFolder(path: string, newName: string): Promise<void> {
    const res = await fetch('/api/resources/folders/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: normalizeFolderPath(path),
        newName: String(newName || '').trim(),
      }),
    });
    if (!res.ok) throw new Error('rename_folder_failed');
  },

  async deleteFolder(path: string): Promise<void> {
    const target = normalizeFolderPath(path)
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const res = await fetch(`/api/resources/folders/${target}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('delete_folder_failed');
  },
};
