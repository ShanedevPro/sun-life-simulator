import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const story = JSON.parse(await fs.readFile(path.join(root, 'story/full-game.json'), 'utf8'));
const date = process.env.STORY_REVIEW_DATE ?? new Date().toISOString().slice(0, 10);
const count = Object.keys(story.assets).length;
const intro = `${date} · ${story.nodes.length} 个节点、${count} 张选定照片。历史截止 ${story.historicalCutoff}。本文由 full-game.json 生成；逐图、连续镜头和实际界面审查见对应 QA 记录。\n\n`;
const copy = node => [...node.text, ...(node.caption ? [node.caption] : [])];
const destination = node => node.choices
  ? node.choices.map(choice => `${choice.label} → ${choice.to}`).join(' / ')
  : node.next ?? `人生结局 ${node.endingId}`;
const blocks = story.nodes.map(node => `## ${node.id} · ${node.chapter} · ${node.time}\n类型：${node.kind}；照片：${node.asset ?? '黑场'}；证据：${node.evidence ?? '创作'}\n\n${node.speaker ? `${node.speaker}\n\n` : ''}${copy(node).join('\n')}\n${node.choices ? '选择' : '去向'}：${destination(node)}\n来源：${node.sources?.join(', ') || '创作'}\n`);
await fs.writeFile(path.join(root, 'story/FULL_SCRIPT.md'), '# 全篇分镜剧本\n\n' + intro + '玩家正文为第二人称；对白、具体场景与平行人生为改编，不作为真人原话。\n\n' + blocks.join('\n'));
const cell = text => String(text ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const rows = story.nodes.map(node => `| ${[node.id, `${node.time} / ${node.chapter}`, copy(node).join(' / '), node.shot, node.asset ?? 'DOM 黑场', `${node.sources?.join(',') ?? ''} ${node.classification ?? ''}`, destination(node)].map(cell).join(' | ')} |`).join('\n');
const assets = Object.entries(story.assets).map(([key, asset]) => {
  const first = story.nodes.find(node => node.asset === key);
  return `### ${key} · ${asset.title}\n\n${asset.selectedShot ?? asset.shot ?? first.shot}\n\n时间：${asset.year ?? first.time}${asset.location ? `；地点：${asset.location}` : ''}。\n使用节点：${asset.uses.join(', ')}。复用理由：${asset.reuseReason}\n审片记录：${asset.reviewStatus}。\n`;
}).join('\n');
await fs.writeFile(path.join(root, 'story/FULL_SHOT_LIST.md'), '# 全篇逐镜制作表\n\n' + intro + '| 节点 | 时间地点/章节 | 正文 | 镜头与动作 | 图像 | 来源/属性 | 去向 |\n|---|---|---|---|---|---|---|\n' + rows + '\n\n## 选定照片与复用理由\n\n' + assets);
console.log(`Rendered ${story.nodes.length} nodes and ${count} selected photos from canonical story.`);
