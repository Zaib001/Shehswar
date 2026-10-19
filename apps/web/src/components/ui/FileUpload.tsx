'use client';

import React, { useRef, useState } from 'react';
import { IconUpload, IconClose, IconFileText } from '../icons';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress?: number;
}

export interface FileUploadProps {
  label?: string;
  description?: string;
  accept?: string;
  maxSizeMb?: number;
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  description = 'Supports PDF, JPG, PNG, Excel up to 25MB',
  accept = '.pdf,.jpg,.jpeg,.png,.xlsx,.xls',
  maxSizeMb = 25,
  files,
  onFilesChange,
  disabled = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming || disabled) return;

    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < incoming.length; i++) {
      const file = incoming[i];
      if (!file) continue;
      if (file.size > maxSizeMb * 1024 * 1024) {
        alert(`File ${file.name} exceeds max limit of ${maxSizeMb}MB`);
        continue;
      }
      newFiles.push({
        id: 'file-' + Math.random().toString(36).substring(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
        progress: 100,
      });
    }

    onFilesChange([...files, ...newFiles]);
  };

  const handleRemove = (id: string) => {
    onFilesChange(files.filter((f) => f.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', width: '100%' }}>
      {label && (
        <label
          style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--text-secondary)',
          }}
        >
          {label}
        </label>
      )}

      {/* Drag & Drop Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        style={{
          border: `2px dashed ${
            isDragOver ? 'var(--color-primary)' : 'var(--border-default)'
          }`,
          backgroundColor: isDragOver
            ? 'rgba(13, 148, 136, 0.05)'
            : 'var(--bg-canvas)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all var(--transition-fast)',
          textAlign: 'center',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />

        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-surface-raised)',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-xs)',
          }}
        >
          <IconUpload size={20} />
        </div>

        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--text-primary)',
          }}
        >
          Click to upload or drag & drop files
        </span>

        <span
          style={{
            fontSize: 'var(--font-size-2xs)',
            color: 'var(--text-muted)',
            marginTop: '4px',
          }}
        >
          {description}
        </span>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
          {files.map((file) => (
            <div
              key={file.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <IconFileText size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <span
                  style={{
                    color: 'var(--text-primary)',
                    fontWeight: 'var(--font-weight-medium)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {file.name}
                </span>
                <span
                  style={{
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--font-size-2xs)',
                    flexShrink: 0,
                  }}
                >
                  ({formatFileSize(file.size)})
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleRemove(file.id)}
                aria-label={`Remove ${file.name}`}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <IconClose size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
