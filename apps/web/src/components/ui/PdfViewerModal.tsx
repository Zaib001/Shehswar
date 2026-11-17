'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IconClose,
  IconDownload,
  IconPrinter,
  IconEye,
  IconArrowLeft,
  IconArrowRight,
} from '../icons';

export interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  htmlContent?: string;
  pdfUrl?: string;
  onDownload?: () => void;
  onPrint?: () => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  title = 'Document Viewer',
  subtitle,
  htmlContent,
  pdfUrl,
  onDownload,
  onPrint,
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle Zoom In / Out / Reset
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 15, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 15, 50));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(100);
  }, []);

  // Handle Page navigation (scroll within iframe)
  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage((p) => p - 1);
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.scrollBy({ top: -600, behavior: 'smooth' });
      }
    }
  }, [currentPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage((p) => p + 1);
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.scrollBy({ top: 600, behavior: 'smooth' });
      }
    }
  }, [currentPage, totalPages]);

  const handleFirstPage = useCallback(() => {
    setCurrentPage(1);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleLastPage = useCallback(() => {
    setCurrentPage(totalPages);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.scrollTo({ top: 999999, behavior: 'smooth' });
    }
  }, [totalPages]);

  // Handle Print
  const handlePrint = useCallback(() => {
    if (onPrint) {
      onPrint();
    } else if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  }, [onPrint]);

  // Handle Download
  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload();
    } else if (htmlContent) {
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [onDownload, htmlContent, title]);

  // Keyboard Navigation:
  // Esc (Close), Arrow Right / Page Down (Next Page), Arrow Left / Page Up (Prev Page),
  // + / - (Zoom In / Out), 0 (Reset Zoom), Home (First Page), End (Last Page), Ctrl+P (Print)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is focused on an input or textarea, let default input behavior happen
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevPage();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleZoomReset();
      } else if (e.key === 'Home') {
        e.preventDefault();
        handleFirstPage();
      } else if (e.key === 'End') {
        e.preventDefault();
        handleLastPage();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleNextPage, handlePrevPage, handleZoomIn, handleZoomOut, handleZoomReset, handleFirstPage, handleLastPage, handlePrint]);

  // Populate iframe when htmlContent changes
  useEffect(() => {
    if (!isOpen || !htmlContent || !iframeRef.current) return;

    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
    if (doc) {
      doc.open();
      // Inject print styling and keyboard passthrough
      const enhancedHtml = htmlContent.replace(
        '</head>',
        `<style>
          body {
            margin: 0;
            padding: 24px;
            background: #e2e8f0;
            display: flex;
            flex-direction: column;
            align-items: center;
            font-family: system-ui, -apple-system, sans-serif;
          }
          .page-container, .invoice-box, table, div {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
          }
        </style>
        <script>
          window.addEventListener('keydown', function(e) {
            window.parent.dispatchEvent(new KeyboardEvent('keydown', {
              key: e.key,
              code: e.code,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey,
              altKey: e.altKey,
              shiftKey: e.shiftKey
            }));
          });
        </script>
        </head>`
      );
      doc.write(enhancedHtml);
      doc.close();

      // Estimate total pages after rendering
      setTimeout(() => {
        try {
          const bodyHeight = doc.body.scrollHeight || 1000;
          const pageHeight = 1056; // Standard A4 at 96 DPI
          const estPages = Math.max(1, Math.ceil(bodyHeight / pageHeight));
          setTotalPages(estPages);
        } catch {
          setTotalPages(1);
        }
      }, 300);
    }
  }, [isOpen, htmlContent]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-viewer-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          maxWidth: '1200px',
          height: '92vh',
          backgroundColor: '#0f172a',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Top Header / Toolbar */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#1e293b',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          {/* Document Title & Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(5, 150, 105, 0.2)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconEye size={18} />
            </div>
            <div>
              <div
                id="pdf-viewer-title"
                style={{
                  color: '#ffffff',
                  fontSize: '14.5px',
                  fontWeight: 700,
                  lineHeight: 1.2,
                }}
              >
                {title}
              </div>
              {subtitle && (
                <div style={{ color: '#94a3b8', fontSize: '11.5px', marginTop: '2px' }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          {/* Center Navigation & Zoom Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: '#0f172a',
              padding: '4px 10px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {/* Page Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                title="Previous Page (Arrow Left / Page Up)"
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'transparent',
                  color: currentPage <= 1 ? '#475569' : '#e2e8f0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <IconArrowLeft size={14} />
              </button>
              <span style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 600, padding: '0 6px' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                title="Next Page (Arrow Right / Page Down)"
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'transparent',
                  color: currentPage >= totalPages ? '#475569' : '#e2e8f0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <IconArrowRight size={14} />
              </button>
            </div>

            <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255, 255, 255, 0.15)' }} />

            {/* Zoom Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 50}
                title="Zoom Out (-)"
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'transparent',
                  color: zoom <= 50 ? '#475569' : '#e2e8f0',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: zoom <= 50 ? 'not-allowed' : 'pointer',
                }}
              >
                −
              </button>
              <button
                type="button"
                onClick={handleZoomReset}
                title="Reset Zoom to 100% (0)"
                style={{
                  padding: '2px 8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  color: '#38bdf8',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {zoom}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 200}
                title="Zoom In (+)"
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'transparent',
                  color: zoom >= 200 ? '#475569' : '#e2e8f0',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: zoom >= 200 ? 'not-allowed' : 'pointer',
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Action Buttons: Print, Download, Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handlePrint}
              title="Print Document (Ctrl+P)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <IconPrinter size={14} />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              title="Download / Save Document"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: '#059669',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transition: 'all 0.15s ease',
              }}
            >
              <IconDownload size={14} />
              <span>Download</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Close Preview (Esc)"
              style={{
                padding: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconClose size={16} />
            </button>
          </div>
        </div>

        {/* Keyboard Shortcuts Hint Bar */}
        <div
          style={{
            padding: '6px 20px',
            backgroundColor: '#090d16',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#64748b',
          }}
        >
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <span><kbd style={{ background: '#1e293b', color: '#94a3b8', padding: '1px 5px', borderRadius: '3px' }}>Esc</kbd> Close</span>
            <span><kbd style={{ background: '#1e293b', color: '#94a3b8', padding: '1px 5px', borderRadius: '3px' }}>← / PgUp</kbd> Prev</span>
            <span><kbd style={{ background: '#1e293b', color: '#94a3b8', padding: '1px 5px', borderRadius: '3px' }}>→ / PgDn</kbd> Next</span>
            <span><kbd style={{ background: '#1e293b', color: '#94a3b8', padding: '1px 5px', borderRadius: '3px' }}>+ / -</kbd> Zoom</span>
            <span><kbd style={{ background: '#1e293b', color: '#94a3b8', padding: '1px 5px', borderRadius: '3px' }}>0</kbd> Reset</span>
            <span><kbd style={{ background: '#1e293b', color: '#94a3b8', padding: '1px 5px', borderRadius: '3px' }}>Home / End</kbd> Jump</span>
            <span><kbd style={{ background: '#1e293b', color: '#94a3b8', padding: '1px 5px', borderRadius: '3px' }}>Ctrl+P</kbd> Print</span>
          </div>
          <span style={{ color: '#059669', fontWeight: 600 }}>Interactive Document View</span>
        </div>

        {/* Document Content Viewport */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#334155',
            overflow: 'auto',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              title={title}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
              }}
            />
          ) : (
            <div
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease',
                width: '100%',
                maxWidth: '900px',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <iframe
                ref={iframeRef}
                title={title}
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '850px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

