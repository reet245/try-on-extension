import React, { useState, useEffect } from 'react';

export interface FloatingResultPanelProps {
  state: 'loading' | 'success' | 'error';
  resultImage?: string;
  errorMessage?: string;
  onClose: () => void;
}

const styles = {
  container: {
    position: 'fixed' as const,
    top: '20px',
    right: '20px',
    width: '320px',
    maxHeight: '500px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    zIndex: 2147483647,
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    overflow: 'hidden',
    animation: 'slideIn 0.3s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #e9ecef',
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#1a1a2e',
    margin: 0,
  },
  icon: {
    width: '20px',
    height: '20px',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    color: '#6c757d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },
  content: {
    padding: '16px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    gap: '16px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e9ecef',
    borderTop: '3px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '14px',
    color: '#6c757d',
    margin: 0,
  },
  resultImage: {
    width: '100%',
    borderRadius: '8px',
    display: 'block',
  },
  errorContainer: {
    padding: '16px',
    backgroundColor: '#fef2f2',
    borderRadius: '8px',
    border: '1px solid #fecaca',
  },
  errorText: {
    fontSize: '13px',
    color: '#dc2626',
    margin: 0,
    lineHeight: 1.5,
  },
  keyframes: `
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `,
};

export function FloatingResultPanel({
  state,
  resultImage,
  errorMessage,
  onClose,
}: FloatingResultPanelProps) {
  return (
    <>
      <style>{styles.keyframes}</style>
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>
            <svg
              style={styles.icon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            Virtual Try-On
          </h3>
          <button
            style={styles.closeButton}
            onClick={onClose}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = '#e9ecef')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={styles.content}>
          {state === 'loading' && (
            <div style={styles.loadingContainer}>
              <div style={styles.spinner} />
              <p style={styles.loadingText}>Generating try-on preview...</p>
            </div>
          )}

          {state === 'success' && resultImage && (
            <img
              src={resultImage}
              alt="Try-on result"
              style={styles.resultImage}
            />
          )}

          {state === 'error' && (
            <div style={styles.errorContainer}>
              <p style={styles.errorText}>
                {errorMessage || 'Failed to generate try-on. Please try again.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Helper function to render the panel into a shadow DOM
export function renderFloatingPanel(
  container: HTMLElement,
  props: FloatingResultPanelProps
): void {
  // Import ReactDOM dynamically since this runs in content script
  import('react-dom/client').then(({ createRoot }) => {
    const root = createRoot(container);
    root.render(<FloatingResultPanel {...props} />);
  });
}
