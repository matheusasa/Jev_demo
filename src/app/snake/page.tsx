'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

const CANVAS_SIZE = 400;
const CELL = 20;
const GRID = CANVAS_SIZE / CELL;
const DIRECTIONS = ['UP', 'RIGHT', 'DOWN', 'LEFT'] as const;
type Direction = (typeof DIRECTIONS)[number];
const DIR_MAP: Record<Direction, { x: number; y: number }> = {
  UP: { x: 0, y: -1 },
  RIGHT: { x: 1, y: 0 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
};
const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN',
  RIGHT: 'LEFT',
  DOWN: 'UP',
  LEFT: 'RIGHT',
};

interface Point {
  x: number;
  y: number;
}

interface JevDecision {
  decision: Direction;
  confidence: number;
  probabilities: Record<string, number>;
  latencyMs: string;
  model: string;
}

export default function SnakePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [apiKey, setApiKey] = useState('');
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [decision, setDecision] = useState<JevDecision | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Pronto para iniciar');
  const [lastRequest, setLastRequest] = useState<string>('');
  const [lastResponse, setLastResponse] = useState<string>('');

  // Game state refs (avoid stale closures in interval)
  const snakeRef = useRef<Point[]>([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]);
  const foodRef = useRef<Point>({ x: 15, y: 10 });
  const dirRef = useRef<Direction>('RIGHT');
  const pendingRef = useRef(false);
  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const gameOverRef = useRef(false);
  const scoreRef = useRef(0);

  const spawnFood = useCallback(() => {
    const occupied = new Set(snakeRef.current.map((s) => `${s.x},${s.y}`));
    const free: Point[] = [];
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        if (!occupied.has(`${x},${y}`)) free.push({ x, y });
      }
    }
    if (free.length === 0) return foodRef.current;
    return free[Math.floor(Math.random() * free.length)];
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#141B2D';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.strokeStyle = 'rgba(139,149,168,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(CANVAS_SIZE, i * CELL);
      ctx.stroke();
    }

    ctx.fillStyle = '#FF6B35';
    ctx.beginPath();
    ctx.arc(
      foodRef.current.x * CELL + CELL / 2,
      foodRef.current.y * CELL + CELL / 2,
      CELL / 2 - 2,
      0,
      Math.PI * 2
    );
    ctx.fill();

    const snake = snakeRef.current;
    for (let i = 0; i < snake.length; i++) {
      const alpha = i === 0 ? 1 : 0.6 - (i / snake.length) * 0.3;
      ctx.fillStyle = i === 0 ? '#00D4AA' : `rgba(0,212,170,${alpha})`;
      ctx.fillRect(snake[i].x * CELL + 1, snake[i].y * CELL + 1, CELL - 2, CELL - 2);
    }
  }, []);

  const callJev = async (state: {
    head: Point;
    food: Point;
    snake: Point[];
    snakeLen: number;
    currentDir: Direction;
    score: number;
  }): Promise<JevDecision> => {
    const start = performance.now();

    const occupied = new Set(state.snake.map((s) => `${s.x},${s.y}`));
    const validMoves: Record<string, string> = {};
    for (const dir of DIRECTIONS) {
      if (dir === OPPOSITE[state.currentDir] && state.snakeLen > 1) continue;
      const nx = state.head.x + DIR_MAP[dir].x;
      const ny = state.head.y + DIR_MAP[dir].y;
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
      if (occupied.has(`${nx},${ny}`)) continue;
      const dist = Math.abs(nx - state.food.x) + Math.abs(ny - state.food.y);
      let freeCount = 0;
      for (const d2 of DIRECTIONS) {
        const fx = nx + DIR_MAP[d2].x;
        const fy = ny + DIR_MAP[d2].y;
        if (fx >= 0 && fx < GRID && fy >= 0 && fy < GRID && !occupied.has(`${fx},${fy}`)) freeCount++;
      }
      validMoves[dir] = `Lands on (${nx},${ny}). Distance to food after move: ${dist}. Open neighbors from landing cell: ${freeCount}.`;
    }

    const stateText = `Snake on ${GRID}x${GRID} grid. Head (${state.head.x},${state.head.y}), food (${state.food.x},${state.food.y}), length ${state.snakeLen}, heading ${state.currentDir}, score ${state.score}. Body: ${state.snake.map((s) => `(${s.x},${s.y})`).join(', ')}.`;

    const requestBody = {
      model: 'jev-latest',
      state: stateText,
      questions: {
        next_move: {
          type: 'choice',
          instructions: 'Choose the direction that gets closer to the food while keeping future moves open. Prefer lower distance and more open neighbors. Only listed options are legal.',
          criteria: validMoves,
        },
      },
    };
    setLastRequest(JSON.stringify(requestBody, null, 2));

    const response = await fetch('/api/jev', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const err = await response.text();
      setLastResponse(err);
      throw new Error(`API ${response.status}: ${err}`);
    }

    const data = await response.json();
    setLastResponse(JSON.stringify(data, null, 2));
    const latency = (performance.now() - start).toFixed(1);
    const answer = data.answers.next_move;

    return {
      decision: answer.choice as Direction,
      confidence: answer.confidence,
      probabilities: answer.probabilities,
      latencyMs: latency,
      model: data.model,
    };
  };

  const fallbackDecision = (currentDir: Direction): JevDecision => {
    const safeDirs = DIRECTIONS.filter((dir) => {
      if (dir === OPPOSITE[currentDir] && snakeRef.current.length > 1) return false;
      const nx = snakeRef.current[0].x + DIR_MAP[dir].x;
      const ny = snakeRef.current[0].y + DIR_MAP[dir].y;
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) return false;
      if (snakeRef.current.some((s) => s.x === nx && s.y === ny)) return false;
      return true;
    });

    if (safeDirs.length === 0) {
      return {
        decision: currentDir,
        confidence: 0,
        probabilities: { UP: 0.25, RIGHT: 0.25, DOWN: 0.25, LEFT: 0.25 },
        latencyMs: '0',
        model: 'fallback',
      };
    }

    const pick = safeDirs[Math.floor(Math.random() * safeDirs.length)];
    const probs: Record<string, number> = {};
    DIRECTIONS.forEach((d) => (probs[d] = d === pick ? 0.9 : 0.1 / (safeDirs.length - 1 || 1)));

    return { decision: pick, confidence: 0.9, probabilities: probs, latencyMs: '0', model: 'fallback' };
  };

  const tick = useCallback(async () => {
    if (!runningRef.current || pausedRef.current || gameOverRef.current || pendingRef.current) return;

    const snake = snakeRef.current;
    const head = snake[0];
    const state = {
      head,
      food: foodRef.current,
      snake,
      snakeLen: snake.length,
      currentDir: dirRef.current,
      score: scoreRef.current,
    };

    let result: JevDecision;
    try {
      pendingRef.current = true;
      result = await callJev(state);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
      result = fallbackDecision(dirRef.current);
    } finally {
      pendingRef.current = false;
    }

    setDecision(result);

    const isSafe = (dir: Direction) => {
      if (dir === OPPOSITE[dirRef.current] && snakeRef.current.length > 1) return false;
      const nx = head.x + DIR_MAP[dir].x;
      const ny = head.y + DIR_MAP[dir].y;
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) return false;
      if (snake.some((s) => s.x === nx && s.y === ny)) return false;
      return true;
    };

    let safeDecision: Direction = result.decision;
    if (!isSafe(safeDecision)) {
      const fallback = DIRECTIONS.find((d) => isSafe(d));
      if (fallback) {
        safeDecision = fallback;
      } else {
        gameOverRef.current = true;
        runningRef.current = false;
        setGameOver(true);
        setRunning(false);
        setStatus(`Fim de jogo — Pontuação: ${scoreRef.current}`);
        draw();
        return;
      }
    }

    dirRef.current = safeDecision;
    const move = DIR_MAP[safeDecision];
    const newHead = { x: head.x + move.x, y: head.y + move.y };

    snake.unshift(newHead);
    if (newHead.x === foodRef.current.x && newHead.y === foodRef.current.y) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      foodRef.current = spawnFood();
    } else {
      snake.pop();
    }

    draw();
  }, [apiKey, draw, spawnFood]);

  useEffect(() => {
    if (!running || paused || gameOver) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled) return;
      timeoutId = setTimeout(async () => {
        await tick();
        scheduleNext();
      }, 800);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [running, paused, gameOver, tick]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleStart = () => {
    if (!apiKey.trim()) {
      setError('Cole sua API key acima antes de iniciar');
      return;
    }
    snakeRef.current = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    foodRef.current = spawnFood();
    dirRef.current = 'RIGHT';
    scoreRef.current = 0;
    setScore(0);
    setGameOver(false);
    gameOverRef.current = false;
    runningRef.current = true;
    pausedRef.current = false;
    setRunning(true);
    setPaused(false);
    setDecision(null);
    setError('');
    setStatus('Rodando — JEV decidindo a cada tick');
    draw();
  };

  const handlePause = () => {
    if (!running) return;
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    setStatus(pausedRef.current ? 'Pausado' : 'Rodando — JEV decidindo a cada tick');
  };

  const dirLabels: Record<Direction, string> = {
    UP: '↑ Cima',
    RIGHT: '→ Direita',
    DOWN: '↓ Baixo',
    LEFT: '← Esquerda',
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] text-[#E8ECF4] font-[Inter,sans-serif] flex flex-col items-center justify-center p-4">
      <h1 className="font-[Space_Grotesk,sans-serif] font-bold text-2xl tracking-tight mb-4">
        <span className="text-[#00D4AA]">JEV</span> Snake — Decisão em Tempo Real
      </h1>

      <div className="flex gap-2 items-center mb-6 w-full max-w-[720px]">
        <label className="font-[Space_Grotesk,sans-serif] text-xs font-semibold text-[#8B95A8] whitespace-nowrap">
          API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Cole sua TypeSafe API key aqui (sk-...)"
          className="flex-1 font-[JetBrains_Mono,monospace] text-xs px-3 py-2 border border-[rgba(139,149,168,0.2)] rounded bg-[#141B2D] text-[#E8ECF4] outline-none focus:border-[#00D4AA]"
        />
      </div>

      <div className="flex gap-8 items-start flex-wrap justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="border border-[rgba(139,149,168,0.15)] rounded bg-[#141B2D]"
        />

        <div className="w-[280px] flex flex-col gap-4">
          {/* Decision Card */}
          <div className="bg-[#141B2D] border border-[rgba(139,149,168,0.12)] rounded p-4">
            <div className="font-[Space_Grotesk,sans-serif] text-[0.7rem] font-semibold text-[#8B95A8] uppercase tracking-widest mb-2">
              Decisão Atual
            </div>
            <div className="font-[JetBrains_Mono,monospace] text-2xl font-medium text-[#00D4AA] leading-none">
              {decision ? dirLabels[decision.decision] || decision.decision : '—'}
            </div>
            <div className="mt-2 h-1.5 bg-[rgba(139,149,168,0.15)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  decision && decision.confidence < 0.5 ? 'bg-[#FF6B35]' : 'bg-[#00D4AA]'
                }`}
                style={{ width: decision ? `${(decision.confidence * 100).toFixed(1)}%` : '0%' }}
              />
            </div>
            <div className="font-[JetBrains_Mono,monospace] text-xs text-[#8B95A8] mt-1">
              Confiança: {decision ? `${(decision.confidence * 100).toFixed(1)}%` : '—'}
            </div>
            <div className="font-[JetBrains_Mono,monospace] text-[0.65rem] text-[#8B95A8] mt-1">
              Latência: {decision ? `${decision.latencyMs}ms · ${decision.model}` : '—'}
            </div>
            {error && (
              <div className="text-[#FF6B35] text-xs mt-1 font-[JetBrains_Mono,monospace]">{error}</div>
            )}
          </div>

          {/* Probabilities Card */}
          <div className="bg-[#141B2D] border border-[rgba(139,149,168,0.12)] rounded p-4">
            <div className="font-[Space_Grotesk,sans-serif] text-[0.7rem] font-semibold text-[#8B95A8] uppercase tracking-widest mb-2">
              Probabilidades
            </div>
            {decision ? (
              DIRECTIONS.map((dir) => {
                const p = ((decision.probabilities[dir] || 0) * 100).toFixed(1);
                const isActive = dir === decision.decision;
                return (
                  <div key={dir} className="flex justify-between items-center mb-1">
                    <span className="font-[JetBrains_Mono,monospace] text-[0.7rem] text-[#8B95A8]">
                      {dirLabels[dir]}
                    </span>
                    <span
                      className={`font-[JetBrains_Mono,monospace] text-[0.7rem] ${
                        isActive ? 'text-[#00D4AA] font-medium' : 'text-[#E8ECF4]'
                      }`}
                    >
                      {p}%
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-[#8B95A8] text-xs">Aguardando primeira decisão...</div>
            )}
          </div>

          {/* State Card */}
          <div className="bg-[#141B2D] border border-[rgba(139,149,168,0.12)] rounded p-4">
            <div className="font-[Space_Grotesk,sans-serif] text-[0.7rem] font-semibold text-[#8B95A8] uppercase tracking-widest mb-2">
              Estado do Jogo
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="font-[JetBrains_Mono,monospace] text-[0.7rem] text-[#8B95A8]">
                Cabeça: <span className="text-[#E8ECF4]">{snakeRef.current[0]?.x},{snakeRef.current[0]?.y}</span>
              </div>
              <div className="font-[JetBrains_Mono,monospace] text-[0.7rem] text-[#8B95A8]">
                Comida: <span className="text-[#E8ECF4]">{foodRef.current.x},{foodRef.current.y}</span>
              </div>
              <div className="font-[JetBrains_Mono,monospace] text-[0.7rem] text-[#8B95A8]">
                Tamanho: <span className="text-[#E8ECF4]">{snakeRef.current.length}</span>
              </div>
              <div className="font-[JetBrains_Mono,monospace] text-[0.7rem] text-[#8B95A8]">
                Pontos: <span className="text-[#E8ECF4]">{score}</span>
              </div>
            </div>
          </div>

          {/* Debug: Last Request */}
          {lastRequest && (
            <div className="bg-[#141B2D] border border-[rgba(139,149,168,0.12)] rounded p-4">
              <div className="font-[Space_Grotesk,sans-serif] text-[0.7rem] font-semibold text-[#8B95A8] uppercase tracking-widest mb-2">
                Request → JEV
              </div>
              <pre className="font-[JetBrains_Mono,monospace] text-[0.6rem] text-[#E8ECF4] whitespace-pre-wrap break-all max-h-40 overflow-auto bg-[#0A0E17] rounded p-2 leading-relaxed">
                {lastRequest}
              </pre>
            </div>
          )}

          {/* Debug: Last Response */}
          {lastResponse && (
            <div className="bg-[#141B2D] border border-[rgba(139,149,168,0.12)] rounded p-4">
              <div className="font-[Space_Grotesk,sans-serif] text-[0.7rem] font-semibold text-[#8B95A8] uppercase tracking-widest mb-2">
                Response ← JEV
              </div>
              <pre className="font-[JetBrains_Mono,monospace] text-[0.6rem] text-[#E8ECF4] whitespace-pre-wrap break-all max-h-40 overflow-auto bg-[#0A0E17] rounded p-2 leading-relaxed">
                {lastResponse}
              </pre>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={handleStart}
              className="font-[Space_Grotesk,sans-serif] text-sm font-semibold px-5 py-2 rounded border border-[#00D4AA] bg-[#00D4AA] text-[#0A0E17] hover:bg-[#00bfa0] cursor-pointer transition-colors"
            >
              {gameOver ? 'Reiniciar' : 'Iniciar'}
            </button>
            <button
              onClick={handlePause}
              className="font-[Space_Grotesk,sans-serif] text-sm font-semibold px-5 py-2 rounded border border-[rgba(139,149,168,0.2)] bg-[#141B2D] text-[#E8ECF4] hover:border-[#00D4AA] cursor-pointer transition-colors"
            >
              {paused ? 'Continuar' : 'Pausar'}
            </button>
          </div>

          <div className="font-[JetBrains_Mono,monospace] text-[0.7rem] text-[#8B95A8] mt-2">{status}</div>
        </div>
      </div>
    </div>
  );
}