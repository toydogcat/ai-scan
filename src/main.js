import { BarcodeFormat, BrowserCodeReader, BrowserMultiFormatReader } from '@zxing/browser';
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

let controls = null;
let currentImageUrl = '';
let lastResultKey = '';
let history = [];

document.querySelector('#app').innerHTML = `
  <main class="shell">
    <section class="hero" aria-labelledby="title">
      <div>
        <p class="eyebrow">Vite + GitHub Pages</p>
        <h1 id="title">AI Scan</h1>
        <p class="intro">用相機或圖片掃描 QR Code、EAN、UPC、Code 128、Code 39 等常見條碼。</p>
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
  dropText: document.querySelector('#dropText'),
  dropzone: document.querySelector('#dropzone'),
  historyList: document.querySelector('#historyList'),
  imageInput: document.querySelector('#imageInput'),
  imagePreview: document.querySelector('#imagePreview'),
  openButton: document.querySelector('#openButton'),
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

function setStatus(message, tone = 'neutral') {
  elements.status.textContent = message;
  elements.status.dataset.tone = tone;
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

function renderHistory() {
  elements.historyList.innerHTML = history
    .map(
      (item) => `
        <li>
          <span>${item.text}</span>
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

async function scanImage(file) {
  if (!file) return;

  stopCamera();
  stopImagePreview();
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

window.addEventListener('beforeunload', () => {
  stopCamera();
  stopImagePreview();
});

loadCameras();
