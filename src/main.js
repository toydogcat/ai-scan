import { BarcodeFormat, BrowserCodeReader, BrowserMultiFormatReader } from '@zxing/browser';
import OCRWorker from './ocr-worker.js?worker';
import './styles.css';

const formats = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.PDF_417,
  BarcodeFormat.AZTEC,
];

const reader = new BrowserMultiFormatReader();
reader.possibleFormats = formats;

const ocrModels = {
  v4_mobile: {
    label: 'PP-OCRv4 Mobile',
    base: 'https://huggingface.co/tobytoy/yolo_base_home/resolve/main/paddle',
    det: '/ch_PP-OCRv4_det_infer.onnx',
    rec: '/ch_PP-OCRv4_rec_infer.onnx',
    dict: '/ppocr_keys_v1.txt',
  },
  v4_server: {
    label: 'PP-OCRv4 Server',
    base: 'https://huggingface.co/tobytoy/yolo_base_home/resolve/main/paddle',
    det: '/ch_PP-OCRv4_server_det_infer.onnx',
    rec: '/ch_PP-OCRv4_server_rec_infer.onnx',
    dict: '/ppocr_keys_v1.txt',
  },
  v3_balanced: {
    label: 'PP-OCRv3',
    base: 'https://huggingface.co/tobytoy/yolo_base_home/resolve/main/paddle',
    det: '/ch_PP-OCRv3_det_infer.onnx',
    rec: '/ch_PP-OCRv3_rec_infer.onnx',
    dict: '/ppocr_keys_v1.txt',
  },
};

let controls = null;
let currentImageUrl = '';
let lastResultKey = '';
let ocrWorker = null;
let ocrWorkerModel = '';
let ocrInitPromise = null;
let history = [];

document.querySelector('#app').innerHTML = `
  <main class="shell">
    <section class="hero" aria-labelledby="title">
      <div>
        <p class="eyebrow">Vite + GitHub Pages</p>
        <h1 id="title">AI Scan</h1>
        <p class="intro">用相機或圖片掃描 QR Code、常見條碼，也能 OCR 辨識圖片文字並快速複製。</p>
      </div>
      <div class="status-pill" id="cameraSupport">檢查相機中</div>
    </section>

    <section class="scanner" aria-label="掃描工具">
      <div class="source-tabs" role="tablist" aria-label="圖片源">
        <button class="tab active" type="button" data-mode="camera" role="tab" aria-selected="true">相機</button>
        <button class="tab" type="button" data-mode="image" role="tab" aria-selected="false">圖片</button>
      </div>

      <div class="workspace">
        <div class="preview-area">
          <div class="camera-panel" data-panel="camera">
            <video id="preview" muted playsinline></video>
            <div class="scan-frame" aria-hidden="true"></div>
          </div>

          <label class="dropzone hidden" data-panel="image" id="dropzone">
            <input id="imageInput" type="file" accept="image/*" />
            <img id="imagePreview" alt="上傳圖片預覽" class="hidden" />
            <span id="dropText">選擇或拖放圖片</span>
          </label>
        </div>

        <aside class="controls" aria-label="控制項">
          <label class="field">
            <span>鏡頭</span>
            <select id="cameraSelect"></select>
          </label>

          <div class="button-row">
            <button id="startButton" type="button">開始掃描</button>
            <button id="stopButton" type="button" class="secondary">停止</button>
          </div>

          <div id="status" class="status" role="status">準備好了。</div>

          <section class="result-box" aria-live="polite">
            <div class="result-label">最新結果</div>
            <pre id="resultText">尚未掃描到內容</pre>
            <dl>
              <div>
                <dt>格式</dt>
                <dd id="resultFormat">-</dd>
              </div>
              <div>
                <dt>時間</dt>
                <dd id="resultTime">-</dd>
              </div>
            </dl>
            <div class="button-row compact">
              <button id="copyButton" type="button" disabled>複製</button>
              <button id="openButton" type="button" class="secondary" disabled>開啟網址</button>
            </div>
          </section>

          <section class="result-box" aria-live="polite">
            <div class="result-label">OCR 文字辨識</div>
            <label class="field compact-field">
              <span>模型</span>
              <select id="ocrModel">
                <option value="v4_mobile">PP-OCRv4 Mobile</option>
                <option value="v4_server">PP-OCRv4 Server</option>
                <option value="v3_balanced">PP-OCRv3</option>
              </select>
            </label>
            <pre id="ocrText">尚未辨識文字</pre>
            <ol id="ocrItems" class="ocr-items"></ol>
            <div id="ocrStatus" class="mini-status">OCR 待命中。</div>
            <div class="button-row compact">
              <button id="ocrButton" type="button">OCR</button>
              <button id="copyOcrButton" type="button" class="secondary" disabled>複製文字</button>
            </div>
          </section>
        </aside>
      </div>
    </section>

    <section class="history-section" aria-labelledby="historyTitle">
      <h2 id="historyTitle">掃描紀錄</h2>
      <ol id="historyList" class="history-list"></ol>
    </section>
  </main>
`;

const elements = {
  cameraSupport: document.querySelector('#cameraSupport'),
  cameraSelect: document.querySelector('#cameraSelect'),
  copyButton: document.querySelector('#copyButton'),
  copyOcrButton: document.querySelector('#copyOcrButton'),
  dropText: document.querySelector('#dropText'),
  dropzone: document.querySelector('#dropzone'),
  historyList: document.querySelector('#historyList'),
  imageInput: document.querySelector('#imageInput'),
  imagePreview: document.querySelector('#imagePreview'),
  openButton: document.querySelector('#openButton'),
  ocrButton: document.querySelector('#ocrButton'),
  ocrItems: document.querySelector('#ocrItems'),
  ocrModel: document.querySelector('#ocrModel'),
  ocrStatus: document.querySelector('#ocrStatus'),
  ocrText: document.querySelector('#ocrText'),
  resultFormat: document.querySelector('#resultFormat'),
  resultText: document.querySelector('#resultText'),
  resultTime: document.querySelector('#resultTime'),
  startButton: document.querySelector('#startButton'),
  status: document.querySelector('#status'),
  stopButton: document.querySelector('#stopButton'),
  tabs: document.querySelectorAll('.tab'),
  video: document.querySelector('#preview'),
};

let mode = 'camera';
let latestValue = '';
let latestOcrText = '';

function setStatus(message, tone = 'neutral') {
  elements.status.textContent = message;
  elements.status.dataset.tone = tone;
}

function setOcrStatus(message, tone = 'neutral') {
  elements.ocrStatus.textContent = message;
  elements.ocrStatus.dataset.tone = tone;
}

function isUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function formatName(format) {
  return String(format).replaceAll('_', ' ');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderHistory() {
  elements.historyList.innerHTML = history
    .map(
      (item) => `
        <li>
          <span>${escapeHtml(item.text)}</span>
          <small>${formatName(item.format)} · ${item.time}</small>
        </li>
      `,
    )
    .join('');
}

function updateResult(result) {
  const text = result.getText();
  const format = result.getBarcodeFormat();
  const time = new Date().toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const resultKey = `${format}:${text}`;

  latestValue = text;
  elements.resultText.textContent = text;
  elements.resultFormat.textContent = formatName(format);
  elements.resultTime.textContent = time;
  elements.copyButton.disabled = false;
  elements.openButton.disabled = !isUrl(text);

  if (resultKey !== lastResultKey) {
    history = [{ text, format, time }, ...history].slice(0, 8);
    lastResultKey = resultKey;
    renderHistory();
  }

  setStatus('掃描成功。', 'success');
}

function stopCamera() {
  if (controls) {
    controls.stop();
    controls = null;
  }
  BrowserCodeReader.releaseAllStreams();
  elements.video.removeAttribute('src');
  elements.video.load();
  setStatus('相機已停止。');
}

async function loadCameras() {
  if (!navigator.mediaDevices?.getUserMedia) {
    elements.cameraSupport.textContent = '此瀏覽器不支援相機';
    elements.startButton.disabled = true;
    return;
  }

  elements.cameraSupport.textContent = '相機可用';

  try {
    const devices = await BrowserCodeReader.listVideoInputDevices();
    elements.cameraSelect.innerHTML =
      '<option value="">自動選擇後鏡頭</option>' +
      devices
        .map((device, index) => {
          const label = device.label || `鏡頭 ${index + 1}`;
          return `<option value="${device.deviceId}">${label}</option>`;
        })
        .join('');
  } catch {
    elements.cameraSelect.innerHTML = '<option value="">自動選擇後鏡頭</option>';
  }
}

async function startCamera() {
  stopImagePreview();
  stopCamera();
  setStatus('正在啟動相機...');

  try {
    const deviceId = elements.cameraSelect.value;
    const constraints = {
      audio: false,
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
    };

    controls = await reader.decodeFromConstraints(constraints, elements.video, (result, error) => {
      if (result) {
        updateResult(result);
      } else if (error?.name && !['NotFoundException', 'ChecksumException'].includes(error.name)) {
        setStatus(`掃描中：${error.name}`, 'warning');
      }
    });

    setStatus('相機掃描中，請把 QR Code 或條碼放進框線內。');
    await loadCameras();
  } catch (error) {
    setStatus(`無法啟動相機：${error.message || error.name}`, 'error');
  }
}

function stopImagePreview() {
  if (currentImageUrl) {
    URL.revokeObjectURL(currentImageUrl);
    currentImageUrl = '';
  }
}

function captureVideoFrame() {
  const { videoWidth, videoHeight } = elements.video;

  if (!videoWidth || !videoHeight) {
    throw new Error('相機畫面尚未準備好');
  }

  const canvas = document.createElement('canvas');
  canvas.width = videoWidth;
  canvas.height = videoHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(elements.video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function imageElementToCanvas() {
  if (!currentImageUrl || !elements.imagePreview.naturalWidth) {
    throw new Error('請先選擇圖片');
  }

  const canvas = document.createElement('canvas');
  canvas.width = elements.imagePreview.naturalWidth;
  canvas.height = elements.imagePreview.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(elements.imagePreview, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function getOcrCanvas() {
  if (mode === 'image') {
    return imageElementToCanvas();
  }

  return captureVideoFrame();
}

function modelUrl(config, key) {
  const value = config[key];
  return value.startsWith('http') ? value : `${config.base}${value}`;
}

async function fetchWithProgress(url, label, onProgress) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch(url, {
      cache: 'force-cache',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${label} HTTP ${response.status}`);
    }

    const total = Number(response.headers.get('content-length')) || 0;

    if (!response.body) {
      onProgress(`${label} 下載中...`);
      return await response.arrayBuffer();
    }

    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      received += value.byteLength;

      if (total) {
        const percent = Math.round((received / total) * 100);
        onProgress(`${label} ${percent}%`);
      } else {
        onProgress(`${label} ${(received / 1024 / 1024).toFixed(1)} MB`);
      }
    }

    const buffer = new Uint8Array(received);
    let offset = 0;

    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return buffer.buffer;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`${label} 下載逾時，請重新按 OCR`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchTextWithTimeout(url, label) {
  const buffer = await fetchWithProgress(url, label, setOcrStatus);
  return new TextDecoder('utf-8').decode(buffer);
}

function resetOcrOutput() {
  latestOcrText = '';
  elements.ocrText.textContent = '尚未辨識文字';
  elements.ocrItems.innerHTML = '';
  elements.copyOcrButton.disabled = true;
}

async function initOcrWorker() {
  const modelId = elements.ocrModel.value;

  if (ocrWorker && ocrWorkerModel === modelId) {
    return ocrWorker;
  }

  if (ocrInitPromise) {
    return ocrInitPromise;
  }

  ocrInitPromise = (async () => {
    const config = ocrModels[modelId] || ocrModels.v4_mobile;

    if (ocrWorker) {
      ocrWorker.terminate();
      ocrWorker = null;
    }

    setOcrStatus(`正在下載 ${config.label}...`);
    elements.ocrButton.disabled = true;

    const detBuffer = await fetchWithProgress(modelUrl(config, 'det'), '偵測模型', setOcrStatus);
    const recBuffer = await fetchWithProgress(modelUrl(config, 'rec'), '辨識模型', setOcrStatus);
    const dictContent = await fetchTextWithTimeout(modelUrl(config, 'dict'), '字典');

    const worker = new OCRWorker();

    await new Promise((resolve, reject) => {
      const initTimeout = window.setTimeout(() => {
        reject(new Error('OCR Worker 初始化逾時，請重新按 OCR'));
      }, 90000);

      worker.onmessage = (event) => {
        const { type, data } = event.data;

        if (type === 'status') {
          setOcrStatus(data);
        } else if (type === 'initialized') {
          window.clearTimeout(initTimeout);
          resolve();
        } else if (type === 'error') {
          window.clearTimeout(initTimeout);
          reject(new Error(data));
        }
      };

      worker.onerror = (error) => {
        window.clearTimeout(initTimeout);
        reject(new Error(error.message || 'OCR Worker 發生錯誤'));
      };

      worker.postMessage(
        {
          type: 'init',
          data: {
            detBuffer,
            recBuffer,
            dictContent,
          },
        },
        [detBuffer, recBuffer],
      );
    });

    worker.onmessage = handleOcrWorkerMessage;
    ocrWorker = worker;
    ocrWorkerModel = modelId;
    setOcrStatus(`${config.label} 已就緒。`, 'success');
    return worker;
  })();

  try {
    return await ocrInitPromise;
  } finally {
    ocrInitPromise = null;
    elements.ocrButton.disabled = false;
  }
}

function renderOcrResults(results, duration) {
  const items = Array.isArray(results) ? results : [];
  latestOcrText = items.map((item) => item.text).filter(Boolean).join('\n').trim();
  elements.ocrText.textContent = latestOcrText || '沒有辨識到文字';
  elements.copyOcrButton.disabled = !latestOcrText;
  elements.ocrItems.innerHTML = items
    .map(
      (item) => `
        <li>
          <button type="button" class="ocr-item" data-text="${encodeURIComponent(item.text || '')}">
            <span>${escapeHtml(item.text || '')}</span>
            <small>${Math.round((item.confidence || 0) * 100)}%</small>
          </button>
        </li>
      `,
    )
    .join('');

  setOcrStatus(
    latestOcrText ? `OCR 完成，${items.length} 段文字，${duration} ms。` : 'OCR 完成，但沒有文字。',
    latestOcrText ? 'success' : 'warning',
  );
}

function handleOcrWorkerMessage(event) {
  const { type, data } = event.data;

  if (type === 'status') {
    setOcrStatus(data);
  } else if (type === 'result') {
    renderOcrResults(data.results, data.duration);
    elements.ocrButton.disabled = false;
  } else if (type === 'error') {
    setOcrStatus(data, 'error');
    elements.ocrButton.disabled = false;
  }
}

async function runOcr() {
  elements.ocrButton.disabled = true;
  elements.copyOcrButton.disabled = true;
  setOcrStatus('準備 OCR...');

  try {
    const canvas = getOcrCanvas();
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const worker = await initOcrWorker();

    setOcrStatus('送出 OCR 推論...');
    worker.postMessage(
      {
        type: 'recognize',
        data: {
          imageData: imageData.data,
          width: canvas.width,
          height: canvas.height,
        },
      },
      [imageData.data.buffer],
    );
  } catch (error) {
    setOcrStatus(`OCR 失敗：${error.message || error.name}`, 'error');
    elements.ocrButton.disabled = false;
  }
}

async function scanImage(file) {
  if (!file) return;

  stopCamera();
  stopImagePreview();
  resetOcrOutput();
  currentImageUrl = URL.createObjectURL(file);
  elements.imagePreview.src = currentImageUrl;
  elements.imagePreview.classList.remove('hidden');
  elements.dropText.textContent = file.name;
  setStatus('正在讀取圖片...');

  try {
    const result = await reader.decodeFromImageUrl(currentImageUrl);
    updateResult(result);
  } catch {
    setStatus('這張圖片沒有掃到可辨識的 QR Code 或條碼。', 'warning');
  }
}

function setMode(nextMode) {
  mode = nextMode;
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.panel !== mode);
  });
  elements.tabs.forEach((tab) => {
    const isActive = tab.dataset.mode === mode;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });

  if (mode === 'image') {
    stopCamera();
    setStatus('請選擇圖片來源。');
  } else {
    setStatus('可啟動相機掃描。');
  }
}

elements.tabs.forEach((tab) => {
  tab.addEventListener('click', () => setMode(tab.dataset.mode));
});

elements.startButton.addEventListener('click', startCamera);
elements.stopButton.addEventListener('click', stopCamera);
elements.cameraSelect.addEventListener('change', () => {
  if (controls) startCamera();
});

elements.imageInput.addEventListener('change', (event) => {
  scanImage(event.target.files?.[0]);
});

elements.dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  elements.dropzone.classList.add('dragging');
});

elements.dropzone.addEventListener('dragleave', () => {
  elements.dropzone.classList.remove('dragging');
});

elements.dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  elements.dropzone.classList.remove('dragging');
  scanImage(event.dataTransfer.files?.[0]);
});

elements.copyButton.addEventListener('click', async () => {
  if (!latestValue) return;
  await navigator.clipboard.writeText(latestValue);
  setStatus('已複製到剪貼簿。', 'success');
});

elements.openButton.addEventListener('click', () => {
  if (isUrl(latestValue)) {
    window.open(latestValue, '_blank', 'noopener,noreferrer');
  }
});

elements.ocrButton.addEventListener('click', runOcr);

elements.copyOcrButton.addEventListener('click', async () => {
  if (!latestOcrText) return;
  await navigator.clipboard.writeText(latestOcrText);
  setOcrStatus('已複製 OCR 文字。', 'success');
});

elements.ocrItems.addEventListener('click', async (event) => {
  const item = event.target.closest('.ocr-item');
  if (!item) return;

  const text = decodeURIComponent(item.dataset.text || '');
  if (!text) return;

  await navigator.clipboard.writeText(text);
  setOcrStatus('已複製單段 OCR 文字。', 'success');
});

elements.ocrModel.addEventListener('change', () => {
  resetOcrOutput();
  if (ocrWorker) {
    ocrWorker.terminate();
    ocrWorker = null;
  }
  ocrWorkerModel = '';
  setOcrStatus('模型已變更，下一次 OCR 會重新下載。');
});

window.addEventListener('beforeunload', () => {
  stopCamera();
  stopImagePreview();
  if (ocrWorker) ocrWorker.terminate();
});

loadCameras();
