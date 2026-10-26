# 开发与维护

[游戏介绍](../README.md) · [部署与回退](../AGENT_DEPLOY.md) · [完整剧本](../story/FULL_SCRIPT.md) · [分镜表](../story/FULL_SHOT_LIST.md) · [事件来源](../story/SOURCES_FULL.md)

## 本地运行

使用 Node.js 24.19.0 和 pnpm 11.25.0，按锁文件安装：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

打开 `http://127.0.0.1:5173/`。同网手机调试用 `pnpm dev:lan`；其他机器直接使用自己的 Node 和 pnpm，不需要作者的私有环境。

## 改剧情和图片

唯一剧情源是 `story/full-game.json`。正文、对白、选项、分镜、来源和图片键都在这里。修改后运行：

```sh
pnpm exec node scripts/render-full-story.mjs
pnpm check:content
```

`story/approved-assets/` 只放选定的 WebP。构建会生成 `public/assets/` 和 `src/story/content.json`，不要手改生成文件。缺图会使正式构建失败；不会自动生成图片，也不会用旧图代替。

每幅新图都先核对时间、地点、年龄、动作，再连同前后镜头检查，最后看手机中的裁切和字幕。合理的连续镜头可以共用照片；跨年、不同动作或不同人物不能只靠一张图硬接。生成画面是重构，不能当作历史原照。

Phaser 显示照片，React 显示字幕与菜单，剧情模块管理选择和存档。照片按需加载，缓存有上限。局部选择可以影响后面的文字，使用已有选择记录，不另加人物数值。

## 检查

```sh
pnpm test
pnpm build
pnpm preview
```

保留预览服务，另开终端：

```sh
PLAYTEST_URL=http://127.0.0.1:4173/ pnpm test:e2e
```

默认使用已安装的 Google Chrome。没有 Chrome 时，安装 Playwright Chromium 并指定通道：

```sh
pnpm exec playwright install chromium
PLAYWRIGHT_CHANNEL=chromium PLAYTEST_URL=http://127.0.0.1:4173/ pnpm test:e2e
```

浏览器检查使用稳定的生产预览，避免开发热更新打断路线。需要分别记录所有结局、旧存档、暂停与重选、慢图与失败重试、手机布局以及实际图片与字幕是否相符。自动化通过不等于真人阅读顺畅，也不代表实体手机已测试。

## 进度和重玩

当前存档键为 `sunge.life.v4`，进度自动保存在当前浏览器。v1/v2/v3 先按各自的旧剧情图验证，再迁移位置和偏好，原键保留。不要通过清空 localStorage 修复迁移问题。

重选会替换当前路线后面的经历；发现过的结局和到过的主要选择保留。已经发布的节点和选项 ID 关系到旧进度，改动前需考虑兼容。不同设备、浏览器和网站地址之间不会自动同步。

## 发布

公开源码只包含运行代码、选定的图片、必要文档和许可。私有参考肖像、原始生成文件、研究下载和制作记录保留在制作工作区。部署基础路径、干净克隆检查、工作流和回退步骤见 [Agent 部署说明](../AGENT_DEPLOY.md)。

代码和文档使用 [MIT](../LICENSE)，图片另见 [素材说明](../ASSET_TERMS.md)。
