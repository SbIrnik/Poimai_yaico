import { useEffect, useRef, useState, useCallback } from 'react';

interface Egg {
  id: number;
  x: number;
  y: number;
  speed: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
}

interface GameState {
  score: number;
  lives: number;
  isPlaying: boolean;
  isGameOver: boolean;
  level: number;
  highScore: number;
}

const GAME_CONFIG = {
  BASKET_WIDTH: 80,
  BASKET_HEIGHT: 60,
  EGG_SIZE: 36,
  INITIAL_LIVES: 3,
  EGG_SPAWN_INTERVAL: 1200,
  MIN_SPAWN_INTERVAL: 400,
  BASE_SPEED: 2,
  MAX_SPEED: 6,
  BASKET_SPEED: 8,
  LEVEL_THRESHOLD: 10,
};

function App() {
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const eggsRef = useRef<Egg[]>([]);
  const basketXRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const touchStartRef = useRef<number | null>(null);
  const eggIdCounter = useRef(0);

  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    lives: GAME_CONFIG.INITIAL_LIVES,
    isPlaying: false,
    isGameOver: false,
    level: 1,
    highScore: parseInt(localStorage.getItem('eggCatchHighScore') || '0'),
  });

  const [eggs, setEggs] = useState<Egg[]>([]);
  const [basketX, setBasketX] = useState(0);
  const [catchEffect, setCatchEffect] = useState<{ x: number; y: number; id: number } | null>(null);
  const [missEffect, setMissEffect] = useState<{ x: number; id: number } | null>(null);

  const getGameArea = useCallback(() => {
    if (!gameAreaRef.current) return { width: 800, height: 600 };
    return {
      width: gameAreaRef.current.clientWidth,
      height: gameAreaRef.current.clientHeight,
    };
  }, []);

  const spawnEgg = useCallback(() => {
    const { width } = getGameArea();
    const level = gameState.level;
    const speed = GAME_CONFIG.BASE_SPEED + Math.random() * (GAME_CONFIG.MAX_SPEED - GAME_CONFIG.BASE_SPEED) * (1 + level * 0.15);
    const size = GAME_CONFIG.EGG_SIZE + Math.random() * 8 - 4;

    const newEgg: Egg = {
      id: eggIdCounter.current++,
      x: Math.random() * (width - size),
      y: -size,
      speed,
      size,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 4,
    };

    eggsRef.current = [...eggsRef.current, newEgg];
  }, [gameState.level, getGameArea]);

  const checkCollision = useCallback((egg: Egg, bX: number): boolean => {
    const { height } = getGameArea();
    const basketTop = height - GAME_CONFIG.BASKET_HEIGHT - 10;
    const basketLeft = bX;
    const basketRight = bX + GAME_CONFIG.BASKET_WIDTH;
    const eggCenterX = egg.x + egg.size / 2;
    const eggBottom = egg.y + egg.size;

    return (
      eggBottom >= basketTop &&
      eggBottom <= basketTop + GAME_CONFIG.BASKET_HEIGHT / 2 &&
      eggCenterX >= basketLeft &&
      eggCenterX <= basketRight
    );
  }, [getGameArea]);

  const gameLoop = useCallback((timestamp: number) => {
    if (!gameState.isPlaying) return;

    const { width, height } = getGameArea();

    // Move basket based on keys
    if (keysRef.current.has('ArrowLeft') || keysRef.current.has('a')) {
      basketXRef.current = Math.max(0, basketXRef.current - GAME_CONFIG.BASKET_SPEED);
    }
    if (keysRef.current.has('ArrowRight') || keysRef.current.has('d')) {
      basketXRef.current = Math.min(width - GAME_CONFIG.BASKET_WIDTH, basketXRef.current + GAME_CONFIG.BASKET_SPEED);
    }
    setBasketX(basketXRef.current);

    // Spawn eggs
    const spawnInterval = Math.max(
      GAME_CONFIG.MIN_SPAWN_INTERVAL,
      GAME_CONFIG.EGG_SPAWN_INTERVAL - gameState.level * 80
    );

    if (timestamp - lastSpawnRef.current > spawnInterval) {
      spawnEgg();
      lastSpawnRef.current = timestamp;
    }

    // Update eggs
    let caught = 0;
    let missed = 0;
    let missX = 0;

    eggsRef.current = eggsRef.current.filter((egg) => {
      egg.y += egg.speed;
      egg.rotation += egg.rotationSpeed;

      // Check collision with basket
      if (checkCollision(egg, basketXRef.current)) {
        caught++;
        setCatchEffect({ x: egg.x, y: height - GAME_CONFIG.BASKET_HEIGHT - 20, id: egg.id });
        setTimeout(() => setCatchEffect(null), 300);
        return false;
      }

      // Check if egg fell off screen
      if (egg.y > height) {
        missed++;
        missX = egg.x;
        return false;
      }

      return true;
    });

    setEggs([...eggsRef.current]);

    if (caught > 0 || missed > 0) {
      setGameState((prev) => {
        const newScore = prev.score + caught;
        const newLives = prev.lives - missed;
        const newLevel = Math.floor(newScore / GAME_CONFIG.LEVEL_THRESHOLD) + 1;

        if (missed > 0) {
          setMissEffect({ x: missX, id: Date.now() });
          setTimeout(() => setMissEffect(null), 500);
        }

        if (newLives <= 0) {
          const newHighScore = Math.max(newScore, prev.highScore);
          localStorage.setItem('eggCatchHighScore', newHighScore.toString());
          return {
            ...prev,
            score: newScore,
            lives: 0,
            isPlaying: false,
            isGameOver: true,
            level: newLevel,
            highScore: newHighScore,
          };
        }

        return {
          ...prev,
          score: newScore,
          lives: newLives,
          level: newLevel,
        };
      });
    }

    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [gameState.isPlaying, gameState.level, getGameArea, spawnEgg, checkCollision]);

  const startGame = useCallback(() => {
    eggsRef.current = [];
    setEggs([]);
    basketXRef.current = getGameArea().width / 2 - GAME_CONFIG.BASKET_WIDTH / 2;
    setBasketX(basketXRef.current);
    lastSpawnRef.current = 0;

    setGameState((prev) => ({
      score: 0,
      lives: GAME_CONFIG.INITIAL_LIVES,
      isPlaying: true,
      isGameOver: false,
      level: 1,
      highScore: prev.highScore,
    }));
  }, [getGameArea]);

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key === ' ' && !gameState.isPlaying) {
        startGame();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState.isPlaying, startGame]);

  // Touch events
  useEffect(() => {
    const gameArea = gameAreaRef.current;
    if (!gameArea) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      touchStartRef.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!gameAreaRef.current) return;
      const rect = gameAreaRef.current.getBoundingClientRect();
      const touchX = e.touches[0].clientX - rect.left;
      basketXRef.current = Math.max(
        0,
        Math.min(rect.width - GAME_CONFIG.BASKET_WIDTH, touchX - GAME_CONFIG.BASKET_WIDTH / 2)
      );
      setBasketX(basketXRef.current);
    };

    const handleTouchEnd = () => {
      touchStartRef.current = null;
    };

    gameArea.addEventListener('touchstart', handleTouchStart, { passive: false });
    gameArea.addEventListener('touchmove', handleTouchMove, { passive: false });
    gameArea.addEventListener('touchend', handleTouchEnd);

    return () => {
      gameArea.removeEventListener('touchstart', handleTouchStart);
      gameArea.removeEventListener('touchmove', handleTouchMove);
      gameArea.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Game loop
  useEffect(() => {
    if (gameState.isPlaying) {
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState.isPlaying, gameLoop]);

  // Initialize basket position
  useEffect(() => {
    const initPosition = () => {
      const { width } = getGameArea();
      basketXRef.current = width / 2 - GAME_CONFIG.BASKET_WIDTH / 2;
      setBasketX(basketXRef.current);
    };
    initPosition();
    window.addEventListener('resize', initPosition);
    return () => window.removeEventListener('resize', initPosition);
  }, [getGameArea]);

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col items-center justify-center bg-gradient-to-b from-sky-900 via-indigo-900 to-purple-950 select-none">
      {/* Stars background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              width: Math.random() * 3 + 1 + 'px',
              height: Math.random() * 3 + 1 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
              animationDelay: Math.random() * 3 + 's',
              animationDuration: Math.random() * 2 + 2 + 's',
              opacity: Math.random() * 0.7 + 0.3,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="w-full max-w-2xl px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
            <span className="text-yellow-300 text-sm font-medium">⭐ Счёт</span>
            <span className="text-white text-xl font-bold ml-2">{gameState.score}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
            <span className="text-purple-300 text-sm font-medium">📊 Уровень</span>
            <span className="text-white text-xl font-bold ml-2">{gameState.level}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {Array.from({ length: GAME_CONFIG.INITIAL_LIVES }).map((_, i) => (
            <span
              key={i}
              className={`text-2xl transition-all duration-300 ${
                i < gameState.lives ? 'scale-100 opacity-100' : 'scale-50 opacity-30 grayscale'
              }`}
            >
              ❤️
            </span>
          ))}
        </div>
      </div>

      {/* Game Area */}
      <div
        ref={gameAreaRef}
        className="relative w-full max-w-2xl flex-1 mx-4 mb-4 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl"
        style={{
          background: 'linear-gradient(180deg, rgba(30,41,59,0.8) 0%, rgba(51,65,85,0.6) 50%, rgba(34,197,94,0.3) 100%)',
        }}
      >
        {/* Ground */}
        <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-green-800 to-green-600 opacity-60" />

        {/* Eggs */}
        {eggs.map((egg) => (
          <div
            key={egg.id}
            className="absolute transition-none pointer-events-none"
            style={{
              left: egg.x + 'px',
              top: egg.y + 'px',
              width: egg.size + 'px',
              height: egg.size + 'px',
              transform: `rotate(${egg.rotation}deg)`,
              fontSize: egg.size * 0.85 + 'px',
              lineHeight: 1,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
            }}
          >
            🥚
          </div>
        ))}

        {/* Catch Effect */}
        {catchEffect && (
          <div
            className="absolute pointer-events-none animate-ping"
            style={{
              left: catchEffect.x + 'px',
              top: catchEffect.y + 'px',
              fontSize: '24px',
            }}
          >
            ✨
          </div>
        )}

        {/* Miss Effect */}
        {missEffect && (
          <div
            className="absolute bottom-4 pointer-events-none animate-bounce text-red-500 font-bold text-lg"
            style={{ left: missEffect.x + 'px' }}
          >
            💔
          </div>
        )}

        {/* Basket */}
        <div
          className="absolute transition-none"
          style={{
            left: basketX + 'px',
            bottom: '12px',
            width: GAME_CONFIG.BASKET_WIDTH + 'px',
            height: GAME_CONFIG.BASKET_HEIGHT + 'px',
            fontSize: '52px',
            lineHeight: 1,
            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))',
          }}
        >
          🧺
        </div>

        {/* Start Screen */}
        {!gameState.isPlaying && !gameState.isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-20">
            <div className="text-center p-8">
              <div className="text-6xl mb-4 animate-bounce">🥚</div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 drop-shadow-lg">
                Поймай Яйцо!
              </h1>
              <p className="text-white/80 text-lg mb-2">
                Лови яйца корзиной, не дай им упасть!
              </p>
              <p className="text-white/60 text-sm mb-6">
                ← → или касание для управления
              </p>
              {gameState.highScore > 0 && (
                <p className="text-yellow-300 text-lg mb-4">
                  🏆 Рекорд: {gameState.highScore}
                </p>
              )}
              <button
                onClick={startGame}
                className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xl font-bold rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-transform duration-150 hover:shadow-green-500/50 hover:shadow-xl"
              >
                🎮 Начать игру
              </button>
              <p className="text-white/40 text-xs mt-4">
                или нажмите Пробел
              </p>
            </div>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState.isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20">
            <div className="text-center p-8 bg-white/10 rounded-3xl border border-white/20 backdrop-blur-md max-w-sm mx-4">
              <div className="text-5xl mb-4">😢</div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
                Игра окончена!
              </h2>
              <div className="space-y-2 my-6">
                <p className="text-white text-xl">
                  Счёт: <span className="text-yellow-300 font-bold">{gameState.score}</span>
                </p>
                <p className="text-white text-lg">
                  Уровень: <span className="text-purple-300 font-bold">{gameState.level}</span>
                </p>
                {gameState.score >= gameState.highScore && gameState.score > 0 && (
                  <p className="text-yellow-400 text-lg font-bold animate-pulse">
                    🎉 Новый рекорд! 🎉
                  </p>
                )}
                <p className="text-white/60 text-sm">
                  🏆 Лучший результат: {gameState.highScore}
                </p>
              </div>
              <button
                onClick={startGame}
                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xl font-bold rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-transform duration-150 hover:shadow-blue-500/50 hover:shadow-xl"
              >
                🔄 Играть снова
              </button>
              <p className="text-white/40 text-xs mt-3">
                или нажмите Пробел
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-white/40 text-xs pb-2 text-center z-10">
        Используй ← → или двигай пальцем по экрану
      </div>
    </div>
  );
}

export default App;
