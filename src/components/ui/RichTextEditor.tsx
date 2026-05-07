import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { cn } from '../../lib/utils';

const EDITOR_MODULES = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['clean']
  ],
};

const QUIZ_MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ 'script': 'sub'}, { 'script': 'super' }],
    ['clean']
  ],
};

interface RichTextEditorProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  className?: string;
  theme?: string;
  placeholder?: string;
}

export const RichTextEditor = React.memo(({ 
  label, 
  value, 
  onChange, 
  className, 
  theme = "snow", 
  placeholder = "Saisissez votre texte ici..." 
}: RichTextEditorProps) => {
  const [localValue, setLocalValue] = useState(value || '');
  const lastValueRef = useRef(value || '');

  // Choose modules based on context (label or theme)
  const isQuizMode = !label?.toLowerCase().includes('annonce') && !label?.toLowerCase().includes('description') && !label?.toLowerCase().includes('contenu');
  const modules = isQuizMode ? QUIZ_MODULES : EDITOR_MODULES;

  // Update local value when prop changes, but only if it's different from what we last sent
  useEffect(() => {
    if (value !== lastValueRef.current) {
      setLocalValue(value || '');
      lastValueRef.current = value || '';
    }
  }, [value]);

  const handleChange = useCallback((val: string) => {
    if (val === lastValueRef.current) return;
    setLocalValue(val);
    lastValueRef.current = val;
    // Use startTransition for the external update to lower its priority
    React.startTransition(() => {
      onChange(val);
    });
  }, [onChange]);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div className="bg-white rounded-lg overflow-hidden border border-slate-200">
        <ReactQuill 
          theme={theme} 
          value={localValue} 
          onChange={handleChange}
          modules={modules}
          placeholder={placeholder}
          className="bg-white"
        />
      </div>
    </div>
  );
});
