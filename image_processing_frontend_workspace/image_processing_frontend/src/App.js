import React, { useState, useRef, useEffect } from 'react';
import './App.css';

const API_BASE = 'https://vscode-internal-5476-qa.qa01.cloud.kavia.ai:3001';

function App() {
  // --- STATE MANAGEMENT ---
  // Local upload file and preview
  const [file, setFile] = useState(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null);

  // Backend IDs and preview URLs
  const [backendOriginalId, setBackendOriginalId] = useState(null);
  const [originalUrl, setOriginalUrl] = useState(null);

  // Processing options
  const [processType, setProcessType] = useState('resize'); // or 'filter'
  const [resizeW, setResizeW] = useState('');
  const [resizeH, setResizeH] = useState('');
  const [filter, setFilter] = useState('blur');

  // Loading states
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Processed state/results
  const [backendProcessedId, setBackendProcessedId] = useState(null);
  const [processedUrl, setProcessedUrl] = useState(null);

  // UX banners
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Refs
  const fileInputRef = useRef();

  // --- ERROR/INFO HELPERS ---
  function showError(msg) {
    setError(msg);
    setTimeout(() => setError(''), 5200);
  }
  function showInfo(msg) {
    setInfo(msg);
    setTimeout(() => setInfo(''), 2900);
  }

  // --- HANDLE FILE CHOSEN (LOCAL PREVIEW) ---
  function handleFileSelect(e) {
    const chosen = e.target.files && e.target.files[0];
    if (chosen) {
      setFile(chosen);
      setLocalPreviewUrl(URL.createObjectURL(chosen));
      setBackendOriginalId(null);
      setOriginalUrl(null);
      setBackendProcessedId(null);
      setProcessedUrl(null);
      setError('');
      setInfo('');
    }
  }

  // --- IMAGE UPLOAD ---
  async function handleUpload() {
    if (!file) {
      showError('Please select an image file first.');
      return;
    }
    setUploading(true);
    setError('');
    setInfo('');
    setBackendOriginalId(null);
    setOriginalUrl(null);
    setBackendProcessedId(null);
    setProcessedUrl(null);

    const form = new FormData();
    form.append('image', file);

    try {
      const resp = await fetch(`${API_BASE}/upload-image/`, {
        method: 'POST',
        body: form,
      });
      let data;
      if (!resp.ok) {
        try { data = await resp.json(); } catch { }
        showError(data && data.detail ? data.detail : 'Failed to upload image.');
        setUploading(false);
        return;
      }
      data = await resp.json();
      if (data && data.image_id) {
        setBackendOriginalId(data.image_id);
        setInfo('Upload successful. Ready to process.');
        showInfo('Upload successful.');
      } else {
        showError('Upload succeeded but did not return an image ID.');
      }
    } catch (err) {
      showError('Could not upload: ' + (err?.message || 'Network error'));
    } finally {
      setUploading(false);
    }
  }

  // --- IMAGE PROCESSING ---
  async function handleProcess() {
    if (!backendOriginalId) {
      showError('Please upload an image first.');
      return;
    }
    if (
      processType === 'resize' &&
      (!resizeW || !resizeH || Number(resizeW) < 8 || Number(resizeH) < 8)
    ) {
      showError('Width and height (min 8 px) required for resize.');
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
    } else if (processType === 'filter') {
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
        showError(data && data.detail ? data.detail : 'Failed to process image.');
        setProcessing(false);
        return;
      }
      data = await resp.json();
      if (data && data.processed_id) {
        setBackendProcessedId(data.processed_id);
        showInfo('Processing succeeded!');
      } else {
        showError('Processing succeeded but no processed image returned.');
      }
    } catch (err) {
      showError('Could not process: ' + (err?.message || 'Network error'));
    } finally {
      setProcessing(false);
    }
  }

  // --- DOWNLOAD HANDLER ---
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
      showInfo('Downloaded!');
    } catch (err) {
      showError('Download failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setDownloading(false);
    }
  }

  // --- PREVIEW STATE LOGIC (syncs preview URLs to state) ---
  // Original (backend-served) preview after upload
  useEffect(() => {
    if (backendOriginalId) {
      // Show backend-served image to reflect any backend format/changes
      setOriginalUrl(
        `${API_BASE}/get-image/?image_id=${backendOriginalId}&processed=false&_=${Date.now()}`
      );
    } else if (file) {
      setOriginalUrl(localPreviewUrl);
    } else {
      setOriginalUrl(null);
    }
    // eslint-disable-next-line
  }, [backendOriginalId, file, localPreviewUrl]);

  // Processed (backend-served) preview after processing
  useEffect(() => {
    if (backendProcessedId) {
      setProcessedUrl(
        `${API_BASE}/get-image/?image_id=${backendProcessedId}&processed=true&_=${Date.now()}`
      );
    } else {
      setProcessedUrl(null);
    }
    // eslint-disable-next-line
  }, [backendProcessedId]);

  // --- UI/UX ---
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
              {uploading ? 'Uploading...' : 'Choose Image'}
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
              Upload an image, optionally preview, select resize/filter, and view before/after. Download the result!
            </div>
            {error &&
              <div className="banner banner-error" role="alert">{error}</div>
            }
            {info &&
              <div className="banner banner-info">{info}</div>
            }

            {/* Work panels: Upload, Process options */}
            <div className="panel-group">
              <div className="panel upload-panel">
                <div style={{ marginBottom: 8, fontWeight: 500 }}>
                  <strong>Step 1:</strong> Pick and upload image
                </div>
                <button
                  className="btn btn-large"
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  style={{ width: 172 }}
                  data-testid="upload-and-preview-btn"
                >
                  {uploading ? 'Uploading...' : (file ? 'Upload & Preview' : 'Select Image')}
                </button>
                <div style={{ fontSize: 13, color: "#886", paddingTop: 7, minHeight: 20 }}>
                  {file && !backendOriginalId && (
                    <>Selected: <b>{file.name}</b></>
                  )}
                  {backendOriginalId && (
                    <span>Uploaded to backend</span>
                  )}
                </div>
              </div>

              <div className="panel options-panel">
                <div style={{ marginBottom: 8, fontWeight: 500 }}>
                  <strong>Step 2:</strong> Set processing options
                </div>
                <select
                  className="option-select"
                  value={processType}
                  onChange={e => setProcessType(e.target.value)}
                  style={{ marginBottom: 12 }}
                  data-testid="process-type-select"
                  disabled={!backendOriginalId || processing}
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
                      disabled={!backendOriginalId || processing}
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
                      disabled={!backendOriginalId || processing}
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
                      disabled={!backendOriginalId || processing}
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
                <div style={{ fontSize: 12, color: "#886", paddingTop: 8, minHeight: 18 }}>
                  {backendProcessedId && !processing && processedUrl && (
                    <>Processed result ready!</>
                  )}
                </div>
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
                    style={{ opacity: backendOriginalId ? 1 : 0.75 }}
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
                      style={{ opacity: 1 }}
                    />
                    <button
                      className="btn"
                      style={{ marginTop: 16, minWidth: 130 }}
                      onClick={handleDownload}
                      disabled={downloading}
                      data-testid="download-btn"
                    >
                      {downloading ? 'Downloading...' : 'Download'}
                    </button>
                  </>
                ) : (
                  <div className="img-preview img-preview-placeholder">
                    {processing ? 'Processing...' : 'No result yet'}
                  </div>
                )}
              </div>
            </div>
            {/* END PREVIEW */}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
