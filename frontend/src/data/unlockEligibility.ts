import { IPAD_LINES, IPHONE_MODELS } from "./repairDevices";

// Which devices we can unlock. Each list in repairDevices.ts runs newest
// first, so this names the newest model that can be done in each, and
// everything from there down qualifies. Anything above it can't, and so
// can a model released later: a new phone needs a decision before it's
// offered, not the other way round.
//
// The line falls at the A14 chip. The iPhone 12 family, iPad Air (4th
// generation), iPad (10th generation) and iPad mini (6th generation) are
// all A14 or later, as is every iPad Pro still in use, so all of those are
// out. The iPhone SE (2nd generation) is listed after the 12s but is an
// A13, which is why it's the cutoff for iPhones and not the 11 Pro Max.
//
// One exception to the chip line: the iPad mini (5th generation) is an A12
// but can't be done either, so the mini stops at the mini 4.
const NEWEST_UNLOCKABLE: Record<string, string> = {
  iPhone: "iPhone SE (2nd generation)",
  iPad: "iPad (9th generation)",
  "iPad Air": "iPad Air (3rd generation)",
  "iPad mini": "iPad mini 4",
  // iPad Pro: none.
};

function fromCutoffDown(list: string[], newest: string | undefined): string[] {
  if (!newest) return [];
  const at = list.indexOf(newest);
  return at === -1 ? [] : list.slice(at);
}

const UNLOCKABLE = new Set([
  ...fromCutoffDown(IPHONE_MODELS, NEWEST_UNLOCKABLE.iPhone),
  ...IPAD_LINES.flatMap((line) => fromCutoffDown(line.models ?? [], NEWEST_UNLOCKABLE[line.name])),
]);

export function canUnlock(model: string): boolean {
  return UNLOCKABLE.has(model);
}
