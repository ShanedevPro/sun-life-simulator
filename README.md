# 孙哥的模拟人生

一部可以重新选择的互动照片电影。从出生、求学到工作和创业，在重要的岔路口作出选择，再看看这段人生会走向哪里。

手机竖屏优先，包含 **120 个剧情节点、86 张场景照片、7 次主要抉择和 8 个结局**，另有一张独立的片头封面。局部回应会改变眼前的经历，完整剧情图共有 15 条可玩路径；这不代表 15 个结局。现实路线写到 **2026 年 9 月 12 日**，其他人生为虚构。

**[在线试玩](https://shanedevpro.github.io/sun-life-simulator/)** · [GitHub 源码](https://github.com/ShanedevPro/sun-life-simulator)

直接在浏览器打开即可，无需安装。2026 年 10 月 25 日已核对公开版的全部场景和 86 张照片，也可以在本机启动。本轮改了毕业照的视线、重复镜头和动作画面，具体范围与检查结果见 [画面修订记录](docs/qa/visual-fix-20261025/README.md)。

电脑端使用居中的竖屏画框，手机竖屏铺满屏幕；较矮的电脑窗口会自动收紧排版。比例修订与检查范围见 [界面检查记录](docs/qa/layout-fix-20261025/README.md)。

首页采用纪实电影海报的构图，保留开始或续读、重来和已走过的人生。右下角的 GitHub 入口可以打开仓库，喜欢这个游戏可以顺手点一颗星。画面与对白的改编说明收在「关于」里。首页改版的实际检查见 [首页检查记录](docs/qa/homepage-20261025/README.md)。

## 怎么玩

- 文字出现时轻触，先显示全文；再点继续，或作出选择。
- 暂停菜单里可以回看剧情、调整字号和字幕速度，也可以回到已经走过的抉择。
- 重选会替换当前路线后面的进度，已经发现的结局和到过的抉择会保留。
- “走过的人生”共有八个位置，抵达相应结局后才显示名字和画面。

没有人物数值、经营面板或倒计时。画面使用静态照片和短转场，目前没有配音、环境声或视频。现实路线的阅读目标为 10–15 分钟，**尚未通过真人计时验证**。

进度自动保存在当前浏览器。换浏览器、设备，或从本机切换到公开网站，进度不会自动转移。没有账号或云存档。

## 本地启动

使用 `.node-version` 固定的 **Node.js 24.19.0** 和 **pnpm 11.25.0**；项目最低要求为 Node.js 22.13。其他机器正常安装 Node/pnpm 即可，无需作者的 Codex 环境。

在项目目录运行：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

打开 [本地游戏](http://127.0.0.1:5173/)。端口固定为 5173，占用时会报错，不会悄悄换地址。桌面快捷方式也使用这个端口；先确认已经运行的是否为本游戏，避免重复启动。

作者本机也可以使用 `./scripts/run.sh dev`，该脚本会在缺少命令时尝试已有的内置运行时。手机和电脑处于同一网络时，可改用 `pnpm dev:lan`，在手机输入终端显示的网络地址；实际连通性取决于本地网络和防火墙。

## 构建与验证

```sh
pnpm check:content
pnpm test
pnpm build
pnpm preview
```

预览服务运行在 [生产预览](http://127.0.0.1:4173/)。保留这个终端，在另一个终端执行：

```sh
PLAYTEST_URL=http://127.0.0.1:4173/ pnpm test:e2e
```

浏览器测试默认使用已安装的 Google Chrome。也可以安装 Playwright Chromium 后指定通道：

```sh
pnpm exec playwright install chromium
PLAYWRIGHT_CHANNEL=chromium PLAYTEST_URL=http://127.0.0.1:4173/ pnpm test:e2e
```

实际检查结果见 [画面修订记录](docs/qa/visual-fix-20261025/README.md)；首版记录保留在 [完整交付记录](docs/qa/full-game-20261024/README.md)。自动化通过、手机视口模拟、实体设备检查和真人阅读反馈分别记录。

## 内容与工程

- [完整剧情数据](story/full-game.json)：正文、选项、章节、结局和素材键的唯一编辑源。
- [完整剧本](story/FULL_SCRIPT.md) · [完整分镜表](story/FULL_SHOT_LIST.md) · [来源与事实边界](story/SOURCES_FULL.md)。
- `story/approved-assets/` 保存审核选定的 WebP；构建将它们复制到 `public/assets/`，并生成 `src/story/content.json`。不要手工修改生成文件。编辑剧情后运行 `pnpm exec node scripts/render-full-story.mjs`，同步完整剧本和分镜表。
- `public/title-screen.webp` 是独立的无字封面；标题和菜单由真实界面呈现，不烘焙进图片。图片的许可与场景照片相同。
- Phaser 呈现照片，React 呈现文字和按钮，独立剧情模块管理进度。照片按需加载，缓存有上限。

公开源码包含构建所需的选定图片和剧情数据。全新克隆不需要作者私有的参考肖像、原始 PNG、研究下载或生成工具。缺少选定图片时，正式构建会失败，不会自动补上占位图。

当前存档键为 `sunge.life.v4`。旧 v1/v2/v3 存档会先按原剧情图校验，再迁移位置与偏好；原键保留。旧高中篇的两个完成记录只算章节经历，不会被当作完整人生结局。

## 部署与许可

部署、GitHub Pages 子路径、全新克隆验证和回滚步骤见 [Agent 部署说明](AGENT_DEPLOY.md)。仓库中已有 `.github/workflows/pages.yml`，公开试玩地址以实际发布后验证的结果为准。

代码和文档使用 [MIT 许可证](LICENSE)。图片、人物肖像与第三方资料另见 [素材说明](ASSET_TERMS.md)；第三方代码声明见 [Phaser 模板许可证](docs/licenses/phaser-template-MIT.txt)。代码开源许可不等于取得人物、学校、公司或活动的背书。

全部场景图片都是重构画面，不是历史现场原照；人物对白经过改编，平行人生为虚构。来源链接用于说明公开事件，不能将生成画面当作新闻照片或本人言论。
