"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Lightbulb, Eye, RotateCcw, CheckCircle, Sparkles } from "lucide-react";
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

const GRID_SIZE = 6;

const WORDS_DATA: Omit<Word, "id" | "found" | "positions">[] = [
  { word: "CAT", clue: "Small pet", startPos: { row: 0, col: 0 }, direction: "across" },
  { word: "DOG", clue: "Best friend", startPos: { row: 1, col: 2 }, direction: "down" },
  { word: "SUN", clue: "Bright star", startPos: { row: 3, col: 0 }, direction: "across" },
  { word: "HAT", clue: "Head wear", startPos: { row: 2, col: 4 }, direction: "down" },
  { word: "FUN", clue: "Enjoyment", startPos: { row: 4, col: 1 }, direction: "across" },
];

const FILL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const PRE_FOUND = ["CAT", "DOG"];

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

export function CrossLettersGame({ active }: { active: boolean }) {
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
  const [cellSize, setCellSize] = useState(52);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;
    const updateSize = () => {
      const width = container.clientWidth;
      const maxSize = Math.min(width, 320);
      const size = Math.max(40, Math.min(58, (maxSize - 32) / GRID_SIZE));
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
    for (let i = 0; i < 20; i++) {
      newParticles.push({
        id: Date.now() + i,
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        color: ["#D4A02B", "#F5D76E", "#1F7A4D", "#4ADE80"][Math.floor(Math.random() * 4)],
      });
    }
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 2500);
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
    for (let i = 0; i < 8; i++) {
      newParticles.push({
        id: Date.now() + i,
        x: centerX + (Math.random() - 0.5) * 150,
        y: centerY + (Math.random() - 0.5) * 80,
        color: ["#D4A02B", "#F5D76E", "#1F7A4D", "#4ADE80"][Math.floor(Math.random() * 4)],
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => setParticles(p => p.filter(part => !newParticles.includes(part))), 1500);
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
    }, 2500);
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
      glow = "0 0 8px rgba(31, 122, 77, 0.4)";
    } else if (revealed) {
      bg = "#E6F0FB";
      border = "#1E5FA8";
      textColor = "#1E5FA8";
      glow = "0 0 8px rgba(30, 95, 168, 0.4)";
    } else if (hinted) {
      bg = "#FBF1DD";
      border = "#A66A0A";
      textColor = "#A66A0A";
      glow = "0 0 8px rgba(166, 106, 10, 0.4)";
    } else if (selected) {
      bg = "#D4A02B";
      border = "#B9891E";
      textColor = "#0F1D45";
      glow = "0 0 12px rgba(212, 160, 43, 0.6)";
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
          50% { transform: translateY(-30px) scale(1.2); opacity: 1; }
          100% { transform: translateY(-60px) scale(0); opacity: 0; }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 8px rgba(212, 160, 43, 0.4); }
          50% { box-shadow: 0 0 20px rgba(212, 160, 43, 0.7); }
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
              width: 6 + Math.random() * 6,
              height: 6 + Math.random() * 6,
              backgroundColor: p.color,
              opacity: 0.9,
              animationDelay: `${Math.random() * 0.5}s`,
              animationDuration: `${1.2 + Math.random() * 0.8}s`,
            }}
          />
        ))}
      </div>

      <div className="p-4 pt-3 space-y-3 h-full flex flex-col">
        <div className="flex items-center justify-between gap-3 text-sm font-sans text-ink-600">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-gold-500">
              <Sparkles size={14} />
              <span className="font-bold tabular-nums text-lg">{score}</span>
            </span>
            {combo > 1 && (
              <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full animate-pulse-glow">
                <span className="font-bold">×{combo}</span> Combo
              </span>
            )}
          </div>
          <span className="text-ink-400 font-medium">{foundWords.size}/{words.length} words</span>
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
                    fontSize: cellSize * 0.45,
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

        <div className="grid grid-cols-1 gap-1.5 text-[12px] font-sans text-ink-500 max-h-32 overflow-y-auto pr-1">
          {words.map((w, idx) => (
            <div
              key={w.id}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors",
                w.found ? "bg-success-100 text-success-600 line-through" : "bg-surface-50 hover:bg-surface-100"
              )}
            >
              <span className="w-5 text-center font-bold tabular-nums text-gold-500">{idx + 1}.</span>
              <span className="flex-1 truncate capitalize">{w.word.toLowerCase()}</span>
              {w.found && <CheckCircle size={12} strokeWidth={2} className="shrink-0 text-success-600" />}
              {!w.found && <span className="text-ink-300 text-[10px]">{w.word.length}</span>}
            </div>
          ))}
        </div>

        {gameComplete && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/95 backdrop-blur-sm z-20 animate-fade-in">
            <div className="text-center p-6">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/10 mb-3">
                <CheckCircle size={28} strokeWidth={2} className="text-gold-500" />
              </div>
              <h3 className="font-serif text-xl font-bold text-ink-900 mb-1">Complete!</h3>
              <p className="text-ink-600 mb-3">Score: <span className="font-bold text-gold-500">{score}</span></p>
              <button
                onClick={shuffleGrid}
                className="inline-flex h-9 items-center gap-2 px-4 rounded-md bg-gold-500 text-navy-900 font-semibold hover:bg-gold-600 transition-colors"
              >
                <RotateCcw size={14} strokeWidth={2} />
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}