import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

interface ResultData {
  state: 'loading' | 'success' | 'error';
  resultImage?: string;
  errorMessage?: string;
  clothingImage?: string;
  userImage?: string;
  savedToHistory?: boolean;
  savedToCloud?: boolean;
}

function ResultPopup() {
  const [data, setData] = useState<ResultData>({ state: 'loading' });
  const [currentClothingImage, setCurrentClothingImage] = useState<string | null>(null);

  useEffect(() => {
    // Listen for messages from background script
    const handleMessage = (message: any) => {
      if (message.type === 'RESULT_UPDATE') {
        setData(message.data);
        if (message.data.clothingImage) {
          setCurrentClothingImage(message.data.clothingImage);
        }
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);

    // Request initial state from background
    browser.runtime.sendMessage({ type: 'GET_POPUP_STATE' }).then((response) => {
      if (response?.data) {
        setData(response.data);
        if (response.data.clothingImage) {
          setCurrentClothingImage(response.data.clothingImage);
        }
      }
    });

    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const handleClose = () => {
    window.close();
  };

  const handleDownload = () => {
    if (!data.resultImage) return;

    const link = document.createElement('a');
    link.href = data.resultImage;
    link.download = `tryon-result-${Date.now()}.png`;
    link.click();
  };

  const handleRetry = async () => {
    if (!currentClothingImage) {
      setData({
        state: 'error',
        errorMessage: 'Cannot retry - original image not available',
      });
      return;
    }

    setData({ state: 'loading' });

    try {
      const response = await browser.runtime.sendMessage({
        type: 'RETRY_AUTO_TRYON',
        clothingImage: currentClothingImage,
      });

      if (response.success && response.resultImage) {
        setData({
          state: 'success',
          resultImage: response.resultImage,
          savedToHistory: response.savedToHistory,
          savedToCloud: response.savedToCloud,
        });
      } else {
        setData({
          state: 'error',
          errorMessage: response.error || 'Failed to generate try-on',
        });
      }
    } catch (error) {
      setData({
        state: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1 className="title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          Virtual Try-On
        </h1>
        <button className="close-btn" onClick={handleClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="content">
        {data.state === 'loading' && (
          <div className="loading">
            <div className="spinner"></div>
            <p className="loading-text">
              Generating your try-on preview...
              <br />
              <span className="loading-subtext">This may take a few seconds</span>
            </p>
          </div>
        )}

        {data.state === 'success' && data.resultImage && (
          <div className="success">
            <img src={data.resultImage} alt="Try-on result" className="result-image" />

            {data.savedToHistory && (
              <div className={`status ${data.savedToCloud ? 'cloud' : ''}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22,4 12,14.01 9,11.01"/>
                </svg>
                <span>
                  {data.savedToCloud ? 'Saved to history & cloud' : 'Saved to history'}
                </span>
              </div>
            )}

            <div className="actions">
              <button className="btn btn-secondary" onClick={handleDownload}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7,10 12,15 17,10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download
              </button>
              <button className="btn btn-primary" onClick={handleClose}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
                Done
              </button>
            </div>
          </div>
        )}

        {data.state === 'error' && (
          <div className="error-state">
            <div className="error">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="error-text">{data.errorMessage || 'Failed to generate try-on. Please try again.'}</p>
            </div>
            <div className="actions">
              <button className="btn btn-secondary" onClick={handleClose}>
                Close
              </button>
              <button className="btn btn-primary" onClick={handleRetry}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23,4 23,10 17,10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ResultPopup />
  </React.StrictMode>
);
