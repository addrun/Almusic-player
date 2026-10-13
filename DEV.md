# Almusic Player 开发文档

项目来源与用户功能见 [README.md](README.md)，数据说明见 [docs/privacy.md](docs/privacy.md)。本仓库包含从 Zephyrus Player / AlgerMusicPlayer 继承的代码和本分支的酷狗、收藏、界面及任务栏改动。

## 环境与运行

- 建议使用 Node.js 22 LTS，至少 22.12。
- electron-vite 5 支持的 Node.js 范围为 `^20.19.0 || >=22.12.0`；原文档中的 Node.js 18 不满足当前构建工具要求。
- 使用仓库的 npm 锁文件安装依赖，勿把已安装应用中的用户数据、运行日志或本机缓存复制到源码目录。

```bash
git clone https://github.com/mysterious-shhr/Almusic-player.git
cd Almusic-player
npm ci
npm run dev
```

Web 开发使用 `npm run dev:web`，需通过本机环境文件配置 `VITE_API` 和 `VITE_API_MUSIC`。只填写自己的服务地址，环境文件不应包含公开提交的凭据。Web 模式没有 Electron 主进程，因此不能运行酷狗账号同步、桌面歌词、原生任务栏等桌面功能。

## 结构与职责

```text
src/
├── main/
│   ├── index.ts                     # Electron 生命周期与模块初始化
│   ├── kugou/                       # 酷狗协议、分页、同步、加密缓存与 IPC
│   └── modules/
│       ├── taskbar.ts               # Windows 四按钮、状态和启动就绪处理
│       └── taskbarPreview.ts        # Windows x64 原生歌曲信息卡
├── preload/                         # 主进程能力桥接
├── shared/kugou.ts                  # 酷狗 IPC 数据类型
└── renderer/
    ├── views/kugou/                 # 收藏库、歌单详情、工具栏与虚拟列表
    ├── views/search/                # 常规搜索与“用于原歌单”选版
    ├── api/
    │   ├── musicParser.ts           # 多音源解析策略与酷狗原曲优先路径
    │   └── kugouPlaybackFallback.ts # 候选搜索、有限回退与失败地址缓存
    ├── utils/
    │   ├── kugouLibraryView.ts      # 搜索、排序和本机播放次数
    │   ├── kugouPlaybackMatch.ts    # 歌名、歌手与版本匹配
    │   ├── kugouPlaybackBinding.ts  # 本机手动选版
    │   └── localFavoriteSongs.ts   # 本机跨平台单曲快照清理
    ├── services/kugouAudioRecovery.ts
    ├── components/splash/           # 开屏与动效偏好
    ├── playerStyles/                # 六种全屏样式注册
    ├── services/                    # 音频、预加载、高潮和鼓点检测
    └── store/modules/               # 播放、收藏、历史、设置等 Pinia 状态
tests/                              # 隔离回归和接口夹具
scripts/                            # 测试、品牌资源生成与辅助构建
resources/                          # 图标、桌面资源及原生组件
docs/                               # 使用说明与第三方许可
```

## 酷狗数据流程

渲染页面通过预加载桥接调用受限 IPC；主进程完成官方 HTTPS 请求、凭据管理和分页同步，只向页面返回所需的数据投影。IPC 验证调用窗口、主框架来源及参数，新模块不提供修改酷狗云端歌单的接口。

目录及曲目分页处理需区分正常空尾页、接口失败、重复页、数量差异和局部失败。不要把 `total_ver` 当作歌单数量，也不要在无法确认完整时静默丢弃旧缓存条目。

凭据和歌单缓存由 `KugouStorage` 使用 Electron `safeStorage` 保存；安全存储不可用时使用内存。退出酷狗清理该模块的账号、缓存及运行状态，但整张歌单快捷收藏等用户偏好有独立生命周期。

## 播放与选版

酷狗原曲使用其歌曲 hash 和专辑信息解析；失败后调用核对候选的备用流程。歌单原始标识不能被搜索到的另一平台 ID 静默替换。

自动匹配剥离末尾音频文件扩展名，核对歌名、已知歌手和版本词；双方有时长时再核对时长。GD 目录没有经过验证的时长字段，不应伪造原曲时长作为候选时长。

用户在搜索结果中点击“用于原歌单”才建立持久选版。这是用户主动选择，允许不同命名或上传者；保存内容限歌曲目录标识与必要元数据。修改绑定时需要取消当前解析、清理队列地址和预加载，避免继续播放旧版本。

回退地址拒绝表只在内存中保存，并有过期时间。切歌、暂停、取消和超时路径需要释放事件监听及计时器，避免迟到请求继续播放。

## Windows 任务栏

`taskbar.ts` 在 Windows 创建四个缩略图按钮。首次提交需要等待真实的 `TaskbarButtonCreated`，并在原生消息处理完成后执行；隐藏窗口后的旧就绪通知不能重新创建工具栏。

`taskbarPreview.ts` 仅在 Windows x64 加载随应用提供的 Koffi 组件，通过系统 DWM / GDI 绘制歌曲信息卡。原生组件或预览不可用时回退普通窗口预览。修改时需检查资源释放、状态更新、窗口隐藏 / 最小化 / 恢复和退出清理。

## 构建与检查

```bash
npm run build          # 主进程、预加载脚本和渲染进程
npm run build:unpack   # 解包桌面产物
npm run build:win      # Windows 安装包
npm run build:mac      # 上游保留的 macOS 构建入口
npm run build:linux    # 上游保留的 Linux 构建入口
npm run typecheck      # 全项目类型检查
npm run lint:check     # ESLint，只检查不自动修复
```

打包配置仅包含 `out`、`resources` 和 `package.json`，并解包原生模块；测试、预览和源码开发文件不属于安装包。Windows 使用默认 NSIS 安装器，构建脚本不再禁用 TLS 验证。macOS 保留所需权限配置，但本分支没有完成 macOS / Linux 安装包验收。

macOS / Linux 构建入口存在不代表本分支新增功能已经在相应系统验收。Windows 原生信息卡也不适用于其他架构。

`npm run lint` 是继承的自动修复入口，包含使用 Bun 的 i18n 检查；使用前应核对辅助脚本是否存在。`npm run format` 也会改写源码。日常只读检查使用 `npm run lint:check` 或直接对修改文件运行 ESLint，并按需要使用 `prettier --check`。

0.1.0 发布准备时，`npm run build` 通过，5 组专项类型检查和 3 组 UI 回归通过。全量检查分别运行后，Node 报告 7 项、Web 报告 186 项既有诊断。`npm run typecheck` 会在 Node 检查失败后停止，因此要了解全部现状需分别运行 `npm run typecheck:node` 和 `npm run typecheck:web`。修复或发布时应记录实际结果并区分既有与新增诊断。

## 隔离回归

安装依赖后，运行全部 10 组离线套件：

```bash
npm test
```

0.1.0 发布准备时共 147 项通过。也可分别执行：

```bash
node scripts/test-kugou.mjs
node scripts/test-kugou-catalogue.mjs
node scripts/test-preload-kugou.mjs
node scripts/test-kugou-playback-match.mjs
node scripts/test-kugou-playback-fallback.mjs
node scripts/test-kugou-playback-parser.mjs
node scripts/test-kugou-playback-binding.mjs
node scripts/test-kugou-audio-recovery.mjs
node scripts/test-local-favorites.mjs
node scripts/test-taskbar.mjs
```

这些测试复用现有 Vite / esbuild 和 Node 内置测试框架。网络及 Electron 能力由明确夹具替代，不读取使用者的账号文件，也不进行真实播放。测试产物写入 `tests/.build`。

专项类型检查配置在 `tests/tsconfig.*.json`。例如：

```bash
npx --no-install tsc --noEmit -p tests/tsconfig.kugou.json
npx --no-install tsc --noEmit -p tests/tsconfig.taskbar.json
```

部分历史 UI 预览和原生桌面检查脚本依赖隔离安装副本或本机验证目录，不是克隆仓库即可运行的通用测试。使用前需检查脚本目标，配置独立副本及独立用户目录，避免替换正式播放器文件。

真实账号扫码、歌单完整性、系统加密后的重启恢复、实际音频输出和任务栏最终外观需独立人工验收。测试证据应仅保留脱敏的状态和汇总结果。

## 发布维护

当前版本为 0.1.0，仓库为 [mysterious-shhr/Almusic-player](https://github.com/mysterious-shhr/Almusic-player)。首次发布仅提供源码，暂无预编译安装包，也没有配置自动发布工作流。

发布前核对应用名、版本、打包目标和更新源是否属于本仓库；原项目的安装包与发布地址不能当作本分支产物。安装包发布需要实际构建并核对内容、架构及运行结果，再上传到本仓库的 Releases。

公开提交应只包含源码、依赖锁文件、必要资源、文档和脱敏测试夹具。排除安装目录、备份、账号缓存、日志、带个人信息的截图、环境文件和临时构建产物。不要把一次本机测试使用的路径或个人歌单链接写入 README、示例或 issue。

保留 [LICENSE](LICENSE)、上游致谢和 [酷狗协议参考许可](src/main/kugou/NOTICE.md)。新增第三方资源时同时记录来源与许可证。
