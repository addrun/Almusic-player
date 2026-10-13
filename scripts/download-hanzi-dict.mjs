/**
 * 下载 makemeahanzi 笔画字典
 *
 * 数据源：https://github.com/skishore/makemeahanzi
 * 格式：每行一个 JSON 对象 {"character": "你", "strokes": [...]}
 *
 * 用法: node scripts/download-hanzi-dict.mjs
 */
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const outputDir = join(projectRoot, 'src', 'renderer', 'lib', 'hanziStrokes');
const outputFile = join(outputDir, 'dictionary.json');

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

async function tryFetch(urls) {
  for (const url of urls) {
    console.log(`尝试: ${url}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      console.log(`✓ 下载成功，${text.length} 字节`);
      return text;
    } catch (err) {
      console.log(`  失败: ${err.message}`);
    }
  }
  return null;
}

async function main() {
  console.log('=== 下载 makemeahanzi 笔画字典 ===\n');

  const urls = [
    'https://ghp.ci/https://raw.githubusercontent.com/skishore/makemeahanzi/master/graphics.txt',
    'https://ghproxy.net/https://raw.githubusercontent.com/skishore/makemeahanzi/master/graphics.txt',
    'https://mirror.ghproxy.com/https://raw.githubusercontent.com/skishore/makemeahanzi/master/graphics.txt',
    'https://raw.gitmirror.com/skishore/makemeahanzi/master/graphics.txt',
    'https://raw.githubusercontent.com/skishore/makemeahanzi/master/graphics.txt',
  ];

  const text = await tryFetch(urls);

  if (!text) {
    console.log('\n降级：生成空字典，霓虹模式将降级为纯文字渲染');
    writeFileSync(outputFile, '{}', 'utf-8');
    console.log(`已保存: ${outputFile}`);
    return;
  }

  const dictionary = {};
  const lines = text.trim().split('\n');
  console.log(`共 ${lines.length} 行`);

  let count = 0;
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.character && Array.isArray(obj.strokes)) {
        dictionary[obj.character] = obj.strokes;
        count++;
      }
    } catch { /* skip */ }
  }

  console.log(`解析成功 ${count} 字`);

  const jsonStr = JSON.stringify(dictionary);
  writeFileSync(outputFile, jsonStr, 'utf-8');
  console.log(`已保存: ${outputFile} (${(jsonStr.length / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`\n=== 完成 ===`);
}

main().catch(console.error);
