# Almusic Player v0.1.5

本版修复 Windows 图标显示与更新安装目录问题。项目基于 [Zephyrus Player](https://github.com/cang-dot/zephyrus-player) / [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer)，保留原有音乐和歌词能力，以及酷狗云端歌单同步、收藏管理与 Windows 任务栏控制。

## 本版改动

- 扩大图标底板和唱片图案的占比，保留浅米白色；调整小尺寸图案，并提供 16–256 像素的九尺寸 Windows ICO。
- Windows 主窗口与安装器使用一致的应用标识，固定到任务栏时明确指定外置 ICO，减少固定前后图标不一致的问题。
- Windows 托盘使用多尺寸 ICO，让系统按显示缩放选择合适图像，避免固定拉伸 16 像素图标。
- 0.1.5 应用内后续更新以当前程序目录为目标，下载后退出不会自动安装；明确点击安装后才启动安装器。安装前检查已知源码与备份目录标记，避免普通更新删除这些文件。
- 用户数据目录选择保持原有规则，沿用已有账号、歌单和设置目录。

## 下载与安装

- 大多数 Windows 电脑选择 `Almusic-0.1.5-win-x64.exe`；32 位和 ARM64 电脑选择对应 `ia32` / `arm64` 文件。
- macOS Intel 选择 `mac-x64.dmg`，Apple Silicon 选择 `mac-arm64.dmg`；也提供 ZIP。
- Linux x64 / ARM64 提供 AppImage、DEB 和 RPM，按系统与架构选择。
- `.blockmap`、`latest*.yml` 供自动更新使用；`SHA256SUMS.txt` 用于核对下载文件，`RELEASE-MANIFEST.json` 记录构建来源。Source code 是源码归档。

Windows 手动安装器提供安装目录选择。新版本修复不会反向改变旧版更新器启动安装器的参数；从未修补的旧版本升级且需要选择目录时，请完全退出播放器，再下载新安装器手动更新。已有固定快捷方式若仍显示旧图标，可在打开新版本后取消固定并重新固定。

## 验证与发布范围

- 本地生产构建通过；13 组隔离回归共 174 项通过，包含任务栏身份 / 图标资源 5 项和更新安装 18 项。
- 发布资源、构建配置和锁定更新器检查共 22 项通过，打包资源隐私夹具 27 项通过。
- 七个平台与架构从同一标签构建，全部完成回归、实际打包资源检查和更新清单校验后才汇总发布。可下载文件以本 Release 的 Assets 为准。
- 全量 Node 类型检查仍有 7 项既有诊断；上述验证不等于全部平台的实机播放、真实账号或桌面显示验收。

Windows 和 macOS 安装包未做商业代码签名，macOS 未经 Apple 公证。v0.1.4 标签与资产保留，本版使用新的 v0.1.5 标签。

项目地址：[mysterious-shhr/Almusic-player](https://github.com/mysterious-shhr/Almusic-player)。数据处理范围见 [隐私说明](docs/privacy.md)，详细测试记录见 [验证记录](docs/verification.md)。
