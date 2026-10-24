import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const draft = process.argv.includes('--draft');
const story = JSON.parse(await fs.readFile(path.join(root, 'story/full-game.json'), 'utf8'));
const nodes = Object.fromEntries(story.nodes.map(n => [n.id, n]));
const problems = [], warnings = [], reached = new Set(), terminal = new Set();
const demand = (ok, message) => { if (!ok) problems.push(message); };
demand(story.nodes.length === Object.keys(nodes).length, 'Duplicate scene IDs');
demand(Object.keys(story.decisions).length === 7, 'Expected seven major choices');
demand(Object.keys(story.endings).length === 8, 'Expected eight endings');
const stack = new Set();
function visit(id) {
  if (stack.has(id)) { problems.push(`Story cycle at ${id}`); return; }
  if (reached.has(id)) return;
  const n = nodes[id];
  if (!n) { problems.push(`Missing destination ${id}`); return; }
  reached.add(id); stack.add(id);
  demand(Boolean(story.chapters[n.chapter]), `Unknown chapter ${id}: ${n.chapter}`);
  demand(Array.isArray(n.text) && n.text.length > 0 && n.text.length <= 2, `Missing/long paragraph structure ${id}`);
  demand(n.text.every(t => typeof t === 'string' && t.length <= 160), `Overlong text ${id}`);
  demand(!n.text.join('').match(/待续|TODO|PLACEHOLDER|敬请期待/iu), `Unfinished text ${id}`);
  if (n.asset) demand(Boolean(story.assets[n.asset]), `Unknown asset ${id}: ${n.asset}`);
  for (const source of n.sources ?? []) demand(Boolean(story.sources[source]), `Unknown source ${id}: ${source}`);
  if (n.kind === 'ending') {
    terminal.add(n.endingId);
    demand(story.endings[n.endingId]?.nodeId === id, `Wrong ending registry ${id}`);
    demand(Boolean(n.asset), `Ending has no final photo ${id}`);
    demand(!n.next && !n.choices, `Ending has outgoing path ${id}`);
  } else if (n.choices) {
    demand(n.choices.length === 2 && new Set(n.choices.map(c => c.id)).size === 2, `Invalid choice ${id}`);
    for (const c of n.choices) { demand(Boolean(c.label), `Missing option text ${id}`); visit(c.to); }
  } else {
    demand(Boolean(n.next), `Unfinished scene ${id}`);
    if (n.next) visit(n.next);
  }
  stack.delete(id);
}
visit(story.start);
demand(reached.size === story.nodes.length, `Unreachable scenes: ${story.nodes.filter(n => !reached.has(n.id)).map(n => n.id).join(', ')}`);
demand(terminal.size === 8, 'Not all endings reachable');
for (const [id, d] of Object.entries(story.decisions)) demand(nodes[d.nodeId]?.decisionId === id && nodes[d.nodeId]?.checkpoint && nodes[d.nodeId]?.choices?.length === 2, `Invalid major decision ${id}`);
for (const [id, e] of Object.entries(story.endings)) demand(nodes[e.nodeId]?.endingId === id, `Invalid ending ${id}`);

const used = new Set(story.nodes.map(n => n.asset).filter(Boolean));
let imageBytes = 0; const missing = [];
for (const key of Object.keys(story.assets)) {
  demand(used.has(key), `Unused asset ${key}`);
  try {
    const bytes = await fs.readFile(path.join(root, 'story/approved-assets', key + '.webp'));
    demand(bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP', `Invalid image ${key}`);
    imageBytes += bytes.length;
  } catch { missing.push(key); }
}
if (missing.length) (draft ? warnings : problems).push(`Missing final images (${missing.length}): ${missing.join(', ')}`);

const routes = [];
function trace(id, trail = [], choices = []) {
  if (trail.length > story.nodes.length) return;
  const n = nodes[id]; if (!n) return;
  const nextTrail = [...trail, id];
  if (n.kind === 'ending') { routes.push({ ending: n.endingId, trail: nextTrail, choices }); return; }
  if (n.choices) for (const c of n.choices) trace(c.to, nextTrail, [...choices, { nodeId: id, choiceId: c.id }]);
  else if (n.next) trace(n.next, nextTrail, choices);
}
if (!problems.some(p => p.includes('cycle'))) trace(story.start);
const result = { status: problems.length ? 'failed' : draft ? 'draft-graph-valid' : 'passed', nodes: story.nodes.length, photos: Object.keys(story.assets).length, imageBytes, decisions: Object.keys(story.decisions).length, endings: [...terminal], playablePaths: routes.length, longestPath: Math.max(0, ...routes.map(r => r.trail.length)), problems, warnings };
console.log(JSON.stringify(result, null, 2));
if (process.argv.includes('--report')) {
  const folder = path.join(root, 'docs/qa/full-game-20261024'); await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, 'content-check.json'), JSON.stringify(result, null, 2) + '\n');
  await fs.writeFile(path.join(folder, 'route-paths.json'), JSON.stringify(routes, null, 2) + '\n');
}
if (problems.length) process.exitCode = 1;
