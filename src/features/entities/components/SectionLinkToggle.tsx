import React from 'react';
import { Link2, Unlink2 } from 'lucide-react';

interface SectionLinkToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

const SectionLinkToggle: React.FC<SectionLinkToggleProps> = ({ enabled, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!enabled)}
    aria-pressed={enabled}
    title={enabled ? '关闭此区块的关键词导向' : '开启此区块的关键词导向'}
    className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold transition-colors ${
      enabled
        ? 'border-primary/30 text-primary hover:bg-primary/10'
        : 'border-theme theme-text-secondary hover:bg-primary-light'
    }`}
  >
    {enabled ? <Link2 size={13} /> : <Unlink2 size={13} />}
    {enabled ? '导向' : '不导向'}
  </button>
);

export default SectionLinkToggle;
