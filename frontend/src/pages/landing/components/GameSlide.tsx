"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Lightbulb, Eye, RotateCcw, CheckCircle, Sparkles, ChevronRight, Target, Trophy } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";

interface Position {
  row: number;
  col: number;
}

interface Word {
  id: string;
  word: string;
  clue: string;
  positions: Position[];
  found: boolean;
  startPos: Position;
  direction: "across" | "down";
}

interface GameLetter {
  char: string;
  row: number;
  col: number;
  isPartOfWord: boolean;
  wordIds: string[];
}

const GRID_SIZE = 5;

const WORDS_DATA: Omit<Word, "id" | "found" | "positions">[] = [
  { word: "CAT", clue: "Small pet that meows", startPos: { row: 0, col: 0 }, direction: "across" },
  { word: "DOG", clue: "Man's best friend", startPos: { row: 1, col: 1 }, direction: "down" },
  { word: "SUN", clue: "Bright star in sky", startPos: { row: 2, col: 0 }, direction: "across" },
  { word: "HAT", clue: "Wear on your head", startPos: { row: 3, col: 1 }, direction: "down" },
  { word: "FUN", clue: "Enjoyment & play", startPos: { row: 4, col: 0 }, direction: "across" },
];

const FILL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const PRE_FOUND = ["CAT", "DOG", "SUN"];

function generateGrid(preFoundWords: string[] = []): { grid: GameLetter[][]; words: Word[] } {
  const emptyGrid: string[][] = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(""));
  const words: Word[] = [];

  WORDS_DATA.forEach((w, i) => {
    const positions: Position[] = [];
    const { word, clue, startPos, direction } = w;
    let { row, col } = startPos;

    word.split("").forEach((char) => {
      if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
        emptyGrid[row][col] = char;
        positions.push({ row, col });
      }
      if (direction === "across") col++;
      else row++;
    });

    words.push({
      id: `word-${i}`,
      word,
      clue,
      positions,
      found: preFoundWords.includes(word),
      startPos,
      direction,
    });
  });

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!emptyGrid[r][c]) {
        emptyGrid[r][c] = FILL_LETTERS[Math.floor(Math.random() * FILL_LETTERS.length)];
      }
    }
  }

  const grid: GameLetter[][] = emptyGrid.map((row, r) =>
    row.map((char, c) => ({
      char,
      row: r,
      col: c,
      isPartOfWord: words.some(w => w.positions.some(p => p.row === r && p.col === c)),
      wordIds: words.filter(w => w.positions.some(p => p.row === r && p.col === c)).map(w => w.id),
    }))
  );

  return { grid, words };
}

const INITIAL_STATE = generateGrid(PRE_FOUND);

function CrossLettersGameInner({ active }: { active: boolean }) {
  const [grid, setGrid] = useState<GameLetter[][]>(INITIAL_STATE.grid);
  const [words, setWords] = useState<Word[]>(INITIAL_STATE.words);
  const [selectedPath, setSelectedPath] = useState<Position[]>([]);
  const [currentWord, setCurrentWord] = useState<string>("");
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set(PRE_FOUND.map(w => `word-${WORDS_DATA.findIndex(wd => wd.word === w)}`)));
  const [showHints, setShowHints] = useState<Set<string>>(new Set());
  const [revealedWords, setRevealedWords] = useState<Set<string>>(new Set());
  const [gameComplete, setGameComplete] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lastFoundTime, setLastFoundTime] = useState<number>(0);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(48);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;
    const updateSize = () => {
      const width = container.clientWidth;
      const maxSize = Math.min(width - 40, 480);
      const size = Math.max(40, Math.min(58, maxSize / GRID_SIZE));
      setCellSize(size);
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [active]);

  useEffect(() => {
    if (foundWords.size === words.length && words.length > 0) {
      setGameComplete(true);
      createCelebrationParticles();
    }
  }, [foundWords.size, words.length]);

  const createCelebrationParticles = () => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const newParticles: Array<{ id: number; x: number; y: number; color: string }> = [];
    for (let i = 0; i < 25; i++) {
      newParticles.push({
        id: Date.now() + i,
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        color: ["#D4A02B", "#F5D76E", "#1F7A4D", "#4ADE80", "#3B82F6", "#EC4899"][Math.floor(Math.random() * 6)],
      });
    }
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 3000);
  };

  const getCellKey = (row: number, col: number) => `${row}-${col}`;

  const isValidStraightLine = useCallback((path: Position[]): boolean => {
    if (path.length < 2) return true;
    const first = path[0];
    const last = path[path.length - 1];
    const dr = last.row - first.row;
    const dc = last.col - first.col;
    
    if (dr === 0 && dc === 0) return false;
    
    const stepR = dr === 0 ? 0 : dr > 0 ? 1 : -1;
    const stepC = dc === 0 ? 0 : dc > 0 ? 1 : -1;
    
    if (stepR !== 0 && stepC !== 0 && Math.abs(dr) !== Math.abs(dc)) return false;
    
    let r = first.row;
    let c = first.col;
    while (r !== last.row + stepR || c !== last.col + stepC) {
      const found = path.some(p => p.row === r && p.col === c);
      if (!found) return false;
      r += stepR;
      c += stepC;
    }
    return true;
  }, []);

  const handleMouseDown = useCallback((row: number, col: number) => {
    if (!active) return;
    const cell = grid[row][col];
    setSelectedPath([{ row, col }]);
    setCurrentWord(cell.char);
  }, [active, grid]);

  const handleMouseEnter = useCallback((row: number, col: number) => {
    if (!active || selectedPath.length === 0) return;
    const newPath = [...selectedPath, { row, col }];
    if (isValidStraightLine(newPath)) {
      setSelectedPath(newPath);
      setCurrentWord(prev => prev + grid[row][col].char);
    }
  }, [active, selectedPath, grid, isValidStraightLine]);

  const handleMouseUp = useCallback(() => {
    if (selectedPath.length < 2) {
      setSelectedPath([]);
      setCurrentWord("");
      return;
    }

    if (!isValidStraightLine(selectedPath)) {
      setSelectedPath([]);
      setCurrentWord("");
      return;
    }

    const pathWord = currentWord;
    const reversedWord = pathWord.split("").reverse().join("");

    let matchedWord: Word | null = null;
    for (const word of words) {
      if (word.found) continue;
      if (word.word === pathWord || word.word === reversedWord) {
        const pathSet = new Set(selectedPath.map(p => `${p.row}-${p.col}`));
        const wordSet = new Set(word.positions.map(p => `${p.row}-${p.col}`));
        if (pathSet.size === wordSet.size && [...pathSet].every(p => wordSet.has(p))) {
          matchedWord = word;
          break;
        }
      }
    }

    if (matchedWord) {
      const now = Date.now();
      const timeDiff = now - lastFoundTime;
      const newCombo = timeDiff < 5000 ? combo + 1 : 1;
      setCombo(newCombo);
      setLastFoundTime(now);

      const basePoints = matchedWord.word.length * 10;
      const comboBonus = newCombo * 5;
      setScore(prev => prev + basePoints + comboBonus);

      setFoundWords(prev => new Set([...prev, matchedWord!.id]));
      setWords(prev => prev.map(w => w.id === matchedWord!.id ? { ...w, found: true } : w));

      createWordParticles(matchedWord);
    }

    setSelectedPath([]);
    setCurrentWord("");
  }, [selectedPath, currentWord, words, foundWords, combo, lastFoundTime, isValidStraightLine]);

  const createWordParticles = (word: Word) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const newParticles: Array<{ id: number; x: number; y: number; color: string }> = [];
    for (let i = 0; i < 12; i++) {
      newParticles.push({
        id: Date.now() + i,
        x: centerX + (Math.random() - 0.5) * 200,
        y: centerY + (Math.random() - 0.5) * 100,
        color: ["#D4A02B", "#F5D76E", "#1F7A4D", "#4ADE80"][Math.floor(Math.random() * 4)],
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => setParticles(p => p.filter(part => !newParticles.includes(part))), 2000);
  };

  const useHint = useCallback(() => {
    const unfoundWords = words.filter(w => !w.found && !showHints.has(w.id));
    if (unfoundWords.length === 0) return;
    const randomWord = unfoundWords[Math.floor(Math.random() * unfoundWords.length)];
    setShowHints(prev => new Set([...prev, randomWord.id]));
    setScore(prev => Math.max(0, prev - 10));
  }, [words, showHints]);

  const revealWord = useCallback(() => {
    const unfoundWords = words.filter(w => !w.found && !revealedWords.has(w.id));
    if (unfoundWords.length === 0) return;
    const randomWord = unfoundWords[Math.floor(Math.random() * unfoundWords.length)];
    setRevealedWords(prev => new Set([...prev, randomWord.id]));
    setScore(prev => Math.max(0, prev - 20));
    setTimeout(() => {
      setRevealedWords(prev => {
        const next = new Set(prev);
        next.delete(randomWord.id);
        return next;
      });
    }, 3000);
  }, [words, revealedWords]);

  const shuffleGrid = useCallback(() => {
    const newState = generateGrid(PRE_FOUND);
    setGrid(newState.grid);
    setWords(newState.words);
    setSelectedPath([]);
    setCurrentWord("");
    setFoundWords(new Set(PRE_FOUND.map(w => `word-${WORDS_DATA.findIndex(wd => wd.word === w)}`)));
    setShowHints(new Set());
    setRevealedWords(new Set());
    setGameComplete(false);
    setScore(0);
    setCombo(0);
    setLastFoundTime(0);
  }, []);

  const isSelected = (row: number, col: number) => selectedPath.some(p => p.row === row && p.col === col);
  const isHinted = (row: number, col: number) => {
    const cell = grid[row][col];
    return cell.wordIds.some(id => showHints.has(id));
  };
  const isRevealed = (row: number, col: number) => {
    const cell = grid[row][col];
    return cell.wordIds.some(id => revealedWords.has(id));
  };
  const isFound = (row: number, col: number) => {
    const cell = grid[row][col];
    return cell.wordIds.some(id => foundWords.has(id));
  };

  const getCellStyle = (row: number, col: number) => {
    const selected = isSelected(row, col);
    const hinted = isHinted(row, col);
    const revealed = isRevealed(row, col);
    const found = isFound(row, col);
    const cell = grid[row][col];

    let bg = "#FFFFFF";
    let border = "#E2E5EA";
    let textColor = "#12151C";
    let glow = "none";

    if (found) {
      bg = "#E4F3EA";
      border = "#1F7A4D";
      textColor = "#1F7A4D";
      glow = "0 0 10px rgba(31, 122, 77, 0.5)";
    } else if (revealed) {
      bg = "#E6F0FB";
      border = "#1E5FA8";
      textColor = "#1E5FA8";
      glow = "0 0 10px rgba(30, 95, 168, 0.5)";
    } else if (hinted) {
      bg = "#FBF1DD";
      border = "#A66A0A";
      textColor = "#A66A0A";
      glow = "0 0 10px rgba(166, 106, 10, 0.5)";
    } else if (selected) {
      bg = "#D4A02B";
      border = "#B9891E";
      textColor = "#0F1D45";
      glow = "0 0 14px rgba(212, 160, 43, 0.7)";
    } else if (cell.isPartOfWord) {
      bg = "#FAFAFA";
      border = "#E2E5EA";
    }

    return {
      width: cellSize,
      height: cellSize,
      backgroundColor: bg,
      borderColor: border,
      color: textColor,
      boxShadow: glow,
    };
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-white rounded-2xl overflow-hidden"
      onMouseLeave={handleMouseUp}
      onMouseUp={handleMouseUp}
    >
      <style>{`
        @keyframes float-particle {
          0% { transform: translateY(0) scale(1); opacity: 0.9; }
          50% { transform: translateY(-35px) scale(1.2); opacity: 1; }
          100% { transform: translateY(-70px) scale(0); opacity: 0; }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 10px rgba(212, 160, 43, 0.5); }
          50% { box-shadow: 0 0 24px rgba(212, 160, 43, 0.8); }
        }
        .animate-float-particle { animation: float-particle ease-out forwards; }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
      `}</style>
      <div className="absolute inset-0 pointer-events-none z-10">
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute rounded-full pointer-events-none animate-float-particle"
            style={{
              left: p.x,
              top: p.y,
              width: 7 + Math.random() * 7,
              height: 7 + Math.random() * 7,
              backgroundColor: p.color,
              opacity: 0.9,
              animationDelay: `${Math.random() * 0.5}s`,
              animationDuration: `${1.5 + Math.random() * 1}s`,
            }}
          />
        ))}
      </div>

      <div className="p-4 pt-3 space-y-3 h-full flex flex-col">
        <div className="flex items-center justify-between gap-3 text-sm font-sans text-ink-600 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-gold-500">
              <Sparkles size={16} />
              <span className="font-bold tabular-nums text-xl">{score}</span>
            </span>
            {combo > 1 && (
              <span className="flex items-center gap-1.5 text-green-600 bg-green-50 px-3 py-1 rounded-full animate-pulse-glow text-[12px]">
                <Target size={12} strokeWidth={2} />
                <span className="font-bold">×{combo} Combo</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-ink-400 font-medium">{foundWords.size}/{words.length} words</span>
            <span className="px-2 py-1 bg-gold-500/10 text-gold-600 rounded-full text-[11px] font-semibold">Level 1</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, ${cellSize}px)` }}>
            {grid.map((row, r) =>
              row.map((_, c) => (
                <div
                  key={getCellKey(r, c)}
                  onMouseDown={() => handleMouseDown(r, c)}
                  onMouseEnter={() => handleMouseEnter(r, c)}
                  className="flex items-center justify-center select-none font-sans font-bold transition-all duration-150 ease-out cursor-pointer rounded-sm"
                  style={{
                    ...getCellStyle(r, c),
                    fontSize: cellSize * 0.48,
                    zIndex: isSelected(r, c) ? 5 : isRevealed(r, c) ? 4 : isHinted(r, c) ? 3 : isFound(r, c) ? 2 : 1,
                  }}
                >
                  {grid[r][c].char}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line-200">
          <div className="flex items-center gap-2">
            <button
              onClick={useHint}
              disabled={words.every(w => w.found || showHints.has(w.id))}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 px-3 rounded-md text-[12px] font-semibold uppercase tracking-[0.1em] transition-all duration-150",
                words.every(w => w.found || showHints.has(w.id))
                  ? "bg-line-200 text-ink-400 cursor-not-allowed"
                  : "bg-warning-100 text-warning-600 hover:bg-warning-100/80"
              )}
              aria-label="Show hint"
            >
              <Lightbulb size={14} strokeWidth={2} />
              Hint
            </button>
            <button
              onClick={revealWord}
              disabled={words.every(w => w.found)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 px-3 rounded-md text-[12px] font-semibold uppercase tracking-[0.1em] transition-all duration-150",
                words.every(w => w.found)
                  ? "bg-line-200 text-ink-400 cursor-not-allowed"
                  : "bg-info-100 text-info-600 hover:bg-info-100/80"
              )}
              aria-label="Reveal word"
            >
              <Eye size={14} strokeWidth={2} />
              Reveal
            </button>
            <button
              onClick={shuffleGrid}
              className="inline-flex h-9 items-center gap-1.5 px-3 rounded-md border border-line-200 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-600 hover:bg-surface-50 transition-colors"
              aria-label="New puzzle"
            >
              <RotateCcw size={14} strokeWidth={2} />
              New
            </button>
          </div>
          <div className="flex items-center gap-3 text-[12px] text-ink-500">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle size={12} strokeWidth={2} />
              {foundWords.size} found
            </span>
            <span className="flex items-center gap-1 text-gold-500">
              <Trophy size={12} strokeWidth={2} />
              {score} pts
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[12px] font-sans text-ink-500 max-h-48 overflow-y-auto pr-1">
          {words.map((w, idx) => (
            <div
              key={w.id}
              className={cn(
                "flex items-start gap-2 px-3 py-2 rounded-md transition-colors group",
                w.found ? "bg-success-100 text-success-600 line-through" : "bg-surface-50 hover:bg-surface-100"
              )}
            >
              <span className="w-5 text-center font-bold tabular-nums text-gold-500 flex-shrink-0">{idx + 1}.</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium capitalize truncate">{w.word.toLowerCase()}</span>
                  {!w.found && <span className="text-ink-300 text-[10px] px-1.5 py-0.5 rounded bg-white/50">{w.word.length} letters</span>}
                </div>
                <p className="text-[10px] text-ink-400 mt-0.5 truncate">{w.clue}</p>
              </div>
              {w.found && <CheckCircle size={13} strokeWidth={2} className="shrink-0 text-success-600 mt-0.5" />}
            </div>
          ))}
        </div>

        {gameComplete && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/95 backdrop-blur-sm z-20 animate-fade-in">
            <div className="text-center p-8">
              <div className="inline-flex h-18 w-18 items-center justify-center rounded-full bg-gold-500/10 mb-4">
                <CheckCircle size={36} strokeWidth={2} className="text-gold-500" />
              </div>
              <h3 className="font-serif text-2xl font-bold text-ink-900 mb-2">Level Complete!</h3>
              <p className="text-ink-600 mb-4">Score: <span className="font-bold text-gold-500 text-xl">{score}</span> • <span className="font-medium">{foundWords.size}/{words.length} words</span></p>
              <button
                onClick={shuffleGrid}
                className="inline-flex h-10 items-center gap-2 px-5 rounded-md bg-gold-500 text-navy-900 font-semibold hover:bg-gold-600 transition-colors"
              >
                <RotateCcw size={16} strokeWidth={2} />
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface GameSlideProps {
  active: boolean;
}

export function GameSlide({ active }: GameSlideProps) {
  return (
    <div className="grid h-full w-full grid-cols-1 gap-6 px-4 pt-16 sm:px-6 lg:grid-cols-10 lg:gap-8 lg:px-8 lg:pt-12">
      <div className="lg:col-span-4 flex flex-col items-start justify-center">
        <div className="w-full max-w-lg">
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gold-500/15 border border-gold-500/30 mb-4">
            <Sparkles size={16} strokeWidth={2} className="text-gold-500" />
            <span className="font-sans text-[13px] font-semibold uppercase tracking-[0.2em] text-gold-500">New Game</span>
          </span>
          <h2 className="font-serif text-[3.5rem] lg:text-[4.5rem] xl:text-[5rem] font-bold leading-[0.95] tracking-tight text-white mb-4">
            Cross<br />Letters.
          </h2>
          <p className="text-white/60 text-[17px] leading-7 mb-8">
            Connect letters in straight lines to find hidden English words. Three words already found — can you find the rest?
          </p>

          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 mb-6">
            <h3 className="font-sans text-[12px] font-semibold uppercase tracking-[0.15em] text-gold-500 mb-3 flex items-center gap-2">
              <Sparkles size={14} /> How to Play
            </h3>
            <div className="space-y-2.5 text-white/70 text-[14px] leading-6">
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold-500/20 flex items-center justify-center text-gold-500 font-bold text-[12px]">1</span>
                <span>Click any letter to start selecting</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold-500/20 flex items-center justify-center text-gold-500 font-bold text-[12px]">2</span>
                <span>Drag in a <strong>straight line</strong> — any direction</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold-500/20 flex items-center justify-center text-gold-500 font-bold text-[12px]">3</span>
                <span>Release — valid words glow <span className="text-green-400">green</span> & score points</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold-500/20 flex items-center justify-center text-gold-500 font-bold text-[12px]">4</span>
                <span>Use <strong className="text-amber-400">Hint</strong> (amber) or <strong className="text-blue-400">Reveal</strong> (blue) if stuck</span>
              </div>
            </div>
          </div>

          <button className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gold-500 text-navy-900 font-sans text-[16px] font-semibold transition-all duration-200 hover:bg-gold-600 hover:scale-[1.02] shadow-lg shadow-gold-500/25 w-full">
            <span>Play Full Game</span>
            <ChevronRight size={22} strokeWidth={2} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      <div className="lg:col-span-6 h-full flex items-center justify-start" aria-hidden={!active}>
        <div className="w-full max-w-[90vw] h-[90vh] max-h-[680px] flex items-center justify-center">
          <div className="w-full h-full bg-white rounded-3xl shadow-[0_32px_64px_-16px_rgba(15,29,69,0.3),_0_0_0_1px_rgba(15,29,69,0.06),_inset_0_1px_0_rgba(255,255,255,0.5)] border border-line-200/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-gold-500/5 via-transparent to-navy-900/5 pointer-events-none" />
            <CrossLettersGameInner active={active} />
          </div>
        </div>
      </div>
    </div>
  );
}