import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, 'node_modules/onnxruntime-web/dist');
const dstDir = path.join(__dirname, 'public/onnx-wasm');

console.log('Preparing ONNX Runtime WASM files...');

if (!fs.existsSync(dstDir)) {
  fs.mkdirSync(dstDir, { recursive: true });
}

const files = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.jsep.mjs',
];

for (const file of files) {
  const src = path.join(srcDir, file);
  const dst = path.join(dstDir, file);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log(`Copied ${file}`);
  }
}

for (const file of fs.readdirSync(dstDir)) {
  if (!file.endsWith('.mjs')) continue;

  const filePath = path.join(dstDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(
    /if\s*\(isNode\)\s*isPthread\s*=\s*\(await\s*import\('worker_threads'\)\)\.workerData\s*===\s*'em-pthread';/,
    'if (false) {}',
  );
  content = content.replace(/await\s*import\("module"\)/g, 'null');
  content = content.replace(/import\("module"\)/g, 'null');
  content = content.replace(/import\('worker_threads'\)/g, 'null');

  const finalPath = path.join(dstDir, file.replace('.mjs', '.js'));
  fs.writeFileSync(finalPath, content, 'utf8');
  fs.unlinkSync(filePath);
  console.log(`Patched ${path.basename(finalPath)}`);
}

console.log('ONNX Runtime WASM files are ready.');
