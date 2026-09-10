import { useEffect, useRef, useState, useCallback } from 'react';

type ItemType = 'egg' | 'heart' | 'golden_egg' | 'star';

interface FallingItem {
  id: number;
  x: number;
  y: number;
  speed: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  type: ItemType;
  glow: boolean;
}

interface GameState {
  score: number;
  lives: number;
  maxLives: number;
  isPlaying: boolean;
  isGameOver: boolean;
  level: number;
  highScore: number;
}

interface BonusEffect {
  x: number;
  y: number;
  id: number;
  type: ItemType;
  text: string;
}

const GAME_CONFIG = {
  BASKET_WIDTH: 80,
  BASKET_HEIGHT: 60,
  EGG_SIZE: 36,
  INITIAL_LIVES: 3,
  MAX_LIVES: 5,
  EGG_SPAWN_INTERVAL: 1200,
  MIN_SPAWN_INTERVAL: 400,
  BASE_SPEED: 2,
  MAX_SPEED: 6,
  BASKET_SPEED: 8,
  LEVEL_THRESHOLD: 10,
  // Шансы появления бонусов (из 100)
  HEART_CHANCE: 8,        // 8% шанс сердечка
  GOLDEN_EGG_CHANCE: 5,   // 5% шанс золотого яйца
  STAR_CHANCE: 3,         // 3% шанс звезды
  // Эффекты бонусов
  HEART_HEAL: 1,          // Восстанавливает 1 жизнь
  GOLDEN_EGG_POINTS: 5,   // Даёт 5 очков
  STAR_POINTS: 10,        // Даёт 10 очков + 1 жизнь
};

const ITEM_EMOJI: Record<ItemType, string> = {
  egg: '🥚',
  heart: '❤️',
  golden_egg: '🌟',
  star: '⭐',
};

const ITEM_SIZE_MULTIPLIER: Record<ItemType, number> = {
  egg: 1,
  heart: 1.1,
  golden_egg: 1.2,
  star: 1.15,
};

function App() {
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const itemsRef = useRef<FallingItem[]>([]);
  const basketXRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const touchStartRef = useRef<number | null>(null);
  const itemIdCounter = useRef(0);

  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    lives: GAME_CONFIG.INITIAL_LIVES,
    maxLives: GAME_CONFIG.MAX_LIVES,
    isPlaying: false,
    isGameOver: false,
    level: 1,
    highScore: parseInt(localStorage.getItem('eggCatchHighScore') || '0'),
  });

  const [items, setItems] = useState<FallingItem[]>([]);
  const [basketX, setBasketX] = useState(0);
  const [catchEffects, setCatchEffects] = useState<BonusEffect[]>([]);
  const [missEffect, setMissEffect] = useState<{ x: number; id: number } | null>(null);
  const [screenFlash, setScreenFlash] = useState<string | null>(null);

  const getGameArea = useCallback(() => {
    if (!gameAreaRef.current) return { width: 800, height: 600 };
    return {
      width: gameAreaRef.current.clientWidth,
      height: gameAreaRef.current.clientHeight,
    };
  }, []);

  const getRandomItemType = (): ItemType => {
    const roll = Math.random() * 100;
    if (roll < GAME_CONFIG.STAR_CHANCE) return 'star';
    if (roll < GAME_CONFIG.STAR_CHANCE + GAME_CONFIG.GOLDEN_EGG_CHANCE) return 'golden_egg';
    if (roll < GAME_CONFIG.STAR_CHANCE + GAME_CONFIG.GOLDEN_EGG_CHANCE + GAME_CONFIG.HEART_CHANCE) return 'heart';
    return 'egg';
  };

  const spawnItem = useCallback(() => {
    const { width } = getGameArea();
    const level = gameState.level;
    const type = getRandomItemType();
    const isBonus = type !== 'egg';
    const baseSpeed = GAME_CONFIG.BASE_SPEED + Math.random() * (GAME_CONFIG.MAX_SPEED - GAME_CONFIG.BASE_SPEED) * (1 + level * 0.15);
    // Бонусы падают чуть медленнее, чтобы их было легче поймать
    const speed = isBonus ? baseSpeed * 0.7 : baseSpeed;
    const size = GAME_CONFIG.EGG_SIZE * ITEM_SIZE_MULTIPLIER[type] + Math.random() * 8 - 4;

    const newItem: FallingItem = {
      id: itemIdCounter.current++,
      x: Math.random() * (width - size),
      y: -size,
      speed,
      size,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * (isBonus ? 2 : 4),
      type,
      glow: isBonus,
    };

    itemsRef.current = [...itemsRef.current, newItem];
  }, [gameState.level, getGameArea]);

  const checkCollision = useCallback((item: FallingItem, bX: number): boolean => {
    const { height } = getGameArea();
    const basketTop = height - GAME_CONFIG.BASKET_HEIGHT - 10;
    const basketLeft = bX;
    const basketRight = bX + GAME_CONFIG.BASKET_WIDTH;
    const itemCenterX = item.x + item.size / 2;
    const itemBottom = item.y + item.size;

    return (
      itemBottom >= basketTop &&
      itemBottom <= basketTop + GAME_CONFIG.BASKET_HEIGHT / 2 &&
      itemCenterX >= basketLeft &&
      itemCenterX <= basketRight
    );
  }, [getGameArea]);

  const addCatchEffect = useCallback((x: number, y: number, type: ItemType, text: string) => {
    const effect: BonusEffect = { x, y, id: Date.now() + Math.random(), type, text };
    setCatchEffects(prev => [...prev, effect]);
    setTimeout(() => {
      setCatchEffects(prev => prev.filter(e => e.id !== effect.id));
    }, 800);
  }, []);

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

    // Spawn items
    const spawnInterval = Math.max(
      GAME_CONFIG.MIN_SPAWN_INTERVAL,
      GAME_CONFIG.EGG_SPAWN_INTERVAL - gameState.level * 80
    );

    if (timestamp - lastSpawnRef.current > spawnInterval) {
      spawnItem();
      lastSpawnRef.current = timestamp;
    }

    // Update items
    let eggsCaught = 0;
    let heartsCaught = 0;
    let goldenEggsCaught = 0;
    let starsCaught = 0;
    let missed = 0;
    let missX = 0;

    itemsRef.current = itemsRef.current.filter((item) => {
      item.y += item.speed;
      item.rotation += item.rotationSpeed;

      // Check collision with basket
      if (checkCollision(item, basketXRef.current)) {
        switch (item.type) {
          case 'egg':
            eggsCaught++;
            addCatchEffect(item.x, height - GAME_CONFIG.BASKET_HEIGHT - 20, 'egg', '+1');
            break;
          case 'heart':
            heartsCaught++;
            addCatchEffect(item.x, height - GAME_CONFIG.BASKET_HEIGHT - 20, 'heart', '+❤️');
            setScreenFlash('pink');
            setTimeout(() => setScreenFlash(null), 300);
            break;
          case 'golden_egg':
            goldenEggsCaught++;
            addCatchEffect(item.x, height - GAME_CONFIG.BASKET_HEIGHT - 20, 'golden_egg', '+5⭐');
            setScreenFlash('gold');
            setTimeout(() => setScreenFlash(null), 300);
            break;
          case 'star':
            starsCaught++;
            addCatchEffect(item.x, height - GAME_CONFIG.BASKET_HEIGHT - 20, 'star', '+10⭐ +❤️');
            setScreenFlash('yellow');
            setTimeout(() => setScreenFlash(null), 400);
            break;
        }
        return false;
      }

      // Check if item fell off screen - только обычные яйца снимают жизни
      if (item.y > height) {
        if (item.type === 'egg') {
          missed++;
          missX = item.x;
        }
        return false;
      }

      return true;
    });

    setItems([...itemsRef.current]);

    const totalCaught = eggsCaught + heartsCaught + goldenEggsCaught + starsCaught;
    if (totalCaught > 0 || missed > 0) {
      setGameState((prev) => {
        // Подсчёт очков
        const pointsFromEggs = eggsCaught * 1;
        const pointsFromGolden = goldenEggsCaught * GAME_CONFIG.GOLDEN_EGG_POINTS;
        const pointsFromStars = starsCaught * GAME_CONFIG.STAR_POINTS;
        const newScore = prev.score + pointsFromEggs + pointsFromGolden + pointsFromStars;

        // Подсчёт жизней
        const healFromHearts = heartsCaught * GAME_CONFIG.HEART_HEAL;
        const healFromStars = starsCaught * 1; // Звезда тоже лечит
        const totalHeal = healFromHearts + healFromStars;
        const newLives = Math.min(prev.maxLives, prev.lives - missed + totalHeal);
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
  }, [gameState.isPlaying, gameState.level, getGameArea, spawnItem, checkCollision, addCatchEffect]);

  const startGame = useCallback(() => {
    itemsRef.current = [];
    setItems([]);
    setCatchEffects([]);
    basketXRef.current = getGameArea().width / 2 - GAME_CONFIG.BASKET_WIDTH / 2;
    setBasketX(basketXRef.current);
    lastSpawnRef.current = 0;

    setGameState((prev) => ({
      score: 0,
      lives: GAME_CONFIG.INITIAL_LIVES,
      maxLives: GAME_CONFIG.MAX_LIVES,
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

  const getItemStyle = (item: FallingItem) => {
    const baseStyle = {
      left: item.x + 'px',
      top: item.y + 'px',
      width: item.size + 'px',
      height: item.size + 'px',
      transform: `rotate(${item.rotation}deg)`,
      fontSize: item.size * 0.85 + 'px',
      lineHeight: 1,
    };

    if (item.glow) {
      const glowColors: Record<string, string> = {
        heart: 'drop-shadow(0 0 8px rgba(239,68,68,0.8)) drop-shadow(0 0 16px rgba(239,68,68,0.4))',
        golden_egg: 'drop-shadow(0 0 10px rgba(234,179,8,0.9)) drop-shadow(0 0 20px rgba(234,179,8,0.5))',
        star: 'drop-shadow(0 0 10px rgba(250,204,21,0.9)) drop-shadow(0 0 20px rgba(250,204,21,0.5))',
      };
      return {
        ...baseStyle,
        filter: glowColors[item.type] || 'none',
        animation: 'pulse 1s ease-in-out infinite',
      };
    }

    return {
      ...baseStyle,
      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
    };
  };

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
        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20">
            <span className="text-yellow-300 text-xs font-medium">⭐ Счёт</span>
            <span className="text-white text-lg font-bold ml-2">{gameState.score}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20">
            <span className="text-purple-300 text-xs font-medium">📊 Ур.</span>
            <span className="text-white text-lg font-bold ml-1">{gameState.level}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: gameState.maxLives }).map((_, i) => (
            <span
              key={i}
              className={`text-xl transition-all duration-300 ${
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
        {/* Screen flash effect */}
        {screenFlash && (
          <div
            className="absolute inset-0 z-30 pointer-events-none animate-pulse"
            style={{
              background: screenFlash === 'pink'
                ? 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, transparent 70%)'
                : screenFlash === 'gold'
                ? 'radial-gradient(circle, rgba(234,179,8,0.3) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(250,204,21,0.4) 0%, transparent 70%)',
            }}
          />
        )}

        {/* Ground */}
        <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-green-800 to-green-600 opacity-60" />

        {/* Falling Items */}
        {items.map((item) => (
          <div
            key={item.id}
            className="absolute transition-none pointer-events-none"
            style={getItemStyle(item)}
          >
            {ITEM_EMOJI[item.type]}
          </div>
        ))}

        {/* Catch Effects */}
        {catchEffects.map((effect) => (
          <div
            key={effect.id}
            className="absolute pointer-events-none z-20"
            style={{
              left: effect.x + 'px',
              top: effect.y + 'px',
              animation: 'floatUp 0.8s ease-out forwards',
            }}
          >
            <div className={`text-lg font-bold whitespace-nowrap ${
              effect.type === 'heart' ? 'text-red-400' :
              effect.type === 'golden_egg' ? 'text-yellow-400' :
              effect.type === 'star' ? 'text-amber-300' :
              'text-green-400'
            }`}
            style={{ textShadow: '0 0 10px currentColor' }}
            >
              {effect.text}
            </div>
          </div>
        ))}

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
            <div className="text-center p-6 max-w-md mx-4">
              <div className="text-6xl mb-4 animate-bounce">🥚</div>
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 drop-shadow-lg">
                Поймай Яйцо!
              </h1>
              <p className="text-white/80 text-base mb-4">
                Лови яйца корзиной, не дай им упасть!
              </p>
              
              {/* Bonus items legend */}
              <div className="bg-white/10 rounded-xl p-3 mb-5 border border-white/20">
                <p className="text-white/70 text-xs mb-2 font-medium">✨ Бонусные предметы:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">❤️</span>
                    <span className="text-white/80 text-xs">+1 жизнь</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🌟</span>
                    <span className="text-white/80 text-xs">+5 очков</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⭐</span>
                    <span className="text-white/80 text-xs">+10 очков +❤️</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🥚</span>
                    <span className="text-white/80 text-xs">+1 очко</span>
                  </div>
                </div>
              </div>

              <p className="text-white/60 text-sm mb-5">
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
              <p className="text-white/40 text-xs mt-3">
                или нажмите Пробел
              </p>
            </div>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState.isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20">
            <div className="text-center p-6 bg-white/10 rounded-3xl border border-white/20 backdrop-blur-md max-w-sm mx-4">
              <div className="text-5xl mb-4">😢</div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
                Игра окончена!
              </h2>
              <div className="space-y-2 my-5">
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

      {/* Custom keyframes */}
      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-60px) scale(1.3);
            opacity: 0;
          }
        }
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.15);
          }
        }
      `}</style>
    </div>
  );
}

export default App;
