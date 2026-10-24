import * as Phaser from 'phaser';
import { assets } from '../story/data';

export type PhotoStatus = { key: string | null; status: 'loading' | 'transitioning' | 'ready' | 'error' };
export class PhotoScene extends Phaser.Scene {
  private photo?: Phaser.GameObjects.Image;
  private loads = new Map<string, { promise: Promise<void>; cancel: () => void }>();
  private used = new Map<string, number>();
  private wanted = new Set<string>();
  private transitioning?: Phaser.GameObjects.Image;
  private clock = 0;
  private generation = 0;
  private cancelTransition?: () => void;
  private alive = true;
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  constructor(private onReady: (scene: PhotoScene) => void, private status: (s: PhotoStatus) => void) { super('photo'); }
  create() {
    this.scale.on('resize', this.resizePhoto, this);
    this.events.once('shutdown', () => { this.alive = false; this.generation++; this.cancelTransition?.(); for (const request of [...this.loads.values()]) request.cancel(); this.scale.off('resize', this.resizePhoto, this); });
    this.onReady(this);
  }
  private fit(photo: Phaser.GameObjects.Image) {
    const w = this.scale.width, h = this.scale.height;
    // Short landscape windows keep the entire portrait; don't crop off the face.
    const scale = w / h > 0.72 ? Math.min(w / photo.width, h / photo.height) : Math.max(w / photo.width, h / photo.height);
    photo.setScale(scale).setPosition(w / 2, h / 2);
    this.game.canvas.dataset.framing = JSON.stringify({ w, h, scale, imageWidth: photo.width, imageHeight: photo.height });
  }
  private resizePhoto() { if (this.photo) this.fit(this.photo); }
  private trim() {
    const protectedKeys = new Set([...this.wanted, this.photo?.texture.key, this.transitioning?.texture.key]);
    const unused = [...this.used.entries()].filter(([key]) => !protectedKeys.has(key)).sort((a, b) => a[1] - b[1]);
    while (this.used.size > 6 && unused.length) {
      const [key] = unused.shift()!;
      this.textures.remove(key);
      this.used.delete(key);
      this.loads.delete(key);
    }
    this.game.canvas.dataset.photoCache = String(this.used.size);
    this.game.canvas.dataset.photoRequests = String(this.loads.size);
  }
  private ensure(key: string, urgent = false): Promise<void> {
    if (!assets[key]) return Promise.reject(new Error(`Unknown photo: ${key}`));
    if (this.textures.exists(key)) { this.used.set(key, ++this.clock); return Promise.resolve(); }
    const existing = this.loads.get(key);
    if (existing) return existing.promise;
    if (this.loads.size >= 2) {
      if (!urgent) return Promise.resolve();
      // A foreground shot takes precedence over speculative preloading.
      this.loads.values().next().value?.cancel();
    }
    let cancel = () => {};
    const promise = new Promise<void>((resolve, reject) => {
      const image = new Image();
      const cleanup = () => { clearTimeout(timer); image.onload = null; image.onerror = null; this.loads.delete(key); this.game.canvas.dataset.photoRequests = String(this.loads.size); };
      const fail = () => { cleanup(); image.src = ''; reject(new Error('Photo unavailable')); };
      const timer = window.setTimeout(fail, 12000);
      cancel = fail;
      image.onload = () => {
        cleanup();
        if (this.alive && this.wanted.has(key)) {
          if (!this.textures.exists(key)) this.textures.addImage(key, image);
          this.used.set(key, ++this.clock);
          this.trim();
        }
        resolve();
      };
      image.onerror = fail;
      image.src = assets[key].url;
    });
    this.loads.set(key, { promise, cancel });
    this.game.canvas.dataset.photoRequests = String(this.loads.size);
    return promise;
  }
  async present(key: string | null, upcoming: string[]) {
    const generation = ++this.generation;
    this.cancelTransition?.();
    this.wanted = new Set([...(key ? [key] : []), ...upcoming.slice(0, 2)]);
    for (const [loadingKey, request] of [...this.loads]) if (!this.wanted.has(loadingKey)) request.cancel();
    this.trim();
    if (key === null) {
      this.photo?.destroy(); this.photo = undefined;
      this.status({ key, status: 'ready' });
      for (const next of upcoming.slice(0, 2)) void this.ensure(next).catch(() => {});
      return;
    }
    try {
      if (!this.textures.exists(key)) this.status({ key, status: 'loading' });
      await this.ensure(key, true);
      if (!this.alive || generation !== this.generation) return;
      this.tweens.killAll();
      if (this.photo?.texture.key !== key) {
        this.status({ key, status: 'transitioning' });
        const previous = this.photo;
        this.transitioning = previous;
        const photo = this.add.image(0, 0, key).setAlpha(this.reduced.matches ? 1 : 0);
        this.photo = photo;
        this.fit(photo);
        if (!this.reduced.matches) {
          await new Promise<void>(resolve => {
            const finish = () => { previous?.destroy(); this.transitioning = undefined; this.cancelTransition = undefined; this.trim(); resolve(); };
            const tween = this.tweens.add({ targets: photo, alpha: 1, duration: 200, onComplete: finish });
            this.cancelTransition = () => { tween.stop(); photo.setAlpha(1); finish(); };
          });
        } else { previous?.destroy(); this.transitioning = undefined; this.trim(); }
      }
      if (!this.alive || generation !== this.generation) return;
      this.status({ key, status: 'ready' });
      for (const next of upcoming.slice(0, 2)) void this.ensure(next).catch(() => {});
    } catch {
      if (this.alive && generation === this.generation) this.status({ key, status: 'error' });
    }
  }
}

export function createPhotoGame(parent: HTMLElement, ready: (scene: PhotoScene) => void, status: (s: PhotoStatus) => void) {
  const scene = new PhotoScene(ready, status);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  return new Phaser.Game({
    type: Phaser.AUTO, parent, backgroundColor: '#090a0a', banner: false,
    width: Math.round(parent.clientWidth * ratio), height: Math.round(parent.clientHeight * ratio),
    // ResizeObserver owns sizing. RESIZE would overwrite it with cached parent bounds.
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / ratio, autoCenter: Phaser.Scale.NO_CENTER },
    render: { antialias: true }, audio: { noAudio: true },
    scene: [scene], fps: { target: 30, forceSetTimeOut: true },
  });
}
