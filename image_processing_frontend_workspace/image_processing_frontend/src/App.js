import React, { useState, useRef } from 'react';
import './App.css';

// Backend base URL - adjust to deployment as needed
const API_BASE =
  process.env.REACT_APP_BACKEND_BASE ||
  'https://vscode-internal-5476-qa.qa01.cloud.kavia.ai:3001';

function App() {
  // State for the original uploaded image
  const [originalFile, setOriginalFile] = useState(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState(null);
  const [originalImageId, setOriginalImageId] = useState(null);
  // State for processing
  const [processingOption, setProcessingOption] = useState('resize'); // 'resize' or 'filter'
  const [resizeWidth, setResizeWidth] = useState('');
  const [resizeHeight, setResizeHeight] = useState('');
  const [filterType, setFilterType] = useState('blur'); // Default for filters
  const [processing, setProcessing] = useState(false);
  const [processedImageId, setProcessedImageId] = useState(null);
  const [processedPreviewUrl, setProcessedPreviewUrl] = useState(null);
  // Notification + error states
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [uploading, setUploading] = useState(false);
  const inputFileRef = useRef();

  // Helpers for feedback
  const handleError = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };
  const handleInfo = (msg) => {
    setInfo(msg);
    setTimeout(() => setInfo(''), 4000);
  };

  // Step 1: User selects file and uploads it
  const handleFileSelect = (e) => {
    setProcessedImageId(null);
    setProcessedPreviewUrl(null);
    const file = e.target.files[0];
    if (!file) return;
    setOriginalFile(file);
    setOriginalImageId(null);
    // Preview
    setOriginalPreviewUrl(URL.createObjectURL(file));
  };

  const uploadImage = async () => {
    if (!originalFile) return;
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
        const err = await resp.json();
        throw new Error(err.detail || 'Upload failed');
      }
      const data = await resp.json();
      setOriginalImageId(data.image_id);
      handleInfo('Image uploaded successfully');
    } catch (e) {
      handleError(e.message || 'Upload error');
    } finally {
      setUploading(false);
    }
  };

  // Step 2: User selects processing and sends to backend
  const handleProcess = async () => {
    if (!originalImageId) {
      handleError('Please upload an image first');
      return;
    }
    setProcessing(true);
    setProcessedImageId(null);
    setProcessedPreviewUrl(null);
    setError('');
    setInfo('');
    // Compose process request
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
        const err = await resp.json();
        throw new Error(
          err.detail || 'Processing failed'
        );
      }
      const data = await resp.json();
      setProcessedImageId(data.processed_id);
      handleInfo('Image processed!');
    } catch (e) {
      handleError(e.message || 'Processing error');
    } finally {
      setProcessing(false);
    }
  };

  // Step 3: Fetch image for display (original or processed)
  React.useEffect(() => {
    // Original
    if (originalImageId) {
      setOriginalPreviewUrl(
        `${API_BASE}/get-image/?image_id=${originalImageId}&processed=false&_=${Date.now()}`
      );
    }
  }, [originalImageId]);
  React.useEffect(() => {
    if (processedImageId) {
      setProcessedPreviewUrl(
        `${API_BASE}/get-image/?image_id=${processedImageId}&processed=true&_=${Date.now()}`
      );
    }
  }, [processedImageId]);

  // --- RENDER ---
  return (
    <div className="app">
      <nav className="navbar">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div className="logo">
              <span className="logo-symbol">*</span> KAVIA AI
            </div>
            <button
              className="btn"
              style={{background: 'var(--base-light)'}}
              onClick={() => inputFileRef.current && inputFileRef.current.click()}
              disabled={uploading}
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
          <div className="hero" style={{paddingTop: 120, paddingBottom: 32, gap: 20}}>
            <div className="subtitle">Image Processing Demo</div>
            <h1 className="title" style={{fontSize: '2.8rem'}}>Image Processor</h1>
            <div className="description">
              Upload an image, select a processing option (resize or filter), and view the before/after!
            </div>

            {/* Notifications */}
            {error && <div className="banner banner-error">{error}</div>}
            {info && <div className="banner banner-info">{info}</div>}

            {/* UPLOAD & OPTIONS */}
            <div className="panel-group">
              <div className="panel upload-panel">
                <div style={{ marginBottom: 8 }}>
                  <strong>Step 1:</strong> Select and upload an image file.
                </div>
                <button
                  className="btn btn-large"
                  onClick={uploadImage}
                  disabled={!originalFile || uploading}
                  style={{ width: 180 }}
                >
                  {uploading
                    ? 'Uploading...'
                    : 'Upload & Preview'}
                </button>
              </div>
              <div className="panel options-panel">
                <div style={{ marginBottom: 8 }}>
                  <strong>Step 2:</strong> Set processing options
                </div>
                <select
                  className="option-select"
                  value={processingOption}
                  onChange={e => setProcessingOption(e.target.value)}
                  style={{ marginBottom: 10 }}
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
                      style={{ width: 90 }}
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
                      style={{ width: 90 }}
                    />
                  </div>
                ) : (
                  <div>
                    <select
                      className="option-select"
                      value={filterType}
                      onChange={e => setFilterType(e.target.value)}
                    >
                      <option value="blur">Blur</option>
                      <option value="contour">Contour</option>
                      <option value="edge_enhance">Edge Enhance</option>
                    </select>
                  </div>
                )}
                <button
                  className="btn btn-large"
                  style={{ marginTop: 15, width: 180 }}
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
                  <img
                    src={processedPreviewUrl}
                    alt="Processed"
                    className="img-preview"
                  />
                ) : (
                  <div className="img-preview img-preview-placeholder">
                    No result yet
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* End hero */}
        </div>
      </main>
    </div>
  );
}

export default App;