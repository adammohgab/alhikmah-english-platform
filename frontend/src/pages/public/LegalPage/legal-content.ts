/* Legal text structure (SHARED-SPEC SH-08). The school supplies the final wording and both
   documents need the school's review before launch; this is the required structure with plain
   working text. Keep the facts in step with SHARED-SPEC, AI-BEHAVIOR and ECONOMY-AND-GAMES. */

export type LegalKind = "terms" | "privacy";

export interface LegalSection {
  id: string;
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
}

export interface LegalDocument {
  kind: LegalKind;
  title: string;
  intro: string;
  sections: readonly LegalSection[];
}

export const LEGAL_VERSION = "1.0";
/** ISO date the texts were last changed. */
export const LEGAL_UPDATED_AT = "2026-10-15";

export const STUDENT_DATA_PROMISES: readonly string[] = [
  "No advertising. The platform never shows ads to students.",
  "No selling or sharing of student data with advertisers or data brokers.",
  "No cookie tracking and no outside analytics scripts.",
  "Data isolation. Students never see other students' work or results, and the AI never sees other students' data.",
  "Accounts are created by the school. There is no self-registration.",
];

export const TERMS: LegalDocument = {
  kind: "terms",
  title: "Terms of use",
  intro:
    "These terms explain how the platform may be used. By signing in you agree to them. If something is unclear, ask your school.",
  sections: [
    {
      id: "who-may-use",
      title: "Who may use the platform",
      paragraphs: [
        "The platform is for students and teachers of Al Hikmah Private School, and for the school's administrators. You may use it only with an account that your school created for you.",
      ],
    },
    {
      id: "accounts",
      title: "Your account",
      paragraphs: [
        "Accounts are assigned by the school. You cannot register by yourself, and you cannot use someone else's account.",
      ],
      bullets: [
        "Keep your password private. Do not share it, even with friends.",
        "If you think someone else knows your password, tell your teacher or the school office so it can be reset.",
        "You are responsible for what happens under your account.",
      ],
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      paragraphs: ["Use the platform for learning and respect the people who use it."],
      bullets: [
        "Do your own work. Do not copy answers or ask others to complete quizzes and assignments for you.",
        "Do not try to break, overload or get around the platform, its limits or its safety rules.",
        "Do not write or share content that is unkind, unsafe, unlawful or that exposes someone's personal details.",
        "Do not try to find out other people's passwords or to see data you are not allowed to see.",
      ],
    },
    {
      id: "ai-features",
      title: "AI features and their limits",
      paragraphs: [
        "The AI Tutor helps students learn English, and AI tools help teachers prepare and draft. The AI can make mistakes, so check important facts with your teacher.",
        "Teachers stay responsible for grading. AI suggestions about your work are not final until your teacher confirms them, and nothing AI-made reaches students without a teacher's approval. The school controls which AI features are on and how much each person can use them each day.",
      ],
    },
    {
      id: "rewards",
      title: "Rewards and the in-app currency",
      paragraphs: [
        "XP, levels, streaks, badges, coins and themes are there to keep learning fun. Coins are an in-app currency only: they have no real-money value, cannot be bought, transferred or exchanged for money, and purchases made with coins cannot be refunded.",
      ],
    },
    {
      id: "content-ownership",
      title: "Content ownership",
      paragraphs: [
        "The platform, its lessons and its artwork belong to the school and its providers. The writing and answers you submit remain yours. You allow the school to store them and to let your teachers and administrators see them so they can teach and grade you.",
      ],
    },
    {
      id: "suspension",
      title: "Account suspension",
      paragraphs: [
        "The school can pause, limit or archive an account, for example when these terms are broken, when a student leaves the school, or when an account may be at risk. Ask the school if you think this was a mistake.",
      ],
    },
    {
      id: "changes",
      title: "Changes to these terms",
      paragraphs: [
        "The school may update these terms. The date at the top of this page shows when they last changed. Using the platform after a change means you accept the new terms.",
      ],
    },
    {
      id: "contact",
      title: "Contact",
      paragraphs: [
        "Questions about these terms go to your school. Contact details are on the Help and contact page.",
      ],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  kind: "privacy",
  title: "Privacy notice",
  intro:
    "This notice explains what the platform keeps about students and teachers, why, and who can see it. It is written to be read by students and by their guardians.",
  sections: [
    {
      id: "data-collected",
      title: "What data is collected",
      paragraphs: [
        "The platform keeps only what it needs to teach, grade and run the school's courses.",
      ],
      bullets: [
        "Your name, username, grade and class.",
        "Your learning progress.",
        "Your quiz and assignment results.",
        "The writing you submit.",
        "Your rewards and purchases.",
        "Your leaderboard display name.",
        "Your conversations with the AI Tutor.",
      ],
    },
    {
      id: "why",
      title: "Why it is collected",
      paragraphs: [
        "To let you sign in, to show your progress, to mark quizzes and assignments, to give feedback on your writing, to run rewards and leaderboards, to keep the AI features safe, and to let teachers and the school support you.",
        "The data is not used for advertising and is not sold.",
      ],
    },
    {
      id: "who-sees",
      title: "Who can see it",
      paragraphs: [
        "Students see their own data. Their teachers and the school's administrators can see it so they can teach, grade and help.",
        "Other students see only your display name, avatar, level and XP on leaderboards. If you turn off “show my name”, they see your initials.",
      ],
    },
    {
      id: "ai-conversations",
      title: "AI conversations",
      paragraphs: [
        "Authorized school staff may review AI Tutor conversations when needed, for example to follow up a safety concern. Each review is logged.",
        "The AI is given only what the person using it can already see. It never receives other students' data.",
      ],
    },
    {
      id: "children",
      title: "Children's privacy",
      paragraphs: [
        "Students use the platform only through accounts that their school creates, and the school decides who is given an account. The platform is built around the principles found in children's privacy rules such as COPPA and the GDPR provisions on children's data: collect little, use it only for learning, show no advertising, keep it inside the school community, and let guardians ask questions.",
        "The school remains responsible for the legal basis and for any consent it needs from guardians.",
      ],
    },
    {
      id: "retention",
      title: "How long data is kept",
      paragraphs: [
        "Data is kept for the periods set by the school in the platform's data settings. Ask the school for the current periods. Audit and AI logs are kept for a limited time, and archived accounts stay archived until the school removes them.",
      ],
    },
    {
      id: "rights",
      title: "Your rights",
      paragraphs: [
        "Students and their guardians can ask the school to show what is kept, to correct it, or to delete it where the law and school records rules allow. Ask your school using the contact details on the Help and contact page.",
      ],
    },
    {
      id: "security",
      title: "How data is protected",
      paragraphs: ["At a high level, the platform protects data in these ways:"],
      bullets: [
        "Sign-in is required, and accounts are locked after repeated failed attempts.",
        "People can only open the pages and data that belong to their role.",
        "Data is sent over secure connections.",
        "Administrator actions and reviews of AI conversations are written to an audit log.",
      ],
    },
    {
      id: "contact",
      title: "Contact",
      paragraphs: [
        "Questions about privacy go to your school. Contact details are on the Help and contact page.",
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS: Readonly<Record<LegalKind, LegalDocument>> = {
  terms: TERMS,
  privacy: PRIVACY,
};
