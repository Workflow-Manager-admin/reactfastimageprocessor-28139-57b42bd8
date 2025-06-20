// React-based Image Processor Frontend
import React, { useState, useRef } from 'react';
import './App.css';

// PUBLIC_INTERFACE
/**
 * Modern/Minimalist React Image Processor Frontend
 * Backend base URL is fixed to deployment endpoint.
 * All fetches use this URL.
 */
const API_BASE = 'https://vscode-internal-5476-qa.qa01.cloud.kavia.ai:3001';

function App() {
  // State: File, preview, backend image IDs, UI
  const [originalFile, setOriginalFile] = useState(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState(null);
  const [originalImageId, setOriginalImageId] = useState(null);

  const [processingOption, setProcessingOption] = useState('resize'); // 'resize' or 'filter'
  const [resizeWidth, setResizeWidth] = useState('');
  const [resizeHeight, setResizeHeight] = useState('');
  const [filterType, setFilterType] = useState('blur');
  const [processing, setProcessing] = useState(false);

  const [processedImageId, setProcessedImageId] = useState(null);
  const [processedPreviewUrl, setProcessedPreviewUrl] = useState(null);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const inputFileRef = useRef();

  // State resets/preview construction
  const handleError = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };
  const handleInfo = (msg) => {
    setInfo(msg);
    setTimeout(() => setInfo(''), 3500);
  };

  // Fileselect: Reset process state if new file chosen
  const handleFileSelect = (e) => {
    setProcessedImageId(null);
    setProcessedPreviewUrl(null);
    setOriginalImageId(null);

    const file = e.target.files[0];
    if (!file) return;
    setOriginalFile(file);
    setOriginalPreviewUrl(URL.createObjectURL(file));
  };

  // Upload file to backend (POST /upload-image/)
  const uploadImage = async () => {
    if (!originalFile) {
      handleError('Choose an image before uploading');
      return;
    }
    setUploading(true);
    setError('');
    setInfo('');
    setOriginalImageId(null);
    setProcessedImageId(null);
    setProcessedPreviewUrl(null);

    const formData = new FormData();
    formData.append('image', originalFile);
    try {
      const resp = await fetch(`${API_BASE}/upload-image/`, {
        method: 'POST',
        body: formData,
      });
      if (!resp.ok) {
        // Try to get JSON error details if possible, otherwise fallback
        let err;
        try { err = await resp.json(); } catch { }
        throw new Error((err && err.detail) ? err.detail : 'Upload failed');
      }
      const data = await resp.json();
      if (!data || !data.image_id) throw new Error('Upload failed (no id returned)');
      setOriginalImageId(data.image_id);
      handleInfo('Image uploaded successfully');
    } catch (e) {
      handleError(e?.message || 'Upload error');
    } finally {
      setUploading(false);
    }
  };

  // Send image processing request
  const handleProcess = async () => {
    if (!originalImageId) {
      handleError('Upload an image first');
      return;
    }
    setProcessing(true);
    setProcessedImageId(null);
    setProcessedPreviewUrl(null);
    setError('');
    setInfo('');
    let reqBody = { operation: processingOption };
    if (processingOption === 'resize') {
      if (!resizeWidth || !resizeHeight) {
        handleError('Specify width and height');
        setProcessing(false);
        return;
      }
      reqBody.width = parseInt(resizeWidth, 10);
      reqBody.height = parseInt(resizeHeight, 10);
    } else if (processingOption === 'filter') {
      reqBody.filter_type = filterType;
    }
    try {
      const resp = await fetch(
        `${API_BASE}/process-image/?image_id=${originalImageId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
        }
      );
      if (!resp.ok) {
        let err;
        try { err = await resp.json(); } catch { }
        throw new Error((err && err.detail) ? err.detail : 'Processing failed');
      }
      const data = await resp.json();
      if (!data || !data.processed_id) {
        throw new Error('Processing failed (no processed_id)');
      }
      setProcessedImageId(data.processed_id);
      handleInfo('Image processed!');
    } catch (e) {
      handleError(e?.message || 'Processing error');
    } finally {
      setProcessing(false);
    }
  };

  // Dynamically update preview for original
  React.useEffect(() => {
    if (originalImageId) {
      setOriginalPreviewUrl(
        `${API_BASE}/get-image/?image_id=${originalImageId}&processed=false&_=${Date.now()}`
      );
    } else if (originalFile) {
      setOriginalPreviewUrl(URL.createObjectURL(originalFile));
    } else {
      setOriginalPreviewUrl(null);
    }
    // eslint-disable-next-line
  }, [originalImageId]);

  // Dynamically update preview for processed image
  React.useEffect(() => {
    if (processedImageId) {
      setProcessedPreviewUrl(
        `${API_BASE}/get-image/?image_id=${processedImageId}&processed=true&_=${Date.now()}`
      );
    } else {
      setProcessedPreviewUrl(null);
    }
    // eslint-disable-next-line
  }, [processedImageId]);

  // Download button for processed image
  const handleDownload = async () => {
    if (!processedPreviewUrl) return;
    setDownloading(true);
    setError('');
    try {
      const resp = await fetch(processedPreviewUrl);
      if (!resp.ok) throw new Error('Failed to download processed image');
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'processed_image.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      handleInfo('Processed image saved!');
    } catch (e) {
      handleError(e?.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  // --- RENDER ---
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
              onClick={() => inputFileRef.current && inputFileRef.current.click()}
              disabled={uploading}
              style={{ minWidth: 125, fontWeight: 600 }}
            >
              {uploading ? 'Uploading...' : 'Upload Image'}
            </button>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              ref={inputFileRef}
              onChange={handleFileSelect}
              disabled={uploading}
              data-testid="upload-input"
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

            {/* Notifications */}
            {error && <div className="banner banner-error">{error}</div>}
            {info && <div className="banner banner-info">{info}</div>}

            {/* Panels for upload and option selection */}
            <div className="panel-group">
              <div className="panel upload-panel">
                <div style={{ marginBottom: 9, fontWeight: 500 }}>
                  <strong>Step 1:</strong> Select and upload image.
                </div>
                <button
                  className="btn btn-large"
                  onClick={uploadImage}
                  disabled={!originalFile || uploading}
                  style={{ width: 172 }}
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
                  value={processingOption}
                  onChange={e => setProcessingOption(e.target.value)}
                  style={{ marginBottom: 12 }}
                >
                  <option value="resize">Resize</option>
                  <option value="filter">Filter</option>
                </select>
                {processingOption === 'resize' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="option-input"
                      type="number"
                      placeholder="Width"
                      value={resizeWidth}
                      min={8}
                      max={4096}
                      step={1}
                      onChange={e => setResizeWidth(e.target.value)}
                      style={{ width: 82 }}
                    />
                    <input
                      className="option-input"
                      type="number"
                      placeholder="Height"
                      value={resizeHeight}
                      min={8}
                      max={4096}
                      step={1}
                      onChange={e => setResizeHeight(e.target.value)}
                      style={{ width: 82 }}
                    />
                  </div>
                ) : (
                  <div>
                    <select
                      className="option-select"
                      value={filterType}
                      onChange={e => setFilterType(e.target.value)}
                      style={{ width: '100%' }}
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
                  disabled={!originalImageId || processing}
                >
                  {processing ? 'Processing...' : 'Process'}
                </button>
              </div>
            </div>

            {/* IMAGE PREVIEWS */}
            <div className="preview-panel">
              <div className="preview-box">
                <div className="preview-title">Original</div>
                {originalPreviewUrl ? (
                  <img
                    src={originalPreviewUrl}
                    alt="Original"
                    className="img-preview"
                  />
                ) : (
                  <div className="img-preview img-preview-placeholder">
                    No original selected
                  </div>
                )}
              </div>
              <div className="preview-box">
                <div className="preview-title">Processed</div>
                {processedPreviewUrl ? (
                  <>
                    <img
                      src={processedPreviewUrl}
                      alt="Processed"
                      className="img-preview"
                    />
                    <button
                      className="btn"
                      style={{ marginTop: 17, minWidth: 135 }}
                      onClick={handleDownload}
                      disabled={downloading}
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
