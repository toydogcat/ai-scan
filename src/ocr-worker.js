import * as ort from 'onnxruntime-web';
import { PaddleOcrService } from 'paddleocr';

const publicBase = `${import.meta.env.BASE_URL}onnx-wasm/`;
const loaderUrl = `${publicBase}ort-wasm-simd-threaded.js`;

const response = await fetch(loaderUrl);
if (!response.ok) {
  throw new Error(`ONNX Runtime loader 讀取失敗：${response.status}`);
}
const scriptText = await response.text();
const blobUrl = URL.createObjectURL(new Blob([scriptText], { type: 'application/javascript' }));

ort.env.wasm.wasmPaths = {
  mjs: blobUrl,
  wasm: `${publicBase}ort-wasm-simd-threaded.wasm`,
};
ort.env.wasm.numThreads = 1;

let ocrService = null;

self.onmessage = async (event) => {
  const { type, data } = event.data;

  if (type === 'init') {
    try {
      self.postMessage({ type: 'status', data: '正在載入 OCR 模型...' });

      let dict = data.dictContent.split(/\r?\n/).map((line) => line.trim());
      dict = ['', ...dict, ' '];

      ocrService = await PaddleOcrService.createInstance({
        ort,
        detection: {
          modelBuffer: data.detBuffer,
          minimumAreaThreshold: 24,
          textPixelThreshold: 0.6,
        },
        recognition: {
          modelBuffer: data.recBuffer,
          charactersDictionary: dict,
        },
      });

      self.postMessage({ type: 'initialized' });
    } catch (error) {
      self.postMessage({ type: 'error', data: `OCR 初始化失敗：${error.message}` });
    }

    return;
  }

  if (type === 'recognize') {
    if (!ocrService) {
      self.postMessage({ type: 'error', data: 'OCR 尚未初始化' });
      return;
    }

    try {
      self.postMessage({ type: 'status', data: '正在偵測文字...' });
      const startedAt = performance.now();
      const results = await ocrService.recognize(
        {
          data: data.imageData,
          width: data.width,
          height: data.height,
        },
        {
          onProgress(event) {
            if (event.type === 'det') {
              self.postMessage({ type: 'status', data: `正在偵測文字 ${event.stage}` });
            } else if (event.type === 'rec' && event.stage === 'start') {
              self.postMessage({ type: 'status', data: '正在辨識文字...' });
            }
          },
        },
      );

      self.postMessage({
        type: 'result',
        data: {
          duration: Math.round(performance.now() - startedAt),
          results,
        },
      });
    } catch (error) {
      self.postMessage({ type: 'error', data: `OCR 辨識失敗：${error.message}` });
    }
  }
};
