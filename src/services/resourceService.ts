export interface ResourceItem {
  ref: string;
  url: string;
  displayName: string;
  size: number;
  updatedAt: number;
}

const fallbackDisplayName = (ref: string) => {
  const name = ref.split('/').pop() || ref;
  return name.replace(/\.[^.]+$/, '');
};

export const resourceService = {
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
    const formData = new FormData();
    formData.append('file', file);
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
