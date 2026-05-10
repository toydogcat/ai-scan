import * as ort from 'onnxruntime-web';
import { PaddleOcrService } from 'paddleocr';


let ocrService = null;
let wasmInitialized = false;

console.log("[OCR Worker] Synchronous boot. Listening for messages...");

self.onmessage = async (event) => {
  const { type, data } = event.data;

  if (type === 'init') {
    try {
      self.postMessage({ type: 'status', data: '正在初始化執行環境...' });
      console.log("[OCR Worker] Init signal received. Starting process.");
      console.log("[OCR Worker] State: self.crossOriginIsolated =", self.crossOriginIsolated);
      console.log("[OCR Worker] State: typeof SharedArrayBuffer =", typeof SharedArrayBuffer);

      if (!wasmInitialized) {
        const publicBase = `${import.meta.env.BASE_URL}onnx-wasm/`;
        const loaderUrl = `${publicBase}ort-wasm-simd-threaded.js`;

        console.log("[OCR Worker] Fetching runtime loader from:", loaderUrl);
        const response = await fetch(loaderUrl);
        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status} downloading loader.`);
        }
        const scriptText = await response.text();
        console.log("[OCR Worker] Loader fetched. Size:", scriptText.length);

        const blobUrl = URL.createObjectURL(new Blob([scriptText], { type: 'application/javascript' }));
        console.log("[OCR Worker] Generated Blob Proxy:", blobUrl);

        ort.env.wasm.wasmPaths = {
          mjs: blobUrl,
          wasm: `${publicBase}ort-wasm-simd-threaded.wasm`,
        };
        wasmInitialized = true;
        console.log("[OCR Worker] Runtime configuration loaded.");
      }

      self.postMessage({ type: 'status', data: '正在配置 OCR 引擎...' });
      console.log("[OCR Worker] Starting configuration...");

      // Explicitly match the successful multi-thread model of ai-yolo
      ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
      console.log("[OCR Worker] Setting numThreads to:", ort.env.wasm.numThreads);

      let dict = data.dictContent.split(/\r?\n/).map((line) => line.trim());
      dict = ['', ...dict, ' '];
      console.log("[OCR Worker] Dictionary pre-processed. Length:", dict.length);

      console.log("[OCR Worker] Invoking PaddleOcrService.createInstance()...");
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
      console.log("[OCR Worker] Instance created SUCCESSFULLY!");

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
