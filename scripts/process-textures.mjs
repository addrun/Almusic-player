/**
 * 图片纹理处理脚本（sharp 版）
 *
 * 将素材图片处理为：去饱和（灰度）+ 半透明 PNG 纹理
 * 用于诡谲模式的"报纸滤镜效果"
 *
 * 用法: node scripts/process-textures.mjs <图片1> [图片2 ...]
 */
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// 输入素材由使用者指定，仓库不保存开发者的个人文件路径。
const inputFiles = process.argv.slice(2);
if (inputFiles.length === 0) {
  console.error('用法: node scripts/process-textures.mjs <图片1> [图片2 ...]');
  process.exit(1);
}

// 输出目录
const outputDir = join(projectRoot, 'src', 'renderer', 'assets', 'textures', 'newspaper');

// 确保输出目录存在
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// 处理参数
const OPACITY = 0.35; // 最大不透明度（0-1），暗部像素的上限
const TARGET_WIDTH = 800; // 目标宽度（缩放，保持比例）

async function processImage(inputPath, index) {
  try {
    console.log(`[${index + 1}/${inputFiles.length}] 处理: ${basename(inputPath)}`);

    // 读取图片元数据
    const metadata = await sharp(inputPath).metadata();
    console.log(`  原始: ${metadata.width}×${metadata.height} ${metadata.format}`);

    // 处理图片：
    // 1. 缩放到目标宽度
    // 2. 去饱和（grayscale）
    // 3. 调整对比度和亮度
    // 4. 合成半透明 alpha 层
    const processed = await sharp(inputPath)
      .resize({ width: TARGET_WIDTH, fit: 'inside', withoutEnlargement: true })
      .grayscale() // 去饱和
      .modulate({ brightness: 0.85 }) // 略微压暗
      .linear(1.15, -0.1) // 增强对比度（gain=1.15, bias=-0.1）
      .png()
      .toBuffer();

    // 读取处理后的图片，手动设置 alpha 通道
    const { data, info } = await sharp(processed).raw().toBuffer({ resolveWithObject: true });

    const channels = info.channels;
    const pixelCount = data.length / channels;

    // 生成 RGBA 数据：白色扣透明 + 半透明
    // 灰度图 R=G=B=value，亮度越高（越白）alpha 越低
    // alpha = (255 - value) / 255 * MAX_ALPHA
    const newData = Buffer.alloc(pixelCount * 4);
    const maxAlpha = Math.round(255 * OPACITY);

    if (channels === 4) {
      // 已有 alpha，用 RGB 值重新计算
      for (let i = 0, j = 0; i < data.length; i += 4, j += 4) {
        const gray = data[i]; // R=G=B after grayscale
        newData[j] = gray;
        newData[j + 1] = gray;
        newData[j + 2] = gray;
        // 白色(255)→alpha=0  黑色(0)→alpha=maxAlpha
        newData[j + 3] = Math.round(((255 - gray) / 255) * maxAlpha);
      }
    } else if (channels === 3) {
      // 无 alpha 通道
      for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
        const gray = data[i];
        newData[j] = gray;
        newData[j + 1] = gray;
        newData[j + 2] = gray;
        newData[j + 3] = Math.round(((255 - gray) / 255) * maxAlpha);
      }
    }

    // 保存
    const outputName = `newspaper-${String(index + 1).padStart(2, '0')}.png`;
    const outputPath = join(outputDir, outputName);

    await sharp(newData, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4
      }
    })
      .png()
      .toFile(outputPath);

    console.log(
      `  ✓ 已保存: ${outputName} (${info.width}×${info.height}, 白扣透明+maxOpacity=${OPACITY})`
    );
    return outputPath;
  } catch (err) {
    console.error(`  ✗ 处理失败: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('=== 纹理处理脚本 (sharp) ===');
  console.log(`输出目录: ${outputDir}`);
  console.log(`参数: 去饱和 + ${Math.round(OPACITY * 100)}% 不透明度 + 对比度增强\n`);

  const results = [];
  for (let i = 0; i < inputFiles.length; i++) {
    const result = await processImage(inputFiles[i], i);
    if (result) results.push(result);
  }

  console.log(`\n=== 完成 ===`);
  console.log(`成功处理 ${results.length}/${inputFiles.length} 张图片`);
  console.log(`输出文件:`);
  results.forEach((f) => console.log(`  ${basename(f)}`));

  // 生成纹理清单 JSON
  const manifest = {
    name: 'newspaper',
    description: '报纸纹理素材 - 去饱和半透明',
    textures: results.map((f, i) => ({
      id: `newspaper-${String(i + 1).padStart(2, '0')}`,
      src: `assets/textures/newspaper/${basename(f)}`,
      duration: 500 // 每张显示 500ms
    }))
  };

  const manifestPath = join(outputDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`\n清单已生成: ${manifestPath}`);
}

main().catch(console.error);
