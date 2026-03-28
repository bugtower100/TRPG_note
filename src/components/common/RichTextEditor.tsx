import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Link, Bold, Italic, List, Eye, Edit } from 'lucide-react';
import RichTextDisplay from './RichTextDisplay';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  value, 
  onChange, 
  placeholder = '支持 Markdown 格式...', 
  className = '',
  minHeight = '150px'
}) => {
  const [isPreview, setIsPreview] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selection = text.substring(start, end);
    
    const newText = text.substring(0, start) + before + selection + after + text.substring(end);
    onChange(newText);
    
    // Restore selection / cursor
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const result = evt.target?.result as string;
        insertText(`![${file.name}](${result})`);
      };
      reader.readAsDataURL(file);
    }
    // Reset
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`border border-theme rounded-md overflow-hidden bg-theme-card focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-theme bg-theme-card/50">
        <div className="flex items-center gap-1">
            {!isPreview && (
                <>
                    <button 
                        type="button"
                        onClick={() => insertText('**', '**')}
                        className="p-1.5 theme-text-secondary hover:bg-gray-200/50 hover:text-primary rounded" 
                        title="加粗"
                    >
                        <Bold size={16} />
                    </button>
                    <button 
                        type="button"
                        onClick={() => insertText('*', '*')}
                        className="p-1.5 theme-text-secondary hover:bg-gray-200/50 hover:text-primary rounded" 
                        title="斜体"
                    >
                        <Italic size={16} />
                    </button>
                    <button 
                        type="button"
                        onClick={() => insertText('- ')}
                        className="p-1.5 theme-text-secondary hover:bg-gray-200/50 hover:text-primary rounded" 
                        title="列表"
                    >
                        <List size={16} />
                    </button>
                    <div className="w-px h-4 bg-gray-300 mx-1"></div>
                    <button 
                        type="button"
                        onClick={() => insertText('[', '](url)')}
                        className="p-1.5 theme-text-secondary hover:bg-gray-200/50 hover:text-primary rounded" 
                        title="链接"
                    >
                        <Link size={16} />
                    </button>
                    <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 theme-text-secondary hover:bg-gray-200/50 hover:text-primary rounded" 
                        title="插入图片"
                    >
                        <ImageIcon size={16} />
                    </button>
                    <input 
                        type="file" 
                        accept="image/*" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleImageUpload}
                    />
                </>
            )}
        </div>
        
        <button
            type="button"
            onClick={() => setIsPreview(!isPreview)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                isPreview 
                    ? 'bg-primary text-white' 
                    : 'theme-text-secondary hover:bg-gray-200/50 hover:text-primary'
            }`}
        >
            {isPreview ? (
                <>
                    <Edit size={14} /> 进入编辑
                </>
            ) : (
                <>
                    <Eye size={14} /> 完成编辑
                </>
            )}
        </button>
      </div>

      {isPreview ? (
          <div className="p-3 bg-theme-card overflow-y-auto" style={{ minHeight }}>
              <RichTextDisplay content={value || '（暂无内容）'} />
          </div>
      ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full p-3 outline-none resize-y text-sm font-mono bg-transparent theme-text-primary"
            style={{ minHeight }}
            placeholder={placeholder}
          />
      )}
      
      {!isPreview && (
          <div className="px-3 py-1 bg-theme-card/50 text-xs theme-text-secondary text-right border-t border-theme">
            支持 Markdown / HTML
          </div>
      )}
    </div>
  );
};

export default RichTextEditor;
