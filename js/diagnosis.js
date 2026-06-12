/** @file Fault-tree diagnosis minigame engine: symptoms, tests, commit-to-fix resolution. */

/**
 * The test catalogue (GDD §2.1, SCHEMA.md "Test ids"). Faults may only reference
 * these ids. `generic` is what the player sees when a fault has nothing to say
 * for that test. `requiresMultimeterTier` gates the test behind a tool upgrade.
 * @type {Object<string, {label: string, generic: string, requiresMultimeterTier?: number}>}
 */
export const TESTS = {
  'error-log': {
    label: 'Check error log',
    generic: 'No active errors. Nothing unusual in the log.',
  },
  'temp-probe': {
    label: 'Temp probe readings',
    generic: 'All temperatures read in spec. Nothing unusual.',
  },
  'inspect-beater': {
    label: 'Pull and inspect beater assembly',
    generic: 'Beater, blades and seals all look healthy. Nothing unusual.',
  },
  'continuity-test': {
    label: 'Continuity test on motor and sensors',
    generic: 'Windings and sensors all read in spec. Nothing unusual.',
    requiresMultimeterTier: 2,
  },
};
