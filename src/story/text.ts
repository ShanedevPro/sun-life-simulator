import type { StoryNode } from './data';

/** Resolve dialogue from the choices on this playthrough, including after a rewind. */
export function textForScene(
  node: Pick<StoryNode, 'text' | 'textVariants'>,
  decisions: readonly { nodeId: string; choiceId: string }[] = [],
): string[] {
  const variants = node.textVariants;
  const choice = variants && decisions.find(decision => decision.nodeId === variants.nodeId);
  const text = choice ? variants?.byChoice[choice.choiceId] : undefined;
  return text?.length ? text : node.text;
}
