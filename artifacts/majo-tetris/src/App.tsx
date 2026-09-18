import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

type PieceType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';
type CellValue = string | null;
type Board = CellValue[][];
type GameStatus = 'playing' | 'paused' | 'over';

type Piece = {
  type: PieceType;
  matrix: number[][];
  x: number;
  y: number;
};

const COLS = 10;
const ROWS = 20;
const COLORS: Record<PieceType, string> = {
  I: '#62e4dd',
  J: '#6685ff',
  L: '#ff9f5b',
  O: '#ffc65a',
  S: '#d7f36b',
  T: '#ed82d7',
  Z: '#ff6b61',
};

const SHAPES: Record<PieceType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  L: [
    [0, 0, 1, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  S: [
    [0, 1, 1, 0],
    [1, 1, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  T: [
    [0, 1, 0, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  Z: [
    [1, 1, 0, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
};

const PIECES: PieceType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<CellValue>(COLS).fill(null));
}

function randomType(): PieceType {
  return PIECES[Math.floor(Math.random() * PIECES.length)];
}

function makePiece(type: PieceType = randomType()): Piece {
  return {
    type,
    matrix: SHAPES[type].map((row) => [...row]),
    x: 3,
    y: 0,
  };
}

function rotateMatrix(matrix: number[][]): number[][] {
  return matrix[0].map((_, index) =>
    matrix.map((row) => row[index]).reverse(),
  );
}

function canPlace(
  board: Board,
  piece: Piece,
  offsetX = 0,
  offsetY = 0,
  matrix = piece.matrix,
): boolean {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) continue;
      const boardX = piece.x + x + offsetX;
      const boardY = piece.y + y + offsetY;
      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return false;
      if (boardY >= 0 && board[boardY][boardX]) return false;
    }
  }
  return true;
}

function mergePiece(board: Board, piece: Piece): Board {
  const nextBoard = board.map((row) => [...row]);
  piece.matrix.forEach((row, y) => {
    row.forEach((filled, x) => {
      const boardY = piece.y + y;
      const boardX = piece.x + x;
      if (filled && boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
        nextBoard[boardY][boardX] = COLORS[piece.type];
      }
    });
  });
  return nextBoard;
}

function clearLines(board: Board): { board: Board; count: number } {
  const remaining = board.filter((row) => row.some((cell) => !cell));
  const count = ROWS - remaining.length;
  return {
    count,
    board: [...Array.from({ length: count }, () => Array<CellValue>(COLS).fill(null)), ...remaining],
  };
}

function styleColor(color: string): CSSProperties {
  return { '--cell-color': color } as CSSProperties;
}

function Preview({ piece }: { piece: Piece }) {
  return (
    <div className="preview" data-testid="preview-next-piece">
      {piece.matrix.flatMap((row, y) =>
        row.map((filled, x) => (
          <div
            className={`preview-cell${filled ? ' on' : ''}`}
            key={`${y}-${x}`}
            style={filled ? styleColor(COLORS[piece.type]) : undefined}
          />
        )),
      )}
    </div>
  );
}

function App() {
  const [board, setBoard] = useState<Board>(() => emptyBoard());
  const [current, setCurrent] = useState<Piece>(() => makePiece());
  const [next, setNext] = useState<Piece>(() => makePiece());
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [clearNotice, setClearNotice] = useState(0);
  const [clearPulse, setClearPulse] = useState(false);

  const ghost = useMemo(() => {
    let distance = 0;
    while (canPlace(board, current, 0, distance + 1)) distance += 1;
    return { ...current, y: current.y + distance };
  }, [board, current]);

  const settlePiece = useCallback(
    (piece: Piece, dropBonus = 0) => {
      const result = clearLines(mergePiece(board, piece));
      const newLines = lines + result.count;
      setBoard(result.board);
      setScore((value) => value + dropBonus + [0, 100, 300, 500, 800][result.count] * level);
      setLines(newLines);
      setLevel(Math.floor(newLines / 10) + 1);
      if (result.count > 0) {
        setClearNotice(result.count);
        setClearPulse(true);
        window.setTimeout(() => setClearPulse(false), 300);
        window.setTimeout(() => setClearNotice(0), 1100);
      }
      const spawned = makePiece(next.type);
      setNext(makePiece());
      if (canPlace(result.board, spawned)) {
        setCurrent(spawned);
      } else {
        setStatus('over');
      }
    },
    [board, level, lines, next.type],
  );

  const move = useCallback(
    (direction: -1 | 1) => {
      if (status !== 'playing') return;
      if (canPlace(board, current, direction, 0)) {
        setCurrent((piece) => ({ ...piece, x: piece.x + direction }));
      }
    },
    [board, current, status],
  );

  const rotate = useCallback(() => {
    if (status !== 'playing') return;
    if (current.type === 'O') return;
    const rotated = rotateMatrix(current.matrix);
    const kicks = [0, -1, 1, -2, 2];
    const kick = kicks.find((offset) => canPlace(board, current, offset, 0, rotated));
    if (kick !== undefined) {
      setCurrent((piece) => ({ ...piece, matrix: rotated, x: piece.x + kick }));
    }
  }, [board, current, status]);

  const softDrop = useCallback(() => {
    if (status !== 'playing') return;
    if (canPlace(board, current, 0, 1)) {
      setCurrent((piece) => ({ ...piece, y: piece.y + 1 }));
      setScore((value) => value + 1);
    } else {
      settlePiece(current);
    }
  }, [board, current, settlePiece, status]);

  const hardDrop = useCallback(() => {
    if (status !== 'playing') return;
    let distance = 0;
    while (canPlace(board, current, 0, distance + 1)) distance += 1;
    settlePiece({ ...current, y: current.y + distance }, distance * 2);
  }, [board, current, settlePiece, status]);

  const restart = useCallback(() => {
    setBoard(emptyBoard());
    setCurrent(makePiece());
    setNext(makePiece());
    setScore(0);
    setLines(0);
    setLevel(1);
    setClearNotice(0);
    setClearPulse(false);
    setStatus('playing');
  }, []);

  const togglePause = useCallback(() => {
    setStatus((value) => (value === 'playing' ? 'paused' : value === 'paused' ? 'playing' : value));
  }, []);

  useEffect(() => {
    if (status !== 'playing') return undefined;
    const timer = window.setInterval(softDrop, Math.max(110, 790 - (level - 1) * 62));
    return () => window.clearInterval(timer);
  }, [level, softDrop, status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'p', 'P', 'r', 'R'].includes(event.key)) {
        event.preventDefault();
      }
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
      if (event.key === 'ArrowDown') softDrop();
      if (event.key === 'ArrowUp') rotate();
      if (event.key === ' ') hardDrop();
      if (event.key === 'p' || event.key === 'P') togglePause();
      if (event.key === 'r' || event.key === 'R') restart();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hardDrop, move, restart, rotate, softDrop, togglePause]);

  const displayCells = useMemo(() => {
    const cells = board.map((row) => row.map((cell) => ({ color: cell, ghost: false })));
    if (status !== 'over') {
      ghost.matrix.forEach((row, y) => row.forEach((filled, x) => {
        const boardY = ghost.y + y;
        const boardX = ghost.x + x;
        if (filled && boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS && !cells[boardY][boardX].color) {
          cells[boardY][boardX] = { color: COLORS[ghost.type], ghost: true };
        }
      }));
    }
    current.matrix.forEach((row, y) => row.forEach((filled, x) => {
      const boardY = current.y + y;
      const boardX = current.x + x;
      if (filled && boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
        cells[boardY][boardX] = { color: COLORS[current.type], ghost: false };
      }
    }));
    return cells;
  }, [board, current, ghost, status]);

  const statusLabel = status === 'playing' ? 'in play' : status === 'paused' ? 'paused' : 'game over';

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand" data-testid="text-brand">
          <div className="brand-mark">M</div>
          <div className="brand-copy">
            <span className="brand-name">MAJO</span>
            <span className="brand-sub">arcade systems / 01</span>
          </div>
        </div>
        <div className="topline">a tiny game for <b>big focus</b></div>
      </header>

      <section className="game-layout">
        <aside className="rail left-rail">
          <div className="eyebrow">01 / stack smart</div>
          <h1 className="hero-title">MA<span>JO</span></h1>
          <p className="hero-blurb">A pocket-sized block ritual. Clear the noise. Keep the rhythm.</p>
          <div className="side-rule" />
          <div className="key-list" aria-label="Keyboard controls">
            <div className="key-row"><span className="key">←</span><span>move left</span></div>
            <div className="key-row"><span className="key">→</span><span>move right</span></div>
            <div className="key-row"><span className="key">↓</span><span>soft drop</span></div>
            <div className="key-row"><span className="key">↑</span><span>rotate</span></div>
            <div className="key-row"><span className="key wide">SPACE</span><span>hard drop</span></div>
          </div>
        </aside>

        <section className="board-column" aria-label="Tetris board">
          <div className="board-heading">
            <h2 data-testid="text-game-status">MAJO / SESSION</h2>
            <span className="live-label">{statusLabel}</span>
          </div>
          <div className={`board-shell${clearPulse ? ' clear-pulse' : ''}`}>
            <div className="board" data-testid="game-board">
              {displayCells.flatMap((row, y) =>
                row.map((cell, x) => (
                  <div
                    className={`cell${cell.color ? ` filled${cell.ghost ? ' ghost' : ''}` : ''}`}
                    key={`${y}-${x}`}
                    style={cell.color ? styleColor(cell.color) : undefined}
                    data-testid={`cell-${y}-${x}`}
                  />
                )),
              )}
            </div>
            {status !== 'playing' && (
              <div className="overlay" data-testid={`overlay-${status}`}>
                <div className="overlay-card">
                  <div className="overlay-kicker">{status === 'paused' ? 'hold position' : 'run complete'}</div>
                  <h3>{status === 'paused' ? 'PAUSED' : 'GAME OVER'}</h3>
                  <p>{status === 'paused' ? 'Your stack is waiting.' : `You cleared ${lines} lines.`}</p>
                  <button
                    className="action-button primary"
                    data-testid="button-overlay-restart"
                    onClick={status === 'paused' ? togglePause : restart}
                  >
                    {status === 'paused' ? 'resume' : 'play again'}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="board-foot">
            <span>next drop <strong>{Math.max(110, 790 - (level - 1) * 62)}ms</strong></span>
            <span>{clearNotice ? `${clearNotice} line${clearNotice > 1 ? 's' : ''} cleared` : 'ghost guide active'}</span>
          </div>
          <div className="mobile-controls" aria-label="Touch controls">
            <div className="touch-pad">
              <button className="touch-button" data-testid="button-move-left" onClick={() => move(-1)} aria-label="Move left">←</button>
              <button className="touch-button" data-testid="button-move-right" onClick={() => move(1)} aria-label="Move right">→</button>
              <button className="touch-button rotate" data-testid="button-rotate" onClick={rotate} aria-label="Rotate">↻</button>
              <button className="touch-button soft" data-testid="button-soft-drop" onClick={softDrop} aria-label="Soft drop">↓</button>
              <button className="touch-button drop" data-testid="button-hard-drop" onClick={hardDrop}>drop piece</button>
              <button className="touch-button" data-testid="button-pause-mobile" onClick={togglePause} aria-label="Pause or resume">Ⅱ</button>
            </div>
          </div>
        </section>

        <aside className="rail right-rail">
          <div className="stats-heading">02 / telemetry</div>
          <div className="stat-block">
            <div className="stat-label">score</div>
            <div className="stat-value score-value" data-testid="text-score">{score.toLocaleString('en-US')}</div>
          </div>
          <div className="stat-block">
            <div className="stat-label">level</div>
            <div className="stat-value" data-testid="text-level">{String(level).padStart(2, '0')}</div>
          </div>
          <div className="stat-block">
            <div className="stat-label">lines</div>
            <div className="stat-value" data-testid="text-lines">{String(lines).padStart(2, '0')}</div>
          </div>
          <div className="stat-block next-stat">
            <div className="stat-label">next piece</div>
            <div className="next-box"><Preview piece={next} /></div>
          </div>
          <div className="button-row">
            <button className="action-button" data-testid="button-pause" onClick={togglePause}>
              {status === 'paused' ? 'resume' : 'pause'}
            </button>
            <button className="action-button primary" data-testid="button-restart" onClick={restart}>restart</button>
          </div>
          <p className="tip"><b>Tip:</b> build a flat shelf before chasing the long piece. The board remembers every shortcut.</p>
        </aside>
      </section>
    </main>
  );
}

export default App;