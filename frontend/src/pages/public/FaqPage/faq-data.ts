/* FAQ content (SHARED-SPEC SH-07). Static in this phase: not editable by the Admin.
   Every answer restates a rule from the product specs (STUDENT-SPEC, ECONOMY-AND-GAMES,
   AI-BEHAVIOR, SHARED-SPEC) in plain words; when a rule changes there, change it here. */

export const FAQ_CATEGORIES = [
  { id: "students", label: "Students" },
  { id: "parents", label: "Parents" },
  { id: "teachers", label: "Teachers" },
  { id: "technical", label: "Technical" },
] as const;

export type FaqCategoryId = (typeof FAQ_CATEGORIES)[number]["id"];

export interface FaqLink {
  to: string;
  label: string;
}

export interface FaqEntry {
  id: string;
  category: FaqCategoryId;
  question: string;
  answer: string;
  link?: FaqLink;
  /** Extra search words that are not in the question or answer. */
  keywords?: string;
}

export const FAQ_ENTRIES: readonly FaqEntry[] = [
  /* ---- Students ---- */
  {
    id: "get-account",
    category: "students",
    question: "How do I get an account?",
    answer:
      "Your school creates your account and gives you a username and a first password. You cannot sign up on your own. If you have not received yours, ask your teacher or the school office.",
    link: { to: "/help", label: "Contact the school" },
    keywords: "register sign up create username",
  },
  {
    id: "sign-in",
    category: "students",
    question: "How do I sign in?",
    answer:
      "Open the sign-in page and type the username and password from your school. Choose “Keep me signed in on this device” only on a device that is yours.",
    link: { to: "/login", label: "Go to sign in" },
    keywords: "login log in",
  },
  {
    id: "forgot-password",
    category: "students",
    question: "What if I forget my password?",
    answer:
      "Use “Forgot your password?” on the sign-in page and send a request. There are no emails: an administrator at your school checks who you are, gives you a temporary password, and you choose a new one when you sign in.",
    link: { to: "/forgot-password", label: "Request a password reset" },
    keywords: "reset locked",
  },
  {
    id: "xp-levels-streaks",
    category: "students",
    question: "What are XP, levels and streaks?",
    answer:
      "XP is points you earn for learning. As your XP grows you move up levels and earn rank titles. A streak counts the days in a row on which you finished at least one lesson, activity, quiz, assignment or practice set. Games and AI chat alone do not count.",
    keywords: "points experience rank daily",
  },
  {
    id: "course-structure",
    category: "students",
    question: "How do courses, units and lessons work?",
    answer:
      "A course has units, a unit has lessons and activities, and each unit ends with a quiz. You can open any unit at any time. The quiz in a unit unlocks after you finish the lessons in that unit.",
    keywords: "curriculum progress",
  },
  {
    id: "quiz-locked",
    category: "students",
    question: "Why is a quiz locked?",
    answer:
      "Quizzes unlock after you complete every lesson in their unit. Open the unit, finish the lessons that are not ticked yet, and the quiz opens.",
    keywords: "lock unlock unavailable",
  },
  {
    id: "quiz-vs-assignment",
    category: "students",
    question: "What is the difference between a quiz and an assignment?",
    answer:
      "A quiz is marked automatically as soon as you finish. An assignment is solved on the platform too, and it can include writing questions: the AI checks your writing first, and your teacher confirms the grade.",
    keywords: "homework test exam",
  },
  {
    id: "quiz-retake",
    category: "students",
    question: "Can I retake a quiz?",
    answer:
      "Your teacher decides this for each quiz. The quiz page shows how many attempts are allowed and how many you have used.",
    keywords: "retry attempts again",
  },
  {
    id: "writing-grader",
    category: "students",
    question: "Who grades my writing?",
    answer:
      "The AI looks at your writing first and suggests a result. Your teacher always has the final say and confirms the grade.",
    keywords: "essay marks teacher ai",
  },
  {
    id: "coins",
    category: "students",
    question: "What are coins and how do I earn them?",
    answer:
      "Coins are the in-app currency. You earn them for finishing lessons, activities, quizzes and assignments, for daily quests, and for level-ups, badges and streak milestones. Coins have no real-money value: they cannot be bought, transferred or refunded.",
    keywords: "money rewards earn",
  },
  {
    id: "shop-items",
    category: "students",
    question: "What can I buy in the shop?",
    answer:
      "Avatar items, frames, titles and themes, plus power-ups such as a streak freeze, hints and extra time. Power-ups work in games and practice, not in teacher quizzes or assignments.",
    keywords: "store spend avatar power-up",
  },
  {
    id: "themes",
    category: "students",
    question: "What are themes?",
    answer:
      "Themes change the colors and look of the platform for you. You buy them with coins. They only change how things look: they never change your lessons or grades.",
    keywords: "colors appearance dark",
  },
  {
    id: "tutor-can-do",
    category: "students",
    question: "What can the AI Tutor do?",
    answer:
      "Pip, the AI Tutor, answers questions about English, explains the lesson you are on, checks your writing and quizzes you on what you learned.",
    keywords: "pip chatbot help",
  },
  {
    id: "tutor-refused",
    category: "students",
    question: "Why did the AI Tutor refuse my question?",
    answer:
      "The Tutor only helps with English and studying. During an open quiz or assignment it gives hints but not the answer. Some requests are blocked for safety, and then it replies “We can’t process this request.”",
    keywords: "blocked won't answer cannot",
  },
  {
    id: "tutor-limit",
    category: "students",
    question: "Is there a limit on the AI Tutor?",
    answer:
      "Yes. By default you get 40 Tutor messages, 10 writing checks and 3 “Quiz me” rounds a day, and your school can change these numbers. The limits reset at midnight.",
    keywords: "daily messages quota",
  },
  {
    id: "leaderboard-visible",
    category: "students",
    question: "What do other students see on the leaderboard?",
    answer:
      "Only your display name, avatar, level and XP. If you turn off “show my name” in Settings, other students see your initials instead.",
    keywords: "ranking privacy name",
  },

  /* ---- Parents ---- */
  {
    id: "parent-account",
    category: "parents",
    question: "Does the platform have parent accounts?",
    answer:
      "Not at the moment. The school creates accounts for students and teachers. If you would like to know how your child is doing, please ask the school or the class teacher.",
    link: { to: "/help", label: "Contact the school" },
    keywords: "guardian family login",
  },
  {
    id: "parent-data",
    category: "parents",
    question: "What information does the platform keep about my child?",
    answer:
      "Name, username, grade and class, learning progress, quiz and assignment results, writing your child submits, rewards and purchases, the leaderboard display name, and AI conversations. The Privacy notice explains why each is kept and who can see it.",
    link: { to: "/terms", label: "Read the Privacy notice" },
    keywords: "data collected personal information",
  },
  {
    id: "parent-who-sees",
    category: "parents",
    question: "Who can see my child's progress?",
    answer:
      "Your child, their teachers and school administrators. Other students only see a display name, avatar, level and XP on leaderboards.",
    keywords: "visible privacy grades",
  },
  {
    id: "parent-ai-chats",
    category: "parents",
    question: "Can school staff read AI chats?",
    answer:
      "Yes. Authorized school staff can view AI conversations when needed, for example to look into a safety concern, and every view is logged.",
    link: { to: "/terms", label: "Read the Privacy notice" },
    keywords: "tutor conversations moderation privacy",
  },
  {
    id: "parent-ads",
    category: "parents",
    question: "Does the platform show ads or track my child?",
    answer:
      "No advertising is shown, and no cookie tracking or outside analytics scripts are used on the platform.",
    keywords: "advertising cookies tracking analytics",
  },

  /* ---- Teachers ---- */
  {
    id: "teacher-approval",
    category: "teachers",
    question: "Does AI-made content reach students without my approval?",
    answer:
      "No. AI prepares first drafts of lessons, quizzes, assignments, feedback and announcements, and nothing AI-made reaches students until you approve it. Grades are yours to confirm.",
    keywords: "copilot draft review approve",
  },
  {
    id: "teacher-reset",
    category: "teachers",
    question: "How do I reset a student's password?",
    answer:
      "Teachers can reset the passwords of students in the classes they teach. Accounts outside your classes, and teacher accounts, are handled by a school administrator.",
    keywords: "temporary password student locked",
  },
  {
    id: "teacher-retakes",
    category: "teachers",
    question: "Can I decide whether students may retake a quiz?",
    answer:
      "Yes. Retakes are set by the teacher for each quiz. Students see the allowed and used attempts on the quiz page.",
    keywords: "attempts retry settings",
  },
  {
    id: "teacher-help",
    category: "teachers",
    question: "Who should I ask for help?",
    answer:
      "Your school administrator first. Administrators ask the platform owner when they need to.",
    link: { to: "/help", label: "Help and contact" },
    keywords: "support admin contact",
  },

  /* ---- Technical ---- */
  {
    id: "tech-no-load",
    category: "technical",
    question: "The page will not load.",
    answer:
      "Check your internet connection and refresh the page. If it still does not open, try the latest version of Chrome, Edge, Safari or Firefox. If you see an Error ID, share it with your school.",
    keywords: "blank slow stuck refresh error",
  },
  {
    id: "tech-not-saved",
    category: "technical",
    question: "My work did not save.",
    answer:
      "Work in progress is saved on your device and syncs when you are back online. Look for “Saved on this device” and keep the page open until you are connected again. If something is still missing, tell your teacher.",
    keywords: "lost draft autosave offline sync",
  },
  {
    id: "tech-browsers",
    category: "technical",
    question: "Which browsers and devices work?",
    answer:
      "The latest versions of Chrome, Edge, Safari and Firefox, on computers, tablets and phones.",
    keywords: "mobile phone tablet support",
  },
  {
    id: "tech-error-id",
    category: "technical",
    question: "I see “Something went wrong” and an Error ID.",
    answer:
      "Press “Try again”. If the page breaks again, reload it. If it keeps happening, send the Error ID to your school so they can follow it up.",
    keywords: "crash bug report",
  },
  {
    id: "tech-tutor-silent",
    category: "technical",
    question: "The AI Tutor is not answering.",
    answer:
      "The school may have switched AI features off, or you may have used today's limit. The limit resets at midnight.",
    keywords: "pip chat not working",
  },
];

/** Entries matching every word of `query` (in the question, answer or keywords) and `category`. */
export function filterFaq(
  entries: readonly FaqEntry[],
  query: string,
  category: FaqCategoryId | "all",
): FaqEntry[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  return entries.filter((entry) => {
    if (category !== "all" && entry.category !== category) return false;
    if (words.length === 0) return true;
    const haystack = `${entry.question} ${entry.answer} ${entry.keywords ?? ""}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
