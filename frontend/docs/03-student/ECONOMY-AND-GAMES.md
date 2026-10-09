# ECONOMY, QUESTS, BADGES, SHOP AND GAMES: FINAL RULES (v1)

Status: v1. These are the FINAL starting values and logic. The Admin can tune the numbers in AD-14 to AD-17 after launch; the logic below is what the backend implements and the frontend displays.
Used by: STUDENT-SPEC section 4 and ST-21 to ST-27, ADMIN-SPEC AD-14 to AD-19, GLOBAL-STYLES section 8.7.
Principle: every number in this file is applied by the BACKEND. The frontend never calculates XP, coins, scores, streaks, quests or purchases. It displays and animates the results.

---

## 1. TIME RULES

- School time zone and day boundary come from Platform settings (default: the school's local time zone, day boundary at 00:00).
- "Today" = from 00:00 to 23:59:59 school time. "Week" = Monday 00:00 to Sunday 23:59:59.
- Daily quests and daily caps reset at the day boundary. Weekly goals and the weekly leaderboard reset on Monday 00:00.
- All timestamps are stored in UTC and shown in school time.

---

## 2. XP

### 2.1 Where XP comes from (final values)
| Action | XP | Rules |
|---|---|---|
| Finish a lesson (mark complete) | 20 | First completion only. Review mode gives 0. |
| Finish an activity | 15 + score bonus | Score bonus: 90 percent or more +10, 70 to 89 percent +5. First completion; a retry that improves the best score gives only the extra bonus difference. |
| Quiz attempt completed | 20 + 30 x score fraction | Example: 80 percent gives 20 + 24 = 44. A perfect score adds +10 (max 60). XP is based on the best score: a retake that improves it awards only the difference. |
| Assignment submitted | 30 | Once per assignment. |
| Assignment grade confirmed (teacher) | +20 if 85 percent or more, +10 if 70 to 84 percent | Added when the grade is released. |
| Practice set finished (any tool) | 10 | Max 5 sets per tool per day; practice total cap 120 XP per day. |
| Writing check finished (Writing tool with AI check) | 15 | Max 2 per day. |
| AI Tutor "Quiz me" round finished (5 or more questions) | 10 | Max 3 per day. |
| Game session finished | 5 to 25 | See section 9.3. Game total cap 90 XP per day. |
| Daily quest completed | 15 / 25 / 35 | Easy / Medium / Hard (section 4). |
| Weekly goal completed | 80 to 150 | Section 4.3. |
| All 3 daily quests (bonus chest) | +20 | Plus coins. |
| Badge earned | 20 / 50 / 120 / 300 | Common / Rare / Epic / Legendary. |
| Streak milestone | 20 / 50 / 100 / 250 / 500 / 1000 | At 3 / 7 / 14 / 30 / 60 / 100 days. |
| Teacher bonus | As awarded | Up to the daily cap per student (100 XP). Counts toward level and the leaderboard (Admin setting, on by default). |

A typical engaged day (one lesson, two activities, one quiz, a few practice sets, a few games, three quests) earns about 220 to 260 XP. A light day earns 80 to 120 XP.

### 2.2 Anti-farming
- Duplicate protection: each source event (lesson, activity, quiz best score, assignment) pays XP once per event as written above.
- Daily caps are per type as listed. When a cap is reached, the action still works and shows "Daily cap reached. No more XP from this today." with no error.
- Every award is written to an XP ledger entry (source, amount, reason) so the Admin can audit it.

---

## 3. LEVELS, RANKS, COINS AND STREAKS

### 3.1 Level curve
Levels 1 to 60. XP needed to go from level n to level n+1: 120 + 25 x (n - 1) + (n - 1) squared.
| Level | XP to next | Total XP to reach |
|---|---|---|
| 1 | 120 | 0 |
| 2 | 146 | 120 |
| 5 | 236 | 644 |
| 10 | 426 | 2,184 |
| 15 | 666 | 4,774 |
| 20 | 956 | 8,664 |
| 25 | 1,296 | 14,104 |
| 30 | 1,686 | 21,344 |
| 40 | 2,616 | 42,224 |
| 50 | 3,746 | 73,304 |
| 60 | max | 116,584 |
Pacing at about 220 XP per active day: level 10 after about 10 days, level 20 after about 40 days, level 30 after about 100 days (one term), level 60 after about 3 school years. Past level 60 the student keeps earning XP (for the leaderboard) and the plate shows "Max level."

### 3.2 Rank titles (every 10 levels)
Newcomer 1 to 9, Explorer 10 to 19, Wordsmith 20 to 29, Storyteller 30 to 39, Linguist 40 to 49, Scholar 50 to 59, Grandmaster 60. Each rank has a plate border style and a free rank frame for the avatar. A new rank triggers a Large celebration and a certificate (section 8).

### 3.3 Level-up reward
Coins: 25 + the new level number (level 12 gives 37). Every 5th level also gives a free sticker item from a rotating pool. Level-up triggers a Medium celebration; a rank-up triggers Large.

### 3.4 Coins
| Source | Coins |
|---|---|
| Lesson complete | 5 |
| Activity complete | 4 |
| Quiz passed | 15 (+10 for a perfect score) |
| Assignment submitted | 15 (+10 / +20 when graded 70 / 85 percent or more) |
| Practice set | 3 |
| Game session | 2 to 10 (section 9.3), daily game cap 40 |
| Daily quest | 8 / 12 / 18 (Easy / Medium / Hard) |
| Daily chest (all 3 quests) | 25 to 75 (weights: 25 45 percent, 40 35 percent, 50 15 percent, 75 5 percent) |
| Weekly goal | 40 to 80 each; weekly chest (all 3) 100 to 250 |
| Level up | 25 + level |
| Badge | 20 / 60 / 150 / 400 (Common / Rare / Epic / Legendary) |
| Streak milestone | 30 / 80 / 150 / 400 / 800 / 1500 at 3 / 7 / 14 / 30 / 60 / 100 days |
| Teacher bonus | As awarded, up to 50 per student per day |
Daily cap on coins from lessons, activities, quizzes, practice and games combined: 120. Quests, chests, levels, badges, streaks and teacher bonuses are outside that cap. A typical active day earns 60 to 100 coins.
Coins are an in-app currency only. They cannot be bought, transferred or refunded.

### 3.5 Streaks
- A streak day counts when the student completes at least one learning action that day: a lesson, an activity, a quiz, an assignment submission, or a practice set. Games and AI chat alone do not count.
- Streak freeze (power-up, max 3 owned): if the student misses exactly one day and owns a freeze, one is consumed automatically at the day boundary and the streak continues (shown as "Freeze used" on the streak panel). Missing two or more days in a row breaks the streak even with freezes.
- Best streak is kept. Milestones at 3, 7, 14, 30, 60 and 100 days pay once each (rewards in 2.1 and 3.4) and award streak badges.
- Streak at risk: after 18:00 school time, if no streak action has happened, the student gets one notification "Your {n}-day streak is at risk."

---

## 4. QUESTS AND WEEKLY GOALS

### 4.1 Difficulty bands
Targets scale by the student's level band: Band A levels 1 to 15, Band B levels 16 to 35, Band C levels 36 to 60. Format below: A / B / C.

### 4.2 Daily quest pool (draw 3 per day)
| # | Quest | Targets (A / B / C) | Difficulty | Available when |
|---|---|---|---|---|
| 1 | Finish lessons | 1 / 1 / 2 | Easy | Student has open lessons |
| 2 | Complete activities | 2 / 3 / 4 | Easy | Open activities exist |
| 3 | Score at least X percent on a quiz | 70 / 80 / 85 | Medium | A quiz is open for the student |
| 4 | Learn new words (add or master) | 8 / 10 / 15 | Medium | Always |
| 5 | Finish practice sets | 1 / 2 / 3 | Easy | Always |
| 6 | Write a short text (Writing tool with AI check) | 1 / 1 / 1 | Medium | AI writing feature on |
| 7 | Play games | 2 / 3 / 3 | Easy | Games feature on |
| 8 | Beat your best score in any game | 1 / 1 / 1 | Hard | Games feature on and a previous score exists |
| 9 | Ask the AI Tutor (a conversation with 3 or more messages) | 1 / 1 / 1 | Easy | AI Tutor on |
| 10 | Review saved words with flashcards | 10 / 15 / 20 | Easy | Library has 10 or more words |
| 11 | Earn XP today | 80 / 120 / 160 | Medium | Always |
| 12 | Get answers right in a row (games or practice) | 5 / 8 / 10 | Hard | Always |
| 13 | Finish a listening practice set | 1 / 1 / 1 | Medium | Listening content exists |
| 14 | Translate and save words | 3 / 4 / 5 | Easy | Translation feature on |
| 15 | Submit an assignment | 1 / 1 / 1 | Medium | An assignment is open |
| 16 | Practice weak areas (finish a set from a quiz result) | 1 / 1 / 1 | Hard | The student has a recent quiz result |
Rewards by difficulty: Easy 15 XP and 8 coins, Medium 25 XP and 12 coins, Hard 35 XP and 18 coins.
Drawing rules (backend, at the day boundary): only quests whose availability condition is true; at least one from {1, 2, 5, 11} (core learning); at most one game-based quest (7, 8, 12); no quest that was drawn yesterday; at most one Hard; if fewer than 3 are available fill with quest 11.
Completing all 3 opens the daily chest: 25 to 75 coins and +20 XP.

### 4.3 Weekly goals (3 per week)
Pool: Earn XP this week (600 / 900 / 1,200), Keep a streak of N days this week (4 / 5 / 5), Finish lessons (4 / 6 / 8), Pass quizzes (1 / 2 / 2), Play games (8 / 12 / 15), Master new words (20 / 30 / 40).
Draw: always one XP goal, one habit goal (streak), and one random other. Rewards: 80 / 110 / 150 XP and 40 / 60 / 80 coins by difficulty (XP and streak goals count as 110 and 80). All three completed: weekly chest, 100 to 250 coins.

### 4.4 Teacher class quests
Created by teachers (TEACHER-SPEC 4.6). They appear under "From your teacher" in the student's quest page and dashboard. Rewards are set by the teacher within caps (max 100 XP and 50 coins per quest per student). They never replace the 3 daily quests and do not count toward the daily chest.

---

## 5. BADGES (STARTER CATALOG, 40)

Rarity effects: Common 20 XP and 20 coins, Rare 50 and 60, Epic 120 and 150, Legendary 300 and 400.
| Category | Badge (rarity): how to earn |
|---|---|
| Learning | First Steps (Common): finish your first lesson. Bookworm (Common): finish 10 lessons. Unit Done (Rare): finish all lessons in a unit. Course Champion (Epic): complete a course. Marathon (Rare): finish 5 lessons in one day. Curious Mind (Common): read 20 unit vocabulary lists. |
| Streak | On a Roll (Common): 3-day streak. Week Warrior (Rare): 7-day streak. Fortnight Flame (Rare): 14-day streak. Month Master (Epic): 30-day streak. Unbreakable (Legendary): 100-day streak. Comeback (Common): return after a missed week and complete a lesson. |
| Quiz | Quiz Starter (Common): pass your first quiz. Sharp (Rare): score 100 percent on a quiz. Hat Trick (Rare): pass 3 quizzes in a row. Quiz Master (Epic): pass 25 quizzes. Second Wind (Common): improve a score on a retake by 20 points or more. |
| Practice | Word Collector (Common): save 50 words. Wordsmith (Rare): master 100 words. Grammar Guru (Rare): finish 20 grammar sets. Reader (Common): finish 10 reading passages. Writer (Rare): finish 10 writing checks. Translator (Common): save 25 words from the translator. Good Listener (Common): finish 10 listening sets. |
| Games | Game On (Common): play your first game. Personal Best (Common): beat your best in any game. Combo King (Rare): reach a 10 combo. Speed Demon (Rare): finish a Hard game at 90 percent of the time left. Arcade Legend (Epic): beat your best in all 7 games. High Roller (Epic): reach the reference score on Hard in 3 different games. |
| Social | Top Ten (Rare): reach the top 10 of your class weekly board. Podium (Epic): finish a week in the top 3 of your grade. Climber (Common): rise 5 places in a week. School Star (Legendary): finish a week in the top 3 of the whole school. |
| Collector | Dress Up (Common): equip your first avatar item. Themed (Common): buy your first theme. Collector (Rare): own 10 shop items. Fashionista (Epic): own 3 Epic items. Treasure Hunter (Legendary): own a Legendary theme and a Legendary avatar item. |
| Secret (shown as "?" until earned) | Night Owl (Common): finish a lesson after 21:00. Early Bird (Common): finish a lesson before 07:30. Perfect Week (Epic): complete all daily quests for 7 days. Helper (Rare): use the AI Tutor to explain 20 mistakes from quiz results. Sticker Book (Legendary): earn 30 badges. |
Students can pin 3 badges. Badge criteria are defined by the Admin in AD-15 with the criteria builder; the above are the starter definitions.

---

## 6. SHOP

### 6.1 Rarity price bands (coins)
| Rarity | Avatar items | Frames | Titles | Themes | Level gate |
|---|---|---|---|---|---|
| Common | 150 to 300 | 200 to 400 | 150 to 300 | (none, starters are free) | None |
| Rare | 400 to 700 | 500 to 900 | 400 to 700 | 900 to 1,400 | Level 5 |
| Epic | 900 to 1,500 | 1,200 to 2,000 | 900 to 1,500 | 1,800 to 2,600 | Level 15 |
| Legendary | 2,000 to 3,000 | 2,500 to 4,000 | 2,000 to 3,000 | 3,200 to 4,000 | Level 30 |
Prices are at the top of their band for limited-time exclusives and at the bottom for always-available items.

### 6.2 Starter themes
Free: Candy Pop (default), Sorbet.
Purchasable: Desert Dusk (Rare, 900), Sakura Rain (Rare, 1,100), Candy Arcade (Rare, 1,200), Deep Reef (Epic, 1,800), Aurora (Epic, 2,200), Cyber Bazaar (Epic, 2,400), Neon Tokyo (Legendary, 3,500), Obsidian Gold (Legendary, 3,800, a "Night theme").
At about 80 coins a day a Rare theme takes about 2 weeks and a Legendary about 6 weeks, which keeps them aspirational.

### 6.3 Other catalog (starter counts)
- Avatar: 6 base characters (free), 20 outfits, 16 accessories, 12 backgrounds across the rarities.
- Frames: 7 rank frames (free with each rank), 14 purchasable frames.
- Titles: 24 purchasable titles (for example "Midnight Reader," "Word Wizard," "Grammar Ninja"); rank titles are free and automatic.
- Power-ups: Streak freeze 120 coins (max 3 owned). Hint pack of 5 for 80 coins. Extra time pack of 5 for 80 coins. Max 20 of each pack type owned. Daily purchase limit 5 per power-up type.
- Bundles and sales are created by the Admin (AD-16).

### 6.4 Purchase rules (backend transaction)
1. Check the item is Live and available now, the student has the level, and enough coins.
2. Deduct coins and add the item in one transaction. The price paid is recorded.
3. Items cannot be sold back. Retired items stay owned.
4. Purchases are idempotent (a double tap never charges twice).
5. Equip and unequip are free and instant.

### 6.5 Power-up usage rules
- Streak freeze: automatic, see 3.5.
- Hint: allowed in games and in practice sets; NOT in quizzes, assignments or AI "Quiz me" rounds. In multiple choice it removes two wrong options; in other formats it reveals a letter or the next item (section 9). Max 2 hints per game session.
- Extra time: +30 seconds in timed game modes. Max 1 per session.

---

## 7. LEADERBOARDS

- Ranking metric: XP earned in the period (this week) or total XP (all-time). Bonus XP from teachers counts (Admin setting).
- Ties: the student who reached that XP first ranks higher.
- Scopes: class, grade, school. Lists show the top 50 plus the student's own row.
- Weekly boards are computed Monday to Sunday and snapshot at reset (the previous week is kept for "movement" arrows and for badge checks).
- Hidden students (AD-19) are excluded from every scope. A student who turns off "show my name" (Settings) appears with initials.
- Rank movement arrows compare with the previous week's final rank.
- Anomaly flags for the Admin: XP gained in a day above 3 times the student's weekly average and above 500, or the same game played more than 30 times in a day.

---

## 8. CERTIFICATES

Issued by the backend when the condition is true:
- Course completion: every lesson complete and every unit quiz passed (at or above the pass mark; default pass mark 60 percent).
- Rank certificates: each new rank title.
- Streak certificate: 100-day streak.
Each certificate has a unique code and the date. The printable layout is in ST-29.

---

## 9. GAMES (ALL SEVEN, FINAL LOGIC)

### 9.1 Shared rules
- Solo only. Each session is about 2 to 3 minutes.
- Three difficulties: Easy, Medium, Hard. Easy is always open. Medium unlocks after one Easy session. Hard unlocks after a Medium session with a normalized score of 0.6 or more.
- Content source (student choice): From my courses (words, topics and passages from units the student has started or finished), My library (saved words and topics), or Mixed. If the chosen source has too few items, the backend fills the rest with level-appropriate school practice content for the student's grade. Items shown recently (last 30) are avoided; items the student gets wrong more often are weighted higher.
- Combo: consecutive correct answers. x1.0 for 0 to 2, x1.2 for 3 to 5, x1.5 for 6 to 9, x2.0 for 10 or more. A wrong answer resets it.
- Hints: section 6.5.
- Score: computed by the BACKEND from the answer log sent at the end of the session (the client sends each answer with its time). The backend rejects impossible logs (an answer faster than 300 ms, more answers than rounds, a time total beyond the session length) and awards nothing for them.
- Personal best is stored per game and difficulty.
- "Game of the day": one game is featured each day; the first session of the day in it earns 1.5 times the XP (inside the daily cap).

### 9.2 The seven games
| Game | What the student does | Easy | Medium | Hard |
|---|---|---|---|---|
| Vocabulary Match | Pair words with meanings (English definitions; the Arabic meaning is shown only if the setting is on) by tapping a left card then a right card | 6 pairs, 90 s | 8 pairs, 75 s | 10 pairs, 60 s |
| Word Builder | Arrange scrambled letter tiles into the word that matches a definition or a sentence with a blank | 8 rounds, 4 to 5 letters, 30 s each | 10 rounds, 6 to 7 letters, 25 s | 12 rounds, 8 to 10 letters, 20 s |
| Grammar Challenge | Choose the correct form to complete a sentence | 10 questions, 3 options, 15 s, 3 lives | 12 questions, 4 options, 12 s, 3 lives | 15 questions, 4 options, 10 s, 2 lives |
| Reading Challenge | Read a short passage, then answer quick comprehension questions | 3 passages of 50 to 80 words, 40 s reading, 4 questions each, 20 s per question | 80 to 120 words, 35 s, 5 questions | 120 to 160 words, 30 s, 6 questions |
| Sentence Builder | Tap or drag word chips into the correct order | 6 rounds, 5 to 6 words, 35 s | 8 rounds, 7 to 9 words, 30 s | 10 rounds, 10 to 12 words, 25 s |
| Spelling | Listen to a word (and a sample sentence on request) and type it | 10 words, 25 s each | 12 words, 20 s | 15 words, 15 s |
| Timed Quiz | Rapid multiple choice on mixed skills against a global clock | 60 s, +3 s per correct, 3 lives | 60 s, +2 s per correct, 3 lives | 45 s, +2 s per correct, 3 lives |

Per-game rules:
1. Vocabulary Match: a correct pair locks with a burst and scores 100. A wrong pair shakes and resets the combo (no time penalty). The board ends when all pairs are matched or time runs out. Time bonus: 5 points per second left. Hint: reveals one correct pair.
2. Word Builder: tiles are tapped or dragged into slots. Each round allows 2 tries; a wrong check shakes the tiles. After the second wrong try the word is revealed and the combo resets. Score per round 100 plus 4 points per second left. Hint: places the next letter correctly (does not cost points).
3. Grammar Challenge: correct answers score 100 plus 5 points per second left. A wrong answer costs one life, shows a one-sentence explanation for 2 seconds, and resets the combo. The game ends at 0 lives or after the last question. Hint: removes two wrong options.
4. Reading Challenge: the passage is visible during the reading time, then it collapses; the student may "Peek" once per passage for 5 seconds. Each correct answer scores 150 plus 4 points per second left. Hint: an extra peek.
5. Sentence Builder: when all chips are placed the answer is checked automatically. A perfect order scores 150. If the student fixes one mistake after the first check the round scores 80; otherwise 0 and the correct sentence is shown. Plus 3 points per second left. Hint: places the next correct chip.
6. Spelling: the word's audio plays (replay allowed twice, a sample sentence once). Correct on the first try scores 120; correct after a letter hint scores 60; wrong shows the correct spelling and resets the combo. Spelling is case-insensitive; both British and American accepted variants are allowed according to the platform setting. Plus 3 points per second left. Hint: reveals the first letter.
7. Timed Quiz: each correct answer scores 100 times the combo; each wrong answer costs a life and 3 seconds. The last 10 seconds are a "boss" window where points double. The game ends at time out or 0 lives. Hint: removes two wrong options.

### 9.3 Rewards from a game session
- Reference score per game and difficulty (the score of a strong, clean run): Vocabulary Match 1,100 / 1,800 / 2,600; Word Builder 1,000 / 1,500 / 2,200; Grammar Challenge 1,100 / 1,700 / 2,500; Reading Challenge 1,300 / 2,000 / 2,900; Sentence Builder 1,000 / 1,600 / 2,400; Spelling 1,200 / 1,800 / 2,600; Timed Quiz 1,500 / 2,200 / 3,200.
- Normalized score = score divided by the reference score, limited to between 0 and 1.
- XP = 5 + round(20 x normalized score) (so 5 to 25). Coins = 2 + round(8 x normalized score) (so 2 to 10).
- New personal best: +5 XP and +5 coins once per game per day.
- Daily caps: 90 XP and 40 coins from games. After the cap a session shows "Practice mode: no rewards" and still saves personal bests.
- A session left early (quit) before finishing awards nothing and does not count as a session.

### 9.4 Results screen data
Final score, personal best, normalized score, correct count, accuracy, time, best combo, XP and coins earned (with the cap note), missed items (with correct answers and "Add to my library"), and quest progress changes.

---

## 10. AUDIO FOR LISTENING AND SPELLING

- Source order for any audio need: (1) a recording uploaded by an Admin or the lesson's teacher; (2) a generated voice (text to speech) produced by the backend and cached in Storage per text, voice and speed; (3) no browser speech synthesis in production.
- Voices: one natural-sounding voice per spelling variant (British default, American when the platform setting is American). Sentences for listening questions use the same voice.
- Generation happens when content is published or when a teacher presses "Generate audio" in the lesson or question editor; students always receive a stored file (never wait for generation).
- Player behavior: play, replay (limit set per question; default 2), speed 0.75x / 1x / 1.25x using playback rate, transcript hidden until review. Captions toggle for audio blocks in lessons.
- Every audio item has a transcript stored with it.

---

## 11. GAMEPLAY ECONOMY HEALTH (ADMIN VIEW)

AD-14 shows (read from the backend): average coins held, coins earned and spent in the last 30 days, coins per active day, XP per active day, level distribution, percent of students at the daily caps, and shop purchases by rarity. Healthy targets: coins per active day 60 to 100; 15 to 25 percent of students hit the XP cap on a typical day; fewer than 5 percent hit the coin cap.
