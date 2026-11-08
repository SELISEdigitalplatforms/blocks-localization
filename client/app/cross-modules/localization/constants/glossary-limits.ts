/** Field limits of a glossary term, shared by the editor and the places that create names. */
export const GLOSSARY_LIMITS = {
  name: 200,
  variants: 20,
  value: 200,
  forbiddenPerLanguage: 10,
  definition: 1000,
  note: 2000,
  usageExamples: 5,
  usageExample: 300,
} as const;
