import { describe, expect, it } from 'vitest';
import { validateSceneText } from '../scripts/check-content.mjs';
import { blackTitleIds, isBlackTitle, nodes, type StoryNode } from '../src/story/data';
import { advance, newSave, parseSave, rewind, type Save } from '../src/story/state';
import { textForScene } from '../src/story/text';

const source = nodes.H07;
const callback: StoryNode = {
  ...nodes.H08,
  text: ['车票收好了。'],
  textVariants: {
    nodeId: source.id,
    byChoice: {
      [source.choices![0].id]: ['你带上稿子，准备出发。'],
      [source.choices![1].id]: ['你把稿子收进抽屉，翻开了课本。'],
    },
  },
};

function reach(target: string): Save {
  let save = newSave();
  for (let i = 0; i < Object.keys(nodes).length; i++) {
    if (save.progress.nodeId === target) return save;
    const node = nodes[save.progress.nodeId];
    save = advance(save, node.id, node.choices?.[0].id);
  }
  throw new Error(`Did not reach ${target}`);
}

describe('choice-aware scene text', () => {
  it('resolves either choice without changing the scene or saved choices', () => {
    const original = structuredClone(callback);
    for (const choice of source.choices!) {
      const decisions = [{ nodeId: source.id, choiceId: choice.id }];
      expect(textForScene(callback, decisions)).toBe(callback.textVariants!.byChoice[choice.id]);
      expect(decisions).toEqual([{ nodeId: source.id, choiceId: choice.id }]);
    }
    expect(callback).toEqual(original);
  });

  it('keeps the default wording when no matching choice is recorded', () => {
    for (const decisions of [[], [{ nodeId: 'another-scene', choiceId: source.choices![0].id }], [{ nodeId: source.id, choiceId: 'unknown' }]]) {
      expect(textForScene(callback, decisions)).toBe(callback.text);
    }
    expect(textForScene({ text: callback.text })).toBe(callback.text);
    expect(textForScene({ ...callback, textVariants: { nodeId: source.id, byChoice: { empty: [] } } }, [{ nodeId: source.id, choiceId: 'empty' }])).toBe(callback.text);
  });

  it('uses the current playthrough for both scene text and history after rewind', () => {
    const before = reach(source.id);
    const first = advance(before, source.id, source.choices![0].id);
    const historyText = (save: Save) => [callback].map(scene => textForScene(scene, save.progress.decisions));
    expect(textForScene(callback, first.progress.decisions)).toEqual(['你带上稿子，准备出发。']);
    expect(historyText(first)[0]).toEqual(textForScene(callback, first.progress.decisions));
    const replay = rewind(first, source.decisionId);
    expect(replay.progress.decisions).toEqual([]);
    expect(textForScene(callback, replay.progress.decisions)).toBe(callback.text);
    const second = advance(replay, source.id, source.choices![1].id);
    expect(textForScene(callback, second.progress.decisions)).toEqual(['你把稿子收进抽屉，翻开了课本。']);
    expect(historyText(second)[0]).toEqual(textForScene(callback, second.progress.decisions));
    expect(parseSave(JSON.stringify(second))).toEqual(second);
  });

  it('continues an existing v4 chapter-recap save without moving its progress', () => {
    // A v4 save recorded before chapter recaps received photographs.
    const trail = ['P01', 'P02', 'P03', 'H01', 'H02', 'H03', 'H04', 'H05', 'H06A', 'H06', 'H06B', 'H07', 'H08', 'H09', 'H10', 'H10B', 'H11', 'H12', 'U01'];
    const progress: Save['progress'] = { nodeId: 'U01', trail, decisions: [{ nodeId: 'H07', choiceId: 'go_shanghai' }] };
    const checkpoints = { K01: { nodeId: 'H07', trail: trail.slice(0, trail.indexOf('H07') + 1), decisions: [] } };
    const oldSave: Save = { version: 4, progress, checkpoints, completed: [], chapterOutcomes: ['U01'], fontSize: 'large', textDisplay: 'instant' };
    const restored = parseSave(JSON.stringify(oldSave))!;
    expect(restored).toEqual(oldSave);
    expect(nodes.U01.asset).toBeTruthy();
    expect(isBlackTitle(nodes.U01)).toBe(false);
    const next = advance(restored, 'U01');
    expect(next.progress.nodeId).toBe(nodes.U01.next);
    expect(next.progress.trail.slice(0, -1)).toEqual(restored.progress.trail);
    expect(next.chapterOutcomes).toContain('U01');
    expect(next.fontSize).toBe('large');
    expect(next.version).toBe(4);
  });
});

function validFixture() {
  return { nodes: [
    ...blackTitleIds.map(id => ({ id, kind: 'intertitle', asset: null, text: ['下一章'] })),
    { id: 'ask', kind: 'choice', asset: 'desk', text: ['你想怎么做？'], choices: [{ id: 'write', to: 'reply' }, { id: 'wait', to: 'reply' }] },
    { id: 'reply', kind: 'dialogue', asset: 'reply', text: ['好，那就试试。'], textVariants: { nodeId: 'ask', byChoice: { write: ['写好了就拿来。'], wait: ['先想一想，也不迟。'] } }, sourceNote: '具体对白为改编。' },
  ] };
}

describe('script text and presentation validation', () => {
  it('accepts valid callbacks and the three intentional black titles', () => {
    expect(validateSceneText(validFixture())).toEqual([]);
  });

  it('rejects unknown or unreachable callback choices and missing source nodes', () => {
    const unknown = validFixture();
    unknown.nodes.at(-1)!.textVariants!.byChoice = { unknown: ['不能找到这个选项。'] } as never;
    expect(validateSceneText(unknown).join('\n')).toContain('Unknown variant choice reply: unknown');
    const missing = validFixture();
    missing.nodes.at(-1)!.textVariants!.nodeId = 'missing';
    expect(validateSceneText(missing).join('\n')).toContain('Invalid variant source reply: missing');
    const unreachable = validFixture();
    unreachable.nodes.find(node => node.id === 'ask')!.choices![0].to = 'elsewhere';
    expect(validateSceneText(unreachable).join('\n')).toContain('Variant choice cannot lead to scene reply: write');
  });

  it('rejects blank, oversized or unfinished callback paragraphs and source notes', () => {
    for (const text of [[], [''], ['一', '二', '三'], ['字'.repeat(161)], ['TODO']]) {
      const fixture = validFixture();
      fixture.nodes.at(-1)!.textVariants!.byChoice.write = text;
      expect(validateSceneText(fixture).length).toBeGreaterThan(0);
    }
    for (const note of ['', '字'.repeat(601), 'TODO', 5]) {
      const fixture = validFixture();
      fixture.nodes.at(-1)!.sourceNote = note as string;
      expect(validateSceneText(fixture).join('\n')).toContain('Invalid sourceNote reply');
    }
  });

  it('rejects narrative black screens and photos disguised as intertitles', () => {
    const missing = validFixture();
    missing.nodes.at(-1)!.asset = null as never;
    expect(validateSceneText(missing).join('\n')).toContain('Unintentional black scene reply');
    const disguised = validFixture();
    disguised.nodes.at(-1)!.kind = 'intertitle';
    expect(validateSceneText(disguised).join('\n')).toContain('Only approved title cards may use intertitle: reply');
    const longTitle = validFixture();
    longTitle.nodes[0].text = ['这不是短章节标题，而是一整段剧情叙述。'];
    expect(validateSceneText(longTitle).join('\n')).toContain('Black card must be a short chapter title P03');
  });
});
