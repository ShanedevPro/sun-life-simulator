/// <reference types="vite/client" />
import rawContent from './content.json';

export type EndingId = 'R0' | 'B1' | 'B2' | 'B3' | 'B4' | 'B5' | 'B6' | 'B7';
export type ChapterRoute = EndingId;
export type Choice = { id: string; label: string; to: string; route?: string };
export type StoryNode = {
  id: string; chapter: string; time: string; asset: string | null; kind: string;
  text: string[]; next?: string; choices?: Choice[]; speaker?: string; routeNotice?: string;
  actionLabel?: string; caption?: string; title?: string; sources?: string[]; decisionId?: string; checkpoint?: boolean; endingId?: EndingId;
  speakerPlacement?: 'onscreen' | 'offscreen';
};
export type Chapter = { id: string; title: string; period: string; order: number };
export type StoryDecision = { id: string; nodeId: string; title: string; time: string; asset: string };
export type StoryEnding = { id: EndingId; nodeId: string; title: string; summary: string; asset: string; historical: boolean };
type Content = { start: string; nodes: StoryNode[]; assets: Record<string, { url: string; title: string }>; chapters?: Record<string, Chapter>; decisions?: Record<string, StoryDecision>; endings?: Record<EndingId, StoryEnding>; sources?: Record<string, { title: string; url: string }> };
const content = rawContent as unknown as Content;
export const nodes = Object.fromEntries(content.nodes.map(n => [n.id, n]));
export const openingAsset = 'opening_cover';
export const assets: Content['assets'] = {
  ...Object.fromEntries(Object.entries(content.assets).map(([key, asset]) => [key, { ...asset, url: `${import.meta.env.BASE_URL}${asset.url.replace(/^\/+/, '')}` }])),
  [openingAsset]: { url: `${import.meta.env.BASE_URL}title-screen.webp`, title: '片头封面' },
};
export const chapters = content.chapters ?? {};
export const decisions = content.decisions ?? {};
export const endings = (content.endings ?? {}) as Record<EndingId, StoryEnding>;
export const sources = content.sources ?? {};
export const startId = content.start;
export const exits = Object.values(endings).map(e => e.nodeId);
export const isExit = (id: string): boolean => nodes[id]?.kind === 'ending';
export const upcomingAssets = (id: string): string[] => {
  const seen = new Set<string>();
  const result = new Set<string>();
  const visit = (key: string | undefined) => {
    if (!key || seen.has(key) || result.size >= 2) return;
    seen.add(key);
    const node = nodes[key];
    if (!node) return;
    if (node.asset) { result.add(node.asset); return; }
    for (const next of node.choices?.map(c => c.to) ?? [node.next]) visit(next);
  };
  const node = nodes[id];
  if (node) for (const next of node.choices?.map(c => c.to) ?? [node.next]) visit(next);
  return [...result];
};
