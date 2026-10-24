import { useEffect, useMemo, useRef, useState } from 'react';

export type RevealPhase = 'waiting' | 'revealing' | 'settling' | 'complete';
const END_PAUSE = 180;

// The full text stays in the DOM for stable Chinese wrapping and centered lines.
export function makeTextTimeline(text: string[]) {
  const paragraphs = text.map(line => Array.from(line));
  const times: number[] = [];
  let elapsed = 0;
  paragraphs.forEach((chars, index) => {
    if (index) elapsed += 160;
    for (const char of chars) {
      elapsed += 30;
      times.push(elapsed);
      if (/[。！？!?]/u.test(char)) elapsed += 180;
      else if (/[，、；：,;:]/u.test(char)) elapsed += 90;
    }
  });
  return { paragraphs, times, duration: (times.at(-1) ?? 0) + END_PAUSE };
}

export function useTextReveal({ sceneKey, text, enabled, ready, paused, instant }: {
  sceneKey: string; text: string[]; enabled: boolean; ready: boolean; paused: boolean; instant: boolean;
}) {
  const timeline = useMemo(() => makeTextTimeline(text), [text]);
  const clock = useRef({ key: sceneKey, elapsed: 0 });
  const [frame, setFrame] = useState<{ key: string; visible: number; phase: RevealPhase }>({ key: sceneKey, visible: 0, phase: 'waiting' });
  const [visiblePage, setVisiblePage] = useState(() => !document.hidden);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const count = timeline.times.length;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media.matches);
    const visibility = () => setVisiblePage(!document.hidden);
    media.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  useEffect(() => {
    clock.current = { key: sceneKey, elapsed: 0 };
    setFrame({ key: sceneKey, visible: 0, phase: 'waiting' });
  }, [sceneKey]);

  useEffect(() => {
    if (!ready) return;
    const current = clock.current;
    if (instant || reduced || !enabled) current.elapsed = timeline.duration;
    const publish = () => {
      const visible = timeline.times.filter(time => time <= current.elapsed).length;
      const phase: RevealPhase = current.elapsed >= timeline.duration ? 'complete' : visible === count ? 'settling' : 'revealing';
      setFrame(old => old.key === sceneKey && old.visible === visible && old.phase === phase ? old : { key: sceneKey, visible, phase });
    };
    publish();
    if (paused || !visiblePage || current.elapsed >= timeline.duration) return;
    let previous = performance.now();
    let request = 0;
    const tick = (now: number) => {
      if (clock.current !== current) return;
      current.elapsed = Math.min(timeline.duration, current.elapsed + now - previous);
      previous = now;
      publish();
      if (current.elapsed < timeline.duration) request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [sceneKey, ready, paused, visiblePage, instant, reduced, enabled, timeline, count]);

  const complete = ready && (!enabled || instant || reduced || (frame.key === sceneKey && frame.phase === 'complete'));
  const phase: RevealPhase = complete ? 'complete' : !ready || frame.key !== sceneKey ? 'waiting' : frame.phase;
  return {
    paragraphs: timeline.paragraphs,
    visible: complete ? count : frame.key === sceneKey ? frame.visible : 0,
    phase,
    complete,
    finish: () => {
      if (!ready || complete) return;
      clock.current.elapsed = timeline.duration;
      setFrame({ key: sceneKey, visible: count, phase: 'complete' });
    },
  };
}
