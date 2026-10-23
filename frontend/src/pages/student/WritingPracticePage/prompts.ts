/* Curated writing prompts, sentence starters and outlines for the Writing workshop (ST-18).
   This is fixed teaching content, not data: the same bank is offered to every student. */

export type PromptType = "story" | "opinion" | "email" | "review";

export interface WritingPrompt {
  id: string;
  type: PromptType;
  title: string;
  task: string;
  audience: string;
  /** Suggested length in words, [min, max]. */
  range: readonly [number, number];
}

export const PROMPT_TYPES: readonly { id: PromptType; label: string }[] = [
  { id: "story", label: "Story" },
  { id: "opinion", label: "Opinion" },
  { id: "email", label: "Email" },
  { id: "review", label: "Review" },
];

export const PROMPTS: readonly WritingPrompt[] = [
  {
    id: "story-door",
    type: "story",
    title: "The door that was not there yesterday",
    task: "Write a story that begins when you find a door in your school that was not there yesterday. What is behind it?",
    audience: "Your classmates",
    range: [120, 200],
  },
  {
    id: "story-lost",
    type: "story",
    title: "The lost phone",
    task: "You find a phone on the bus. Tell the story of what happens next, from finding it to the ending.",
    audience: "Your classmates",
    range: [120, 200],
  },
  {
    id: "opinion-homework",
    type: "opinion",
    title: "Should students have less homework?",
    task: "Give your opinion on whether students should have less homework. Support it with two reasons and one example.",
    audience: "Your teacher",
    range: [120, 180],
  },
  {
    id: "opinion-phones",
    type: "opinion",
    title: "Phones in the classroom",
    task: "Should students be allowed to use phones in class? Explain your opinion and answer one opposing view.",
    audience: "The school principal",
    range: [120, 180],
  },
  {
    id: "email-friend",
    type: "email",
    title: "Invite a friend",
    task: "Write an email to an English-speaking friend. Invite them to visit your city and tell them what you could do together.",
    audience: "A friend",
    range: [80, 140],
  },
  {
    id: "email-teacher",
    type: "email",
    title: "Ask your teacher for help",
    task: "Write a polite email to your teacher. Explain what you find difficult and ask for extra help.",
    audience: "Your teacher",
    range: [80, 140],
  },
  {
    id: "review-book",
    type: "review",
    title: "Review a book or film",
    task: "Review a book or film you enjoyed. Say what it is about, what you liked, and who should read or watch it.",
    audience: "Other students",
    range: [100, 160],
  },
  {
    id: "review-place",
    type: "review",
    title: "Review a place you visited",
    task: "Review a restaurant, park or shop you visited. Describe it, give your opinion and say if you would go back.",
    audience: "Other students",
    range: [100, 160],
  },
];

export const STARTERS: Record<PromptType, readonly string[]> = {
  story: [
    "One morning,",
    "Suddenly,",
    "I could not believe my eyes when",
    "Without thinking,",
    "In the end,",
    "From that day on,",
  ],
  opinion: [
    "In my opinion,",
    "I strongly believe that",
    "One reason for this is that",
    "For example,",
    "Some people say that",
    "However,",
    "To sum up,",
  ],
  email: [
    "Dear",
    "I am writing to",
    "Thank you for",
    "I would like to ask if",
    "Could you please",
    "I look forward to hearing from you.",
    "Best wishes,",
  ],
  review: [
    "I recently watched",
    "The story is about",
    "What I liked most was",
    "One problem was that",
    "It reminded me of",
    "I would recommend it to",
    "Overall, I give it",
  ],
};

export const OUTLINES: Record<PromptType, readonly string[]> = {
  story: [
    "Beginning: who, where, when?",
    "Problem: what goes wrong or surprises the character?",
    "Middle: what does the character try?",
    "Ending: how is it solved, and what changes?",
  ],
  opinion: [
    "Introduction: state your opinion clearly.",
    "Reason 1 with an example.",
    "Reason 2 with an example.",
    "Another view, and why you disagree.",
    "Conclusion: repeat your opinion in new words.",
  ],
  email: [
    "Greeting and why you are writing.",
    "Main message: details the reader needs.",
    "Your question or request.",
    "Polite closing and your name.",
  ],
  review: [
    "What it is and a short summary (no spoilers).",
    "What you liked, with a reason.",
    "What could be better.",
    "Your rating and who should enjoy it.",
  ],
};

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}
