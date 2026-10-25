# Agent 部署说明

更新：2026-10-25。本文对应完整游戏：120 个剧情节点、86 张照片、7 次主要抉择、8 个结局和 15 条完整路径。现实路线截至 2026 年 9 月 12 日。目标阅读时长为 10–15 分钟，尚未真人计时；本轮画面修订与检查范围见 [画面修订记录](docs/qa/visual-fix-20261025/README.md)，首版记录见 [完整交付记录](docs/qa/full-game-20261024/README.md)。

**[在线试玩](https://shanedevpro.github.io/sun-life-simulator/)** · [公开仓库](https://github.com/ShanedevPro/sun-life-simulator)

当前画面修订版于 2026-10-25 完成实际 HTTPS 检查。网站代码来自提交 `b9b4e62d060ffac78ca159d94d81c21b44b0d20d`；[发布工作流](https://github.com/ShanedevPro/sun-life-simulator/actions/runs/40170707482) 成功。86 张图片、编译后的运行文件及全部场景已在线核对。后续文档提交只补充验收结果，具体证据见画面修订记录。

## 1. 接手时先确认

在项目根目录检查工具、实际仓库和工作区：

```sh
pwd
git status --short --branch
git remote -v
node --version
pnpm --version
```

固定环境：`.node-version` 为 Node.js **24.19.0**，`packageManager` 为 **pnpm 11.25.0**；最低 Node.js 要求为 22.13。其他机器使用正常安装的工具，不依赖作者的私有目录。`pnpm-workspace.yaml` 已允许 esbuild、sharp 的安装构建；不要通过升级依赖或关闭检查来绕过安装问题。

遵守当前 AGENTS.md。作者使用外置工作盘时，先完成该机器要求的存储检查；卷不可用时，不要自动迁移、创建同名空目录或重新下载环境来替代。

检查失败不等于获准覆盖文件。已有仓库先确认远端、分支和未提交改动；首次发布从审核后的公开源码包开始，不要直接上传整个制作工作区。

## 2. 本地启动和验证

```sh
pnpm install --frozen-lockfile
pnpm check:content
pnpm test
pnpm build
pnpm preview
```

预览终端保持运行，地址为 `http://127.0.0.1:4173/`。另开终端：

```sh
PLAYTEST_URL=http://127.0.0.1:4173/ pnpm test:e2e
```

默认使用已安装的 Google Chrome。没有 Chrome 的机器可以显式安装 Chromium：

```sh
pnpm exec playwright install chromium
PLAYWRIGHT_CHANNEL=chromium PLAYTEST_URL=http://127.0.0.1:4173/ pnpm test:e2e
```

CI 使用 `pnpm exec playwright install --with-deps chromium` 安装浏览器和 Linux 系统依赖。本机已有浏览器环境时，不必重复安装；不要随意更改共享缓存路径。

开发使用 `pnpm dev`，只监听本机 5173；同网手机调试使用 `pnpm dev:lan`。5173 也可能运行桌面快捷方式启动的静态服务，先识别监听进程，复用正确服务或明确选择预览地址，不要终止无关进程。`pnpm preview` 仅用于本地检查，公开托管上传 `dist`。

`./scripts/run.sh` 是作者环境的可选命令包装；普通机器直接运行 pnpm。桌面快捷方式读取已有的 `dist`，更新源码后需要重新构建。

## 3. 内容、素材和干净构建

唯一剧情源是 [story/full-game.json](story/full-game.json)。[完整剧本](story/FULL_SCRIPT.md)、[分镜表](story/FULL_SHOT_LIST.md)、[来源记录](story/SOURCES_FULL.md) 随内容同步；编辑后执行 `pnpm exec node scripts/render-full-story.mjs` 从唯一剧情源重新生成。

`pnpm assets` 和 `pnpm build` 从 `story/approved-assets/<素材键>.webp` 读取选定图片，生成 `public/assets/` 和 `src/story/content.json`。正式构建要求图片齐全；不会调用生图服务、读取私有肖像或用旧图偷偷替代缺失素材。公开源码必须包含全部选定 WebP、剧情源、旧版本迁移图、锁文件、运行代码、测试、配置和许可文件。

全新克隆验收要在新目录执行上述安装、内容检查、测试和构建，确认不依赖原工作区的生成文件或未发布 PNG。不要只在长期使用的 `node_modules` 和 `public/assets` 上声称可复现。

仅在内部检查未完成制作稿时，可以显式运行：

```sh
pnpm exec node scripts/prepare-assets.mjs --draft
pnpm exec node scripts/check-content.mjs --draft
```

草稿模式列出缺失图片，不伪造替代文件。它不是发布检查，正式流程不得加 `--draft`。

发布前分别检查：

- **公开源码**：排除私有参考肖像、研究下载、原始和未选 PNG、角色参考、原始生成记录、日志、凭证和 QA 录像；保留选定 WebP 及必要文档。`.gitignore` 无法清除已经发布的历史。
- **网站产物 `dist`**：只应包含可运行游戏、编译后的剧情和选定场景资产。检查 `public` 是否混入制作资料。
- **来源与许可**：保留 [MIT](LICENSE)、[素材说明](ASSET_TERMS.md) 和 [第三方代码声明](docs/licenses/phaser-template-MIT.txt)。图片为生成重构，不把代码 MIT 许可扩展解释为人物或商标授权。

## 4. GitHub Pages 子路径

已实现 `GAME_BASE_PATH`，Vite、运行时照片、片头预加载和菜单图片会使用同一基础路径。仓库站点使用 `/sun-life-simulator/`，用户主页站点或根域名使用 `/`。改名或自定义域名时同步配置并验证。

本地检查实际 Pages 路径：

```sh
GAME_BASE_PATH=/sun-life-simulator/ pnpm build
GAME_BASE_PATH=/sun-life-simulator/ pnpm preview
```

另一个终端执行：

```sh
PLAYTEST_URL=http://127.0.0.1:4173/sun-life-simulator/ pnpm test:e2e
```

浏览器打开 `http://127.0.0.1:4173/sun-life-simulator/`。测试入口支持带子路径的 `PLAYTEST_URL`，不要退回站点根路径测试来掩盖资源错误。检查片头、分支图、重选缩略图、收藏图片和刷新后的网络请求。

本机桌面快捷方式使用根路径。结束子路径测试后，停止预览服务，执行 `pnpm build` 重新生成默认 `/` 版本；必要时先清除终端中显式导出的 `GAME_BASE_PATH`。

## 5. 首次创建仓库并发布

如果部署的是自己的 fork，把下列命令中的 `ShanedevPro/sun-life-simulator` 换成实际的 `OWNER/REPOSITORY`。仓库改名时，预览基础路径也改为 `/<实际仓库名>/`；线上地址从自己仓库的 Pages 配置读取。

以下是明确执行发布任务时的步骤，不是只读检查。本文示例仓库为 `ShanedevPro/sun-life-simulator`；执行前确认账号、名称和已经审核的公开目录。先用 `gh auth status` 检查连接，不输出令牌。

如果远端尚不存在、公开目录尚未初始化 Git，才在该目录执行：

```sh
git init -b main
git add .
git diff --cached --stat
git status --short
```

审查完整暂存文件清单，确认没有私有资料后，再提交并创建远端：

```sh
git commit -m "Release complete interactive life game"
gh repo create ShanedevPro/sun-life-simulator --public --source=. --remote=origin --push
```

已有远端时跳过创建步骤，检查后正常推送。不要重复初始化或覆盖现有 `origin`。`gh repo create` 的参数说明见 [GitHub CLI 官方文档](https://cli.github.com/manual/gh_repo_create)。

将 Pages 发布来源设为 GitHub Actions，可在仓库 Settings → Pages 选择，或使用有相应权限的账号执行：

```sh
gh api --method POST repos/ShanedevPro/sun-life-simulator/pages -f build_type=workflow
```

若 Pages 已存在，先读取配置；需要修改时使用同一端点的 `PUT`，不要把任意失败都当成未创建。参数和权限见 [GitHub Pages 官方 API](https://docs.github.com/en/rest/pages/pages#create-a-github-pages-site)。

现有工作流为 `.github/workflows/pages.yml`，在推送 `main` 或手动触发时：

1. 从 `.node-version` 和 `packageManager` 安装固定版本工具，按锁文件安装依赖。
2. 执行内容检查、状态测试和正式构建；基础路径取 `/<当前仓库名>/`。
3. 安装 Chromium，在 4173 的仓库子路径运行生产浏览器测试。
4. 用官方 Pages Actions 上传 `dist` 并发布到 `github-pages` 环境。

工作流权限为 `contents: read`、`pages: write`、`id-token: write`，同一 Pages 部署使用并发组。当前触发分支写为 `main`；若实际默认分支不同，先修改工作流与部署约定，不能只推到另一个分支后等待自动发布。

配置完成后可手动触发并查询：

```sh
gh workflow run pages.yml --repo ShanedevPro/sun-life-simulator --ref main
gh run list --repo ShanedevPro/sun-life-simulator --workflow pages.yml --limit 5
gh api repos/ShanedevPro/sun-life-simulator/pages --jq .html_url
```

取得真实运行编号后，用 `gh run watch <运行编号> --repo ShanedevPro/sun-life-simulator --exit-status` 查看结果。工作流成功后仍需打开 API 返回的 HTTPS 地址验收。只有确认页面和实际路线正常后，才将真实 URL、源码提交和检查记录写入 README 与交付记录。

## 6. 存档与上线验收

存档键为 `sunge.life.v4`，保存当前路线、已到达抉择的选择前快照、发现的结局、章节经历与阅读偏好。回到某个抉择会替换当前路线的后续进度；已发现结局和到过的其他抉择保留。回看只显示当前这一轮经历。

v1/v2/v3 存档先按各自冻结的旧图验证，再迁移到 v4；保留原位置、字号和可用偏好，并保留原键。旧 `U01`、`B1_01` 只算高中篇经历，不解锁成年人结局。不要通过清空 localStorage 修复迁移问题。

存档属于当前浏览器与来源地址。本机、GitHub Pages、其他设备和其他浏览器之间不自动同步；没有账号、云端存档或自动跨站迁移。更换域名时要先说明进度隔离，不承诺自动搬迁。

在线检查至少记录：

- 全新访客能开始；片头照片、字幕、第一步操作无路径错误。
- 8 个结局和 15 条完整路径可达，章节回顾会继续，章节出口不算人生结局。
- 暂停、回看、重选、结局收藏、字号、渐显/直接、刷新续读正常。
- 正常转场不闪加载字；慢图保留上一幕，延迟提示，失败可重试；迟到图片不能替换新场景。
- 手机竖屏、短屏、大字号与横屏可读。模拟视口和真实 iOS Safari/Android 分别记录，未执行的检查不写成通过。
- 长路线和重玩后图片缓存仍有上限，不会提前下载整部游戏。

仅凭构建成功或工作流绿色，不能声称影像与字幕匹配、年代正确或游戏好玩；这些需要分镜对照、实际画面审查和用户体验记录。当前没有音频、视频或在线生成接口。

## 7. 更新、故障与回滚

更新前检查真实远端、分支、工作区及当前线上提交。完成必要检查后正常提交和推送；工作流负责构建发布。记录最后正常的提交和线上地址。

| 现象 | 先检查 |
| --- | --- |
| 5173/4173 被占用 | 监听进程及其目录，确认是否为本游戏，不要终止无关服务 |
| 缺少图片 | 完整剧情资产键与 `story/approved-assets/`，不要换成未经审核的图 |
| Pages 白屏或照片缺失 | 构建基础路径、预加载、实际访问子路径、产物中的请求地址 |
| 原生依赖安装失败 | Node/pnpm 版本、锁文件和 `pnpm-workspace.yaml`，不要随意升级 |
| 工作流失败 | 失败步骤日志、Pages 来源、环境权限和分支，不反复推送相同内容 |
| 出现旧内容 | 线上提交、工作流产物和浏览器请求，区分旧本地服务与线上网站 |
| 进度看似丢失 | 浏览器、协议/域名/端口和存档版本，先保留数据再排查 |

回滚优先使用 `git revert <有问题的提交>`，通过正常历史产生修复提交并让工作流重新发布。也可在已审查的发布流程中部署已知正常版本，但不要强制推送或重置共享历史。

选择回滚版本时注意存档兼容：v4 之前的代码可能无法读取新进度。不要删除 v4 或旧键来让旧页面看起来正常。回滚后再次验证实际地址、资源和续读，并记录采用的提交及结果。
