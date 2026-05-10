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

## 安裝與開發

### 本地運行

本專案需要 HTTPS 或特定標頭支援來啟用 `SharedArrayBuffer`，建議使用以下流程：

1.  **安裝依賴**：
    ```bash
    npm install
    ```
2.  **啟動開發伺服器**：
    ```bash
    npm run dev
    ```
3.  **生產環境編譯**：
    ```bash
    npm run build
    ```

### 📱 PWA 行動裝置安裝說明

本專案已完全支援 Progressive Web App (PWA) 技術，你可以將它像原生 App 一樣安裝到手機桌面，享有全螢幕免瀏覽器邊框的沉浸式體驗！

#### **iOS (iPhone / iPad)**
1.  使用 **Safari 瀏覽器** 打開網頁。
2.  點擊下方的 **「分享」圖示** (向上箭頭的方塊)。
3.  在選單中往下滑動，點選 **「加入主畫面」 (Add to Home Screen)**。
4.  確認名稱後點擊「新增」，你的桌面上就會出現一個帶有專屬圖示的 App 囉！

#### **Android**
1.  使用 **Chrome 瀏覽器** 打開網頁。
2.  瀏覽器下方會自動跳出「將 AI Scan 新增至主畫面」的提示；若沒出現，請點擊右上角 **三個點** 選單。
3.  選擇 **「安裝應用程式」** 或 **「新增至主畫面」**。
4.  確認後便可直接在手機桌面或應用程式列表中找到它。
