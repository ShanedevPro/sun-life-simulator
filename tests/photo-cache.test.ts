import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ Scene: class {} }));
import { PhotoScene } from '../src/game/PhotoScene';
import { assets } from '../src/story/data';

class FakeImage {
  static pending: FakeImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  constructor() { FakeImage.pending.push(this); }
}
afterEach(() => { vi.unstubAllGlobals(); FakeImage.pending = []; });
function setup() {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: true }), setTimeout: globalThis.setTimeout });
  vi.stubGlobal('Image', FakeImage);
  const retained = new Set<string>();
  const events: { key: string | null; status: string }[] = [];
  const scene = new PhotoScene(() => {}, s => events.push(s)) as any;
  scene.game = { canvas: { dataset: {} } };
  scene.scale = { width: 390, height: 844 };
  scene.textures = { exists: (k: string) => retained.has(k), addImage: (k: string) => retained.add(k), remove: (k: string) => retained.delete(k) };
  scene.tweens = { killAll() {} };
  scene.add = { image: (_x: number, _y: number, key: string) => ({ texture: { key }, width: 1024, height: 1792, setAlpha() { return this; }, setScale() { return this; }, setPosition() { return this; }, destroy() {} }) };
  return { scene, retained, events };
}
async function show(scene: any, key: string, upcoming: string[] = []) {
  const promise = scene.present(key, upcoming);
  const request = FakeImage.pending.at(-1);
  if (request?.onload) request.onload();
  await promise;
}
describe('bounded disposable scene photos', () => {
  it('evicts older textures through long playback and reloads on replay', async () => {
    const { scene, retained } = setup();
    const keys = Object.keys(assets).slice(0, 10);
    expect(keys.length).toBeGreaterThan(6);
    for (const key of keys) {
      await show(scene, key);
      expect(retained.has(key)).toBe(true);
      expect(retained.size).toBeLessThanOrEqual(6);
      expect(scene.loads.size).toBe(0);
    }
    expect(retained.has(keys[0])).toBe(false);
    await show(scene, keys[0]);
    expect(retained.has(keys[0])).toBe(true);
    expect(retained.size).toBe(6);
  });
  it('limits speculative requests and discards obsolete photo callbacks', async () => {
    const { scene, events, retained } = setup();
    const keys = Object.keys(assets).slice(0, 5);
    await show(scene, keys[0], [keys[1], keys[2], keys[3]]);
    expect(scene.loads.size).toBe(2);
    const obsolete = FakeImage.pending.slice(-2).map(image => image.onload!);
    const next = scene.present(keys[4], []);
    expect(scene.loads.size).toBe(1);
    for (const complete of obsolete) complete();
    expect(retained.has(keys[1])).toBe(false);
    expect(retained.has(keys[2])).toBe(false);
    FakeImage.pending.at(-1)!.onload!();
    await next;
    expect(events.at(-1)).toEqual({ key: keys[4], status: 'ready' });
    expect(scene.loads.size).toBe(0);
  });
  it('keeps the previous photo until the latest foreground request is ready', async () => {
    const { scene, events } = setup();
    const keys = Object.keys(assets).slice(0, 3);
    await show(scene, keys[0]);
    const stale = scene.present(keys[1], []);
    const oldCallback = FakeImage.pending.at(-1)!.onload!;
    expect(scene.photo.texture.key).toBe(keys[0]);
    expect(events.at(-1)).toEqual({ key: keys[1], status: 'loading' });
    const latest = scene.present(keys[2], []);
    oldCallback();
    await stale;
    expect(scene.photo.texture.key).toBe(keys[0]);
    expect(events.some(event => event.key === keys[1] && event.status === 'ready')).toBe(false);
    FakeImage.pending.at(-1)!.onload!();
    await latest;
    expect(scene.photo.texture.key).toBe(keys[2]);
    expect(events.at(-1)).toEqual({ key: keys[2], status: 'ready' });
  });
  it('retains the prior photo on failure and retries without a poisoned promise', async () => {
    const { scene, events } = setup();
    const keys = Object.keys(assets).slice(0, 2);
    await show(scene, keys[0]);
    const failed = scene.present(keys[1], []);
    FakeImage.pending.at(-1)!.onerror!();
    await failed;
    expect(events.at(-1)).toEqual({ key: keys[1], status: 'error' });
    expect(scene.photo.texture.key).toBe(keys[0]);
    expect(scene.loads.size).toBe(0);
    await show(scene, keys[1]);
    expect(events.at(-1)).toEqual({ key: keys[1], status: 'ready' });
  });

});
