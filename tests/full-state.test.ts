import { describe, expect, it } from 'vitest';
import { advance, migrateLegacySave, newSave, parseSave, rewind, type Progress, type Save } from '../src/story/state';
import { decisions, endings, isExit, nodes, upcomingAssets } from '../src/story/data';
import { readSave, SAVE_KEY, writeSave } from '../src/story/storage';
import v1 from '../src/story/legacy-v1.json';
import v2 from '../src/story/legacy-v2.json';
import v3 from '../src/story/legacy-v3.json';

function travel(save = newSave(), alternate?: string): Save {
  let current = save;
  for (let i = 0; i <= Object.keys(nodes).length; i++) {
    const node = nodes[current.progress.nodeId];
    if (isExit(node.id)) return current;
    const choice = node.choices?.[node.decisionId === alternate ? 1 : 0];
    const next = advance(current, node.id, choice?.id);
    expect(next).not.toBe(current);
    current = next;
    expect(parseSave(JSON.stringify(current))).toEqual(current);
  }
  throw new Error('Route failed to finish');
}

describe('complete life routes', () => {
  it('reaches the historical ending and seven distinct alternatives', () => {
    expect(Object.keys(decisions)).toHaveLength(7);
    expect(Object.keys(endings)).toHaveLength(8);
    const reached = [travel(), ...Object.keys(decisions).map(id => travel(newSave(), id))];
    expect(new Set(reached.map(s => nodes[s.progress.nodeId].endingId))).toEqual(new Set(Object.keys(endings)));
    for (const s of reached) {
      expect(s.completed).toEqual([nodes[s.progress.nodeId].endingId]);
      expect(advance(s, s.progress.nodeId)).toBe(s);
    }
  });
  it('plays every local-response branch without losing its route or valid save', () => {
    const terminals: Save[] = [];
    const chosen = new Set<string>();
    function visit(save: Save) {
      const node = nodes[save.progress.nodeId];
      if (isExit(node.id)) { terminals.push(save); return; }
      for (const choice of node.choices ?? [undefined]) {
        if (choice) chosen.add(`${node.id}:${choice.id}`);
        const next = advance(save, node.id, choice?.id);
        expect(next).not.toBe(save);
        expect(parseSave(JSON.stringify(next))).toEqual(next);
        visit(next);
      }
    }
    visit(newSave());
    const expected = Object.values(nodes).flatMap(node => node.choices?.map(choice => `${node.id}:${choice.id}`) ?? []);
    expect(chosen).toEqual(new Set(expected));
    expect(terminals).toHaveLength(15);
    expect(new Set(terminals.map(s => nodes[s.progress.nodeId].endingId)).size).toBe(8);
  });
  it('keeps high-school handoffs playable and separate from final endings', () => {
    const route = travel();
    expect(route.progress.trail).toContain('U01');
    expect(route.chapterOutcomes).toContain('U01');
    expect(isExit('U01')).toBe(false);
    expect(route.completed).not.toContain('U01');
    expect(route.progress.trail.length).toBeGreaterThan(30);
  });
  it('restores a reached pre-choice snapshot while keeping discoveries', () => {
    const first = travel();
    const replay = rewind(first, 'K01');
    expect(replay.progress.nodeId).toBe(decisions.K01.nodeId);
    expect(replay.progress.decisions).toHaveLength(0);
    expect(replay.completed).toEqual(first.completed);
    expect(Object.keys(replay.checkpoints)).toHaveLength(7);
    const alternate = travel(replay, 'K01');
    expect(alternate.completed).toHaveLength(2);
    expect(alternate.progress.trail).not.toContain('H08');
    expect(parseSave(JSON.stringify(alternate))).toEqual(alternate);
    expect(rewind(alternate, 'never-reached')).toBe(alternate);
    const restarted = newSave(alternate);
    expect(restarted.progress.trail).toEqual(['P01']);
    expect(restarted.completed).toEqual(alternate.completed);
    expect(restarted.checkpoints).toEqual(alternate.checkpoints);
  });
  it('rejects stale actions, unknown choices and forged snapshots', () => {
    const start = newSave();
    const moved = advance(start, start.progress.nodeId);
    expect(advance(moved, start.progress.nodeId)).toBe(moved);
    const reached = rewind(travel(), 'K01');
    expect(advance(reached, reached.progress.nodeId, 'unknown')).toBe(reached);
    expect(advance(reached, reached.progress.nodeId)).toBe(reached);
    for (const value of [null, {}, { ...reached, completed: ['U01'] }, { ...reached, checkpoints: {} }, { ...reached, progress: { ...reached.progress, trail: ['P01', reached.progress.nodeId] } }]) {
      expect(parseSave(JSON.stringify(value))).toBeNull();
    }
    expect(parseSave('{broken')).toBeNull();
  });
  it('preloads at most two distinct known photos past black cards', () => {
    for (const id of Object.keys(nodes)) {
      const next = upcomingAssets(id);
      expect(next.length).toBeLessThanOrEqual(2);
      expect(new Set(next).size).toBe(next.length);
    }
  });
});

describe('old graph compatibility', () => {
  for (const [version, original] of [[1, v1], [2, v2], [3, v3]] as const) {
    it(`migrates every v${version} position on both branches`, () => {
      const graph = Object.fromEntries(original.nodes.map(n => [n.id, n]));
      for (const alternate of [false, true]) {
        let p: Progress = { nodeId: 'P01', trail: ['P01'], decisions: [] };
        let checkpoint: Progress | null = null;
        for (let i = 0; i <= original.nodes.length; i++) {
          if (p.nodeId === 'H07') checkpoint = structuredClone(p);
          const exit = ['U01', 'B1_01'].includes(p.nodeId);
          const old = { version, progress: p, checkpoint, completed: exit ? [p.nodeId] : [], fontSize: 'large', ...(version === 3 ? { textDisplay: 'instant' } : {}) };
          const save = migrateLegacySave(JSON.stringify(old), version);
          expect(save?.version).toBe(4);
          expect(save?.progress.nodeId).toBe(['H04A', 'H04B'].includes(p.nodeId) ? 'H04' : p.nodeId);
          expect(save?.fontSize).toBe('large');
          expect(save?.textDisplay).toBe(version === 3 ? 'instant' : 'animated');
          expect(save?.completed).toEqual([]);
          expect(save?.chapterOutcomes).toEqual(old.completed);
          expect(parseSave(JSON.stringify(save))).toEqual(save);
          if (exit) break;
          const node = graph[p.nodeId];
          const choices = 'choices' in node ? node.choices : undefined;
          const choice = choices?.[alternate ? choices.length - 1 : 0];
          const to = choice?.to ?? ('next' in node ? node.next : undefined);
          if (!to) throw new Error(`Missing old target ${p.nodeId}`);
          p = { nodeId: to, trail: [...p.trail, to], decisions: choice ? [...p.decisions, { nodeId: node.id, choiceId: choice.id }] : [...p.decisions] };
        }
      }
    });
  }
  it('rejects invalid old paths before migration', () => {
    expect(migrateLegacySave(JSON.stringify({ version: 3, progress: { nodeId: 'H07', trail: ['P01', 'H07'], decisions: [] }, checkpoint: null, completed: [], fontSize: 'large', textDisplay: 'animated' }), 3)).toBeNull();
  });
});

describe('browser persistence', () => {
  it('keeps old keys untouched and handles unavailable storage', () => {
    const denied = () => { throw new Error('Unavailable'); };
    expect(readSave(denied).issue).toBeTruthy();
    expect(writeSave(newSave(), denied)).toBe(false);
    const values = new Map<string, string>([['sunge.high-school.v3', JSON.stringify({ version: 3, progress: { nodeId: 'P01', trail: ['P01'], decisions: [] }, checkpoint: null, completed: ['U01'], fontSize: 'standard', textDisplay: 'instant' })]]);
    const old = values.get('sunge.high-school.v3');
    const port = () => ({ getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } });
    const migrated = readSave(port).save!;
    expect(migrated.chapterOutcomes).toEqual(['U01']);
    expect(migrated.completed).toEqual([]);
    expect(values.get('sunge.high-school.v3')).toBe(old);
    expect(writeSave(migrated, port)).toBe(true);
    expect(values.has(SAVE_KEY)).toBe(true);
    expect(readSave(port).save).toEqual(migrated);
  });
});
