export type TeaserCard = {
  keyword: string;
  blurb: string;
  moduleHint?: string;
};

/**
 * Hand-authored fallback cards. Shown immediately while the AI teaser
 * stream is still warming up, and kept as the source of truth whenever
 * the AI call fails, is rate-limited, or is disabled.
 *
 * Keep cards general about learning science so they're on-topic for
 * *any* course the user might be generating.
 */
export const GENERIC_TEASER_CARDS: readonly TeaserCard[] = [
  {
    keyword: "Active recall",
    blurb:
      "Pulling information out of your head beats reading it in again. Your quizzes are built around this.",
  },
  {
    keyword: "Spaced repetition",
    blurb:
      "We resurface concepts at the moment you're most likely to forget them.",
  },
  {
    keyword: "Bloom's taxonomy",
    blurb:
      "Your lessons climb from remembering facts to applying and creating.",
  },
  {
    keyword: "Interleaving",
    blurb:
      "Mixing topics feels harder now but sticks much longer than blocked practice.",
  },
  {
    keyword: "Elaboration",
    blurb:
      "Explaining an idea in your own words is one of the fastest ways to own it.",
  },
  {
    keyword: "Worked examples",
    blurb:
      "Seeing a problem solved step-by-step before you try it reduces cognitive load.",
  },
  {
    keyword: "Retrieval cues",
    blurb:
      "Short prompts trigger long memories. Your lessons are designed around them.",
  },
  {
    keyword: "Desirable difficulty",
    blurb:
      "A little struggle is a feature, not a bug — it's what makes learning stick.",
  },
  {
    keyword: "Chunking",
    blurb:
      "Grouping related ideas expands what your working memory can hold at once.",
  },
  {
    keyword: "Dual coding",
    blurb:
      "Pairing words with visuals gives your brain two routes back to the same idea.",
  },
  {
    keyword: "Metacognition",
    blurb:
      "Thinking about your own thinking is how good learners become great ones.",
  },
  {
    keyword: "Feedback loops",
    blurb:
      "Fast, specific feedback turns mistakes into the shortest path to mastery.",
  },
];
