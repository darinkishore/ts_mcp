export const adjectives = [
  "able",
  "amber",
  "arch",
  "apt",
  "azure",
  "bash",
  "bold",
  "brave",
  "brief",
  "bright",
] as const;

export const nouns = [
  "ace",
  "ant",
  "ape",
  "arch",
  "axe",
  "bat",
  "bear",
  "bee",
  "bell",
  "bird",
] as const;

// Type definitions
export type Adjective = (typeof adjectives)[number];
export type Noun = (typeof nouns)[number];
