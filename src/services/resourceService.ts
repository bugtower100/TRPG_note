export interface ResourceItem {
  ref: string;
  url: string;
  displayName: string;
  size: number;
  updatedAt: number;
}

const MAX_IMAGE_EDGE = 1600;
const DEFAULT_WEBP_QUALITY = 0.82;

const fallbackDisplayName = (ref: string) => {
  const name = ref.split('/').pop() || ref;
  return name.replace(/\.[^.]+$/, '');
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

  async list(): Promise<ResourceItem[]> {
    const res = await fetch('/api/resources/list');
    if (!res.ok) throw new Error('list_failed');
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.map((item: any) => ({
      ref: String(item.ref || ''),
      url: String(item.url || ''),
      displayName: String(item.displayName || fallbackDisplayName(String(item.ref || ''))),
      size: Number(item.size || 0),
      updatedAt: Number(item.updatedAt || Date.now()),
    }));
  },

  async upload(file: File): Promise<{ ref: string; url: string }> {
    const compressedFile = await this.compressImage(file);
    const formData = new FormData();
    formData.append('file', compressedFile);
    const res = await fetch('/api/resources/upload', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('upload_failed');
    return res.json();
  },

  async deleteOne(ref: string): Promise<void> {
    const res = await fetch(`/api/resources/file/${ref}`, { method: 'DELETE' });
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
};
