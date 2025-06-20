/**
 * PUBLIC_INTERFACE
 * Modern/Minimalist React Image Processor Frontend
 * Backend base URL is fixed to deployment endpoint.
 *  - Upload: POST /upload-image/ with image
 *  - Process: POST /process-image/?image_id=ID with body options
 *  - Preview: GET /get-image/?image_id=ID&processed=(true|false)
 *  - Download: Same as preview: download processed image
 * All requests use https://vscode-internal-5476-qa.qa01.cloud.kavia.ai:3001 as base.
 *
 * UX:
 * - Step 1: Select & upload image → preview appears
 * - Step 2: Set processing options → "Process" → see processed preview, with download button
 * - Error & info banners show for feedback
 */

import React, { useState, useRef, useEffect } from 'react';
import './App.css';

const API_BASE = 'https://vscode-internal-5476-qa.qa01.cloud.kavia.ai:3001';

function App() {
  // --- State ---
  const [file, setFile] = useState(null); // Local upload file
  const [originalUrl, setOriginalUrl] = useState(null); // Local or fetched preview
  const [backendOriginalId, setBackendOriginalId] = useState(null);

  const [processType, setProcessType] = useState('resize'); // 'resize' or 'filter'
  const [resizeW, setResizeW] = useState('');
  const [resizeH, setResizeH] = useState('');
  const [filter, setFilter] = useState('blur');

  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [backendProcessedId, setBackendProcessedId] = useState(null);
  const [processedUrl, setProcessedUrl] = useState(null);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const fileInputRef = useRef();

  // --- Error/info banner helpers ---
  const displayError = msg => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };
  const displayInfo = msg => {
    setInfo(msg);
    setTimeout(() => setInfo(''), 3500);
  };

  // --- Handle file select ---
  function handleFileSelect(e) {
    const chosen = e.target.files && e.target.files[0];
    if (chosen) {
      setFile(chosen);
      setOriginalUrl(URL.createObjectURL(chosen));
      setBackendOriginalId(null);
      setBackendProcessedId(null);
      setProcessedUrl(null);
    }
  }

  // --- Upload image (POST /upload-image/) ---
  async function handleUpload() {
    if (!file) {
      displayError('Please select an image file first.');
      return;
    }
    setError('');
    setInfo('');
    setUploading(true);
    setBackendOriginalId(null);
    setBackendProcessedId(null);
    setProcessedUrl(null);

    const form = new FormData();
    form.append('image', file);

    try {
      const resp = await fetch(`${API_BASE}/upload-image/`, {
        method: 'POST',
        body: form
      });
      let data;
      if (!resp.ok) {
        try { data = await resp.json(); } catch { }
        displayError((data && data.detail) ? data.detail : 'Failed to upload image.');
        setUploading(false);
        return;
      }
      data = await resp.json();
      if (data && data.image_id) {
        setBackendOriginalId(data.image_id);
        displayInfo('Upload successful.');
      } else {
        displayError('Upload succeeded but did not return an image_id.');
      }
    } catch (err) {
      displayError('Could not upload: ' + (err?.message || 'Network error'));
    } finally {
      setUploading(false);
    }
  }

  // --- Process image call ---
  async function handleProcess() {
    if (!backendOriginalId) {
      displayError('Please upload an image first.');
      return;
    }
    if (processType === 'resize' && (!resizeW || !resizeH)) {
      displayError('Width and height required for resize.');
      return;
    }
    setProcessing(true);
    setBackendProcessedId(null);
    setProcessedUrl(null);
    setError('');
    setInfo('');

    const options = { operation: processType };
    if (processType === 'resize') {
      options.width = parseInt(resizeW, 10);
      options.height = parseInt(resizeH, 10);
    }
    if (processType === 'filter') {
      options.filter_type = filter;
    }
    try {
      const resp = await fetch(
        `${API_BASE}/process-image/?image_id=${backendOriginalId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(options)
        }
      );
      let data;
      if (!resp.ok) {
        try { data = await resp.json(); } catch { }
        displayError((data && data.detail) ? data.detail : 'Failed to process image.');
        setProcessing(false);
        return;
      }
      data = await resp.json();
      if (data && data.processed_id) {
        setBackendProcessedId(data.processed_id);
        displayInfo('Processing succeeded.');
      } else {
        displayError('Processing succeeded but no processed image returned.');
      }
    } catch (err) {
      displayError('Could not process: ' + (err?.message || 'Network error'));
    } finally {
      setProcessing(false);
    }
  }

  // --- Original preview updates if file or backendOriginalId changes ---
  useEffect(() => {
    if (!file && !backendOriginalId) {
      setOriginalUrl(null);
      return;
    }
    // If uploaded and backendId is available, always show backend-served version for data consistency.
    if (backendOriginalId) {
      setOriginalUrl(
        `${API_BASE}/get-image/?image_id=${backendOriginalId}&processed=false&_=${Date.now()}`
      );
      return;
    }
    if (file) {
      setOriginalUrl(URL.createObjectURL(file));
      return;
    }
    setOriginalUrl(null);
    // eslint-disable-next-line
  }, [file, backendOriginalId]);

  // --- Processed preview updates when backendProcessedId changes ---
  useEffect(() => {
    if (!backendProcessedId) {
      setProcessedUrl(null);
      return;
    }
    setProcessedUrl(
      `${API_BASE}/get-image/?image_id=${backendProcessedId}&processed=true&_=${Date.now()}`
    );
    // eslint-disable-next-line
  }, [backendProcessedId]);

  // --- Download processed image ---
  async function handleDownload() {
    if (!processedUrl) return;
    setDownloading(true);
    setError('');
    try {
      const resp = await fetch(processedUrl);
      if (!resp.ok) throw new Error('Could not fetch processed image');
      const blob = await resp.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'processed_image.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      displayInfo('Downloaded!');
    } catch (err) {
      displayError('Download failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setDownloading(false);
    }
  }

  // --- UI ---
  return (
    <div className="app">
      <nav className="navbar">
        <div className="container" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div className="logo">
              <span className="logo-symbol">★</span> KAVIA AI
            </div>
            <button
              className="btn"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              disabled={uploading}
              style={{ minWidth: 125, fontWeight: 600 }}
              data-testid="upload-btn"
            >
              {uploading ? 'Uploading...' : 'Upload Image'}
            </button>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleFileSelect}
              disabled={uploading}
              data-testid="file-input"
            />
          </div>
        </div>
      </nav>

      <main>
        <div className="container">
          <div className="hero" style={{ paddingTop: 70, paddingBottom: 25, gap: 16 }}>
            <div className="subtitle">Image Processing Demo</div>
            <h1 className="title" style={{ fontSize: '2.1rem' }}>Image Processor</h1>
            <div className="description">
              Upload an image, select a processing option (resize or filter), and view the before/after.
            </div>

            {error &&
              <div className="banner banner-error" role="alert">{error}</div>
            }
            {info &&
              <div className="banner banner-info">{info}</div>
            }

            <div className="panel-group">
              <div className="panel upload-panel">
                <div style={{ marginBottom: 9, fontWeight: 500 }}>
                  <strong>Step 1:</strong> Select and upload image.
                </div>
                <button
                  className="btn btn-large"
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  style={{ width: 172 }}
                  data-testid="upload-and-preview-btn"
                >
                  {uploading ? 'Uploading...' : 'Upload & Preview'}
                </button>
              </div>
              <div className="panel options-panel">
                <div style={{ marginBottom: 9, fontWeight: 500 }}>
                  <strong>Step 2:</strong> Set processing options
                </div>
                <select
                  className="option-select"
                  value={processType}
                  onChange={e => setProcessType(e.target.value)}
                  style={{ marginBottom: 12 }}
                  data-testid="process-type-select"
                >
                  <option value="resize">Resize</option>
                  <option value="filter">Filter</option>
                </select>
                {processType === 'resize' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="option-input"
                      type="number"
                      placeholder="Width"
                      value={resizeW}
                      min={8}
                      max={4096}
                      step={1}
                      onChange={e => setResizeW(e.target.value)}
                      style={{ width: 82 }}
                      data-testid="resize-width"
                    />
                    <input
                      className="option-input"
                      type="number"
                      placeholder="Height"
                      value={resizeH}
                      min={8}
                      max={4096}
                      step={1}
                      onChange={e => setResizeH(e.target.value)}
                      style={{ width: 82 }}
                      data-testid="resize-height"
                    />
                  </div>
                ) : (
                  <div>
                    <select
                      className="option-select"
                      value={filter}
                      onChange={e => setFilter(e.target.value)}
                      style={{ width: '100%' }}
                      data-testid="filter-type"
                    >
                      <option value="blur">Blur</option>
                      <option value="contour">Contour</option>
                      <option value="edge_enhance">Edge Enhance</option>
                    </select>
                  </div>
                )}
                <button
                  className="btn btn-large"
                  style={{ marginTop: 16, width: 172 }}
                  onClick={handleProcess}
                  disabled={!backendOriginalId || processing}
                  data-testid="process-btn"
                >
                  {processing ? 'Processing...' : 'Process'}
                </button>
              </div>
            </div>

            {/* IMAGE PREVIEWS */}
            <div className="preview-panel">
              <div className="preview-box">
                <div className="preview-title">Original</div>
                {originalUrl ? (
                  <img
                    src={originalUrl}
                    alt="Original"
                    className="img-preview"
                    data-testid="original-img-preview"
                  />
                ) : (
                  <div className="img-preview img-preview-placeholder">
                    No original selected
                  </div>
                )}
              </div>
              <div className="preview-box">
                <div className="preview-title">Processed</div>
                {processedUrl ? (
                  <>
                    <img
                      src={processedUrl}
                      alt="Processed"
                      className="img-preview"
                      data-testid="processed-img-preview"
                    />
                    <button
                      className="btn"
                      style={{ marginTop: 17, minWidth: 135 }}
                      onClick={handleDownload}
                      disabled={downloading}
                      data-testid="download-btn"
                    >
                      {downloading ? 'Downloading...' : 'Download'}
                    </button>
                  </>
                ) : (
                  <div className="img-preview img-preview-placeholder">
                    No result yet
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
