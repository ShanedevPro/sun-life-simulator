import { useEffect, useRef, useState } from 'react';
import { createPhotoGame, type PhotoScene, type PhotoStatus } from './PhotoScene';
import { upcomingAssets } from '../story/data';

export function PhotoStage({ asset, nodeId, retry, onStatus }: { asset: string | null; nodeId: string; retry: number; onStatus: (s: PhotoStatus) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<PhotoScene | null>(null);
  useEffect(() => {
    const element = host.current!;
    const game = createPhotoGame(element, setScene, onStatus);
    const resize = () => {
      if (!game.isBooted) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      game.scale.zoom = 1 / ratio;
      game.scale.resize(Math.round(element.clientWidth * ratio), Math.round(element.clientHeight * ratio));
      game.canvas.style.width = `${element.clientWidth}px`;
      game.canvas.style.height = `${element.clientHeight}px`;
      game.canvas.dataset.pixelRatio = String(ratio);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    window.addEventListener('resize', resize);
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); game.destroy(true); };
  }, [onStatus]);
  useEffect(() => { if (scene) void scene.present(asset, nodeId === 'opening' ? ['p_xining'] : upcomingAssets(nodeId)); }, [scene, asset, nodeId, retry]);
  return <div ref={host} className="photo-stage" aria-hidden="true" />;
}
