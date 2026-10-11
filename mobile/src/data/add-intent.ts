import type { DraftSeed } from '@/domain/drafts';

/**
 * The journal day (and, when known, the meal) a new entry is being added to.
 * Set when "Add a meal" is pressed and read by the steps that follow.
 */
let intent: DraftSeed = {};

export const setAddIntent = (seed: DraftSeed) => {
  intent = seed;
};
export const getAddIntent = (): DraftSeed => intent;
