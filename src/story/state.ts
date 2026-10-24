import { nodes, startId, isExit, decisions, endings, type EndingId } from './data';
import legacyV1 from './legacy-v1.json';
import legacyV2 from './legacy-v2.json';
import legacyV3 from './legacy-v3.json';

export type Decision = { nodeId: string; choiceId: string };
export type Progress = { nodeId: string; trail: string[]; decisions: Decision[] };
export type Save = { version: 4; progress: Progress; checkpoints: Record<string, Progress>; completed: EndingId[]; chapterOutcomes: string[]; fontSize: 'standard' | 'large'; textDisplay: 'animated' | 'instant' };
const cloneProgress = (p: Progress): Progress => ({ nodeId: p.nodeId, trail: [...p.trail], decisions: p.decisions.map(d => ({ ...d })) });
export const newSave = (previous?: Save): Save => ({
  version: 4, progress: { nodeId: startId, trail: [startId], decisions: [] },
  checkpoints: Object.fromEntries(Object.entries(previous?.checkpoints ?? {}).map(([id, p]) => [id, cloneProgress(p)])),
  completed: [...(previous?.completed ?? [])], chapterOutcomes: [...(previous?.chapterOutcomes ?? [])],
  fontSize: previous?.fontSize ?? 'standard', textDisplay: previous?.textDisplay ?? 'animated',
});
const milestone = (id: string) => nodes[id]?.kind === 'chapter-end' || ['U01', 'B1_01'].includes(id);
export function advance(save: Save, expectedNode: string, choiceId?: string): Save {
  const p = save.progress;
  if (p.nodeId !== expectedNode || isExit(p.nodeId)) return save;
  const node = nodes[p.nodeId];
  if (!node) return save;
  const choice = node.choices?.find(c => c.id === choiceId);
  const next = node.choices ? choice?.to : choiceId === undefined ? node.next : undefined;
  if (!next || !nodes[next] || p.trail.includes(next)) return save;
  const progress: Progress = { nodeId: next, trail: [...p.trail, next], decisions: choice ? [...p.decisions, { nodeId: node.id, choiceId: choice.id }] : [...p.decisions] };
  const checkpointId = nodes[next].decisionId;
  const endingId = nodes[next].endingId;
  return { ...save, progress,
    checkpoints: checkpointId ? { ...save.checkpoints, [checkpointId]: cloneProgress(progress) } : save.checkpoints,
    completed: endingId ? [...new Set([...save.completed, endingId])] : save.completed,
    chapterOutcomes: milestone(next) ? [...new Set([...save.chapterOutcomes, next])] : save.chapterOutcomes,
  };
}
export function rewind(save: Save, decisionId?: string): Save {
  const key = decisionId ?? Object.keys(decisions).filter(id => save.checkpoints[id]).at(-1);
  const snapshot = key ? save.checkpoints[key] : undefined;
  return snapshot ? { ...save, progress: cloneProgress(snapshot) } : save;
}
type Graph = Record<string, { id: string; next?: string; choices?: { id: string; to: string }[] }>;
function validProgress(value: unknown, graph: Graph = nodes, terminals: string[] = []): value is Progress {
  if (!value || typeof value !== 'object') return false;
  const p = value as Progress;
  if (!Array.isArray(p.trail) || !Array.isArray(p.decisions) || !p.trail.length || p.trail.length > Object.keys(graph).length + terminals.length) return false;
  if (p.trail[0] !== startId || p.trail.at(-1) !== p.nodeId || new Set(p.trail).size !== p.trail.length) return false;
  let decisionIndex = 0;
  for (let i = 0; i < p.trail.length; i++) {
    const id = p.trail[i];
    if (typeof id !== 'string') return false;
    if (terminals.includes(id)) return i === p.trail.length - 1 && decisionIndex === p.decisions.length;
    const node = graph[id];
    if (!node) return false;
    if (i === p.trail.length - 1) break;
    let next = node.next;
    if (node.choices) {
      const decision = p.decisions[decisionIndex++];
      if (!decision || decision.nodeId !== id) return false;
      next = node.choices.find(c => c.id === decision.choiceId)?.to;
    }
    if (next !== p.trail[i + 1]) return false;
  }
  return decisionIndex === p.decisions.length;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function prefix(p: Progress, id: string): Progress {
  const trail = p.trail.slice(0, p.trail.indexOf(id) + 1);
  return { nodeId: id, trail, decisions: p.decisions.filter(d => trail.slice(0, -1).includes(d.nodeId)) };
}
export function parseSave(raw: string): Save | null {
  try {
    const s = JSON.parse(raw) as Save;
    if (!s || s.version !== 4 || !validProgress(s.progress) || !['standard', 'large'].includes(s.fontSize) || !['animated', 'instant'].includes(s.textDisplay)) return null;
    if (!Array.isArray(s.completed) || s.completed.length > Object.keys(endings).length || !s.completed.every(id => Object.hasOwn(endings, id))) return null;
    if (!Array.isArray(s.chapterOutcomes) || s.chapterOutcomes.length > Object.keys(nodes).filter(milestone).length || !s.chapterOutcomes.every(milestone)) return null;
    if (!s.checkpoints || typeof s.checkpoints !== 'object' || Array.isArray(s.checkpoints)) return null;
    for (const [id, p] of Object.entries(s.checkpoints)) if (!decisions[id] || !validProgress(p) || p.nodeId !== decisions[id].nodeId) return null;
    for (const id of s.progress.trail) {
      const decisionId = nodes[id].decisionId;
      if (decisionId && !same(s.checkpoints[decisionId], prefix(s.progress, id))) return null;
      if (milestone(id) && !s.chapterOutcomes.includes(id)) return null;
    }
    const ending = nodes[s.progress.nodeId].endingId;
    if (ending && !s.completed.includes(ending)) return null;
    return { ...s, progress: cloneProgress(s.progress), checkpoints: Object.fromEntries(Object.entries(s.checkpoints).map(([id, p]) => [id, cloneProgress(p)])), completed: [...new Set(s.completed)], chapterOutcomes: [...new Set(s.chapterOutcomes)] };
  } catch { return null; }
}
// Each historical version is validated against its own graph before translating stable positions.
export function migrateLegacySave(raw: string, version: 1 | 2 | 3 = 1): Save | null {
  try {
    const original = version === 1 ? legacyV1 : version === 2 ? legacyV2 : legacyV3;
    const graph = Object.fromEntries(original.nodes.map(n => [n.id, n]));
    const s = JSON.parse(raw);
    const oldExits = ['U01', 'B1_01'];
    if (!s || s.version !== version || !validProgress(s.progress, graph, oldExits) || !['standard', 'large'].includes(s.fontSize)) return null;
    if (version === 3 && !['animated', 'instant'].includes(s.textDisplay)) return null;
    if (!Array.isArray(s.completed) || s.completed.length > 2 || !s.completed.every((id: unknown) => typeof id === 'string' && oldExits.includes(id))) return null;
    if (s.progress.trail.includes('H07')) {
      if (!validProgress(s.checkpoint, graph, oldExits) || !same(s.checkpoint, prefix(s.progress, 'H07'))) return null;
    } else if (s.checkpoint !== null) return null;
    if (oldExits.includes(s.progress.nodeId) && !s.completed.includes(s.progress.nodeId)) return null;
    const target = ['H04A', 'H04B'].includes(s.progress.nodeId) ? 'H04' : s.progress.nodeId;
    let next = newSave();
    next = { ...next, chapterOutcomes: [...new Set<string>(s.completed)], fontSize: s.fontSize, textDisplay: version === 3 ? s.textDisplay : 'animated' };
    for (let i = 0; i < Object.keys(nodes).length && next.progress.nodeId !== target; i++) {
      const id = next.progress.nodeId;
      const choiceId = nodes[id]?.choices ? s.progress.decisions.find((d: Decision) => d.nodeId === id)?.choiceId : undefined;
      const advanced = advance(next, id, choiceId);
      if (advanced === next) return null;
      next = advanced;
    }
    return next.progress.nodeId === target ? next : null;
  } catch { return null; }
}
