export type GrammarTopic = "Tenses" | "Prepositions" | "Conditionals" | "Modals" | "Passive Voice";
export type ExerciseKind = "unscramble" | "error-spotting";

export interface GrammarExercise {
  id: string;
  topic: GrammarTopic;
  kind: ExerciseKind;
  prompt: string;
  instruction: string;
  answer: string;
  options?: string[];
  explanation: string;
  rule: string;
}

export const GRAMMAR_TOPICS: GrammarTopic[] = [
  "Tenses",
  "Prepositions",
  "Conditionals",
  "Modals",
  "Passive Voice",
];

export const GRAMMAR_RULES: Record<
  GrammarTopic,
  { summary: string; rule: string; example: string }
> = {
  Tenses: {
    summary:
      "Choose a tense that matches when an action happens and whether it is ongoing or complete.",
    rule: "Use the present simple for routines and facts. Use the present continuous for actions happening now. Use the past simple for finished past actions.",
    example: "She usually walks to school, but today she is taking the bus.",
  },
  Prepositions: {
    summary: "Prepositions show time, place, direction, and relationships between words.",
    rule: "Use at for exact times, on for days and dates, and in for months, years, and longer periods. Some adjective and verb combinations take a fixed preposition.",
    example: "The lesson starts at 9:00 on Monday in October.",
  },
  Conditionals: {
    summary: "Conditionals describe what happens when a condition is true or what could happen.",
    rule: "First conditional: If + present simple, will + base verb. Do not normally use will in the if-clause.",
    example: "If you practise, you will improve.",
  },
  Modals: {
    summary: "Modal verbs express ability, advice, permission, possibility, and obligation.",
    rule: "A modal is followed by the base form of a verb without 'to': can swim, should study, must leave.",
    example: "You should check your answers before submitting.",
  },
  "Passive Voice": {
    summary:
      "Use the passive when the action or receiver is more important than the person doing it.",
    rule: "Form the passive with the correct form of be + the past participle. Keep the tense in the form of be.",
    example: "The project was completed yesterday.",
  },
};

export const GRAMMAR_EXERCISES: GrammarExercise[] = [
  {
    id: "tense-1",
    topic: "Tenses",
    kind: "unscramble",
    prompt: "Put the words in the correct order.",
    instruction: "every morning / walks / to school / Maya",
    answer: "Maya walks to school every morning.",
    explanation:
      "The subject comes before the verb. A frequency phrase such as 'every morning' often comes at the end of the sentence.",
    rule: "Present simple: subject + base verb (add -s/-es with he, she, or it).",
  },
  {
    id: "tense-2",
    topic: "Tenses",
    kind: "error-spotting",
    prompt: "Find and correct the mistake.",
    instruction: "Look! The children play in the garden.",
    answer: "Look! The children are playing in the garden.",
    options: [
      "Look! The children are playing in the garden.",
      "Look! The children plays in the garden.",
      "Look! The children played in the garden.",
    ],
    explanation:
      "'Look!' tells us the action is happening now, so use the present continuous: are + verb-ing.",
    rule: "Present continuous: am/is/are + verb-ing.",
  },
  {
    id: "prep-1",
    topic: "Prepositions",
    kind: "error-spotting",
    prompt: "Choose the correct sentence.",
    instruction: "Our English test is ___ Friday.",
    answer: "Our English test is on Friday.",
    options: [
      "Our English test is at Friday.",
      "Our English test is on Friday.",
      "Our English test is in Friday.",
    ],
    explanation: "Use 'on' with days of the week and specific dates.",
    rule: "At = exact time; on = days/dates; in = months/years/long periods.",
  },
  {
    id: "prep-2",
    topic: "Prepositions",
    kind: "unscramble",
    prompt: "Put the words in the correct order.",
    instruction: "interested / I / in / science / am",
    answer: "I am interested in science.",
    explanation:
      "The adjective 'interested' is followed by the preposition 'in'. Keep the subject and verb together at the start.",
    rule: "Some adjective + preposition combinations are fixed: interested in, good at, afraid of.",
  },
  {
    id: "cond-1",
    topic: "Conditionals",
    kind: "error-spotting",
    prompt: "Choose the correct sentence.",
    instruction: "If it rains tomorrow, we ___ at home.",
    answer: "If it rains tomorrow, we will stay at home.",
    options: [
      "If it will rain tomorrow, we stay at home.",
      "If it rains tomorrow, we will stay at home.",
      "If it rained tomorrow, we will stayed at home.",
    ],
    explanation:
      "In the first conditional, use the present simple after 'if' and 'will' in the result clause.",
    rule: "If + present simple, will + base verb.",
  },
  {
    id: "cond-2",
    topic: "Conditionals",
    kind: "unscramble",
    prompt: "Put the words in the correct order.",
    instruction: "you / if / practise / will / improve / you",
    answer: "If you practise, you will improve.",
    explanation:
      "The if-clause gives the condition. The main clause describes the likely result. A comma is common when the if-clause comes first.",
    rule: "First conditional: If + present simple, will + base verb.",
  },
  {
    id: "modal-1",
    topic: "Modals",
    kind: "error-spotting",
    prompt: "Choose the correct sentence.",
    instruction: "You ___ wear a seat belt in a car.",
    answer: "You must wear a seat belt in a car.",
    options: [
      "You must to wear a seat belt in a car.",
      "You must wearing a seat belt in a car.",
      "You must wear a seat belt in a car.",
    ],
    explanation: "Do not add 'to' or '-ing' after 'must'. Use the base verb 'wear'.",
    rule: "Modal verb + base form: must wear, can go, should study.",
  },
  {
    id: "modal-2",
    topic: "Modals",
    kind: "unscramble",
    prompt: "Put the words in the correct order.",
    instruction: "should / your notes / you / review / tonight",
    answer: "You should review your notes tonight.",
    explanation: "Use subject + modal + base verb. 'Should' gives advice.",
    rule: "Subject + should + base verb.",
  },
  {
    id: "passive-1",
    topic: "Passive Voice",
    kind: "error-spotting",
    prompt: "Choose the correct passive sentence.",
    instruction: "The classroom ___ every day.",
    answer: "The classroom is cleaned every day.",
    options: [
      "The classroom cleans every day.",
      "The classroom is cleaned every day.",
      "The classroom was clean every day.",
    ],
    explanation:
      "The classroom receives the action, so use the passive. 'Every day' indicates a routine, so use 'is' + past participle.",
    rule: "Present simple passive: am/is/are + past participle.",
  },
  {
    id: "passive-2",
    topic: "Passive Voice",
    kind: "unscramble",
    prompt: "Put the words in the correct order.",
    instruction: "was / the window / yesterday / repaired",
    answer: "The window was repaired yesterday.",
    explanation:
      "The window receives the action. 'Yesterday' signals past simple, so the passive uses 'was' + 'repaired'.",
    rule: "Past simple passive: was/were + past participle.",
  },
];

export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCorrectAnswer(value: string, answer: string): boolean {
  return normalizeAnswer(value) === normalizeAnswer(answer);
}

export function dailyProgressKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `grammar-practice:${year}-${month}-${day}`;
}
