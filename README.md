# AI Scan

用 Vite 製作的 QR Code / 條碼 / OCR 掃描工具，可用相機即時掃描，也可上傳圖片掃描與辨識文字。

[Scan](https://toydogcat.github.io/ai-scan/)。

## 功能

- 相機作為圖片源，支援選擇鏡頭
- 圖片上傳或拖放作為圖片源
- 掃描 QR Code 與常見一維 / 二維條碼
- 顯示最新結果、格式、時間與掃描紀錄
- 支援複製結果與開啟網址
- OCR 文字辨識，可從目前相機畫面或上傳圖片擷取文字
- 支援複製 OCR 文字
- 透過 GitHub Actions 部署到 GitHub Pages

## OCR

目前前端使用 `paddleocr` + `onnxruntime-web` 在瀏覽器內執行 PaddleOCR ONNX 推論，適合 GitHub Pages 這種純靜態部署。第一次使用 OCR 時會從 Hugging Face 下載 det / rec 模型與字典，因此會稍慢；之後瀏覽器會快取。

參考模型來源：

- `https://huggingface.co/tobytoy/yolo_base_home/tree/main/paddle`
- `/home/toymsi/documents/Yolo/Github/ai-yolo/python`

目前內建模型：

- `PP-OCRv4 Mobile`
- `PP-OCRv4 Server`
- `PP-OCRv3`
