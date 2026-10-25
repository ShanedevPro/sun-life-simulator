import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const draft = process.argv.includes('--draft');
const missing = [];
const fullPath = path.join(root, 'story/full-game.json');
const fullGame = await fs.stat(fullPath).then(() => true, () => false);
const story = JSON.parse(await fs.readFile(fullGame ? fullPath : path.join(root, 'story/prologue-high-school.json'), 'utf8'));
const cover = await sharp(path.join(root, 'public/title-screen.webp')).metadata();
if (cover.format !== 'webp' || !cover.width || !cover.height) throw new Error('Missing or invalid title-screen WebP.');
await fs.mkdir(path.join(root, 'public/assets'), { recursive: true });
const manifest = {};
for (const [key, asset] of Object.entries(story.assets)) {
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) throw new Error(`Invalid asset key: ${key}`);
  const approved = path.join(root, 'story/approved-assets', `${key}.webp`);
  const target = path.join(root, 'public/assets', `${key}.webp`);
  if (await fs.stat(approved).then(() => true, () => false)) {
    const image = await sharp(approved).metadata();
    if (image.format !== 'webp' || !image.width || !image.height) throw new Error(`Invalid approved WebP: ${key}`);
    await fs.copyFile(approved, target);
  } else if (!fullGame) {
    const source = path.join(root, 'story', asset.file);
    await sharp(source).webp({ quality: 84, effort: 5 }).toFile(target);
  } else if (draft) {
    missing.push(key);
  } else {
    throw new Error(`Missing approved shipping asset: story/approved-assets/${key}.webp. Review and approve the photo before building.`);
  }
  manifest[key] = { url: `assets/${key}.webp`, title: asset.title };
}
// Remove stale shipping photos so unselected work cannot leak through Vite's public copy.
for (const file of await fs.readdir(path.join(root, 'public/assets'))) {
  if (file.endsWith('.webp') && !manifest[file.slice(0, -5)]) await fs.unlink(path.join(root, 'public/assets', file));
}
const nodes = story.nodes.map(({ id, chapter, time, asset, kind, text, next, choices, speaker, speakerPlacement, routeNotice, actionLabel, caption, title, sources, decisionId, checkpoint, endingId }) =>
  ({ id, chapter, time, asset, kind, text, next, choices, speaker, speakerPlacement, routeNotice, actionLabel, caption, title, sources, decisionId, checkpoint, endingId }));
const { start, chapters, decisions, endings, sources } = story;
await fs.writeFile(path.join(root, 'src/story/content.json'), JSON.stringify({ start, chapters, decisions, endings, sources, assets: manifest, nodes }));
const bytes = await Promise.all(Object.keys(manifest).filter(k => !missing.includes(k)).map(async k => (await fs.stat(path.join(root, `public/assets/${k}.webp`))).size));
console.log(`${draft ? 'INTERNAL DRAFT — not a release. ' : ''}Prepared ${nodes.length} nodes and ${bytes.length} approved scene photos (${(bytes.reduce((a,b)=>a+b,0)/1024/1024).toFixed(2)} MB total).`);
if (draft) console.log(`Missing approved photos: ${missing.length}${missing.length ? ` (${missing.join(', ')})` : ''}. No replacement files were created.`);
