import { useEffect, useRef, useState, useCallback } from 'react';

type ItemType = 'egg' | 'bronze' | 'silver' | 'gold' | 'black' | 'heart' | 'star';

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
  // Шансы появления (из 100)
  BRONZE_CHANCE: 8,
  SILVER_CHANCE: 5,
  GOLD_CHANCE: 3,
  BLACK_CHANCE: 7,
  HEART_CHANCE: 6,
  STAR_CHANCE: 3,
  // Очки за каждое яйцо
  EGG_POINTS: 1,
  BRONZE_POINTS: 2,
  SILVER_POINTS: 3,
  GOLD_POINTS: 5,
  BLACK_POINTS: -3,
  STAR_POINTS: 10,
  HEART_HEAL: 1,
};

const ITEM_EMOJI: Record<ItemType, string> = {
  egg: '🥚',
  bronze: '🥚',
  silver: '🥚',
  gold: '🥚',
  black: '🥚',
  heart: '❤️',
  star: '⭐',
};

const ITEM_CSS_FILTER: Record<ItemType, string> = {
  egg: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
  bronze: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3)) sepia(1) saturate(3) hue-rotate(-15deg) brightness(0.85)',
  silver: 'drop-shadow(0 2px 6px rgba(192,192,192,0.5)) grayscale(1) brightness(1.6) contrast(0.9)',
  gold: 'drop-shadow(0 0 8px rgba(255,215,0,0.7)) sepia(1) saturate(5) hue-rotate(10deg) brightness(1.3)',
  black: 'drop-shadow(0 0 6px rgba(100,0,0,0.6)) brightness(0) invert(0) saturate(0) contrast(2)',
  heart: 'drop-shadow(0 0 8px rgba(239,68,68,0.8)) drop-shadow(0 0 16px rgba(239,68,68,0.4))',
  star: 'drop-shadow(0 0 10px rgba(250,204,21,0.9)) drop-shadow(0 0 20px rgba(250,204,21,0.5))',
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
    let cumulative = 0;

    cumulative += GAME_CONFIG.STAR_CHANCE;
    if (roll < cumulative) return 'star';

    cumulative += GAME_CONFIG.GOLD_CHANCE;
    if (roll < cumulative) return 'gold';

    cumulative += GAME_CONFIG.SILVER_CHANCE;
    if (roll < cumulative) return 'silver';

    cumulative += GAME_CONFIG.BRONZE_CHANCE;
    if (roll < cumulative) return 'bronze';

    cumulative += GAME_CONFIG.BLACK_CHANCE;
    if (roll < cumulative) return 'black';

    cumulative += GAME_CONFIG.HEART_CHANCE;
    if (roll < cumulative) return 'heart';

    return 'egg';
  };

  const spawnItem = useCallback(() => {
    const { width } = getGameArea();
    const level = gameState.level;
    const type = getRandomItemType();
    const isSpecial = type !== 'egg';
    const baseSpeed = GAME_CONFIG.BASE_SPEED + Math.random() * (GAME_CONFIG.MAX_SPEED - GAME_CONFIG.BASE_SPEED) * (1 + level * 0.15);
    // Бонусы падают чуть медленнее, чтобы их было легче поймать
    // Чёрные яйца падают с обычной скоростью — их надо избегать!
    const speed = (isSpecial && type !== 'black') ? baseSpeed * 0.75 : baseSpeed;
    const size = GAME_CONFIG.EGG_SIZE + Math.random() * 8 - 4;

    const newItem: FallingItem = {
      id: itemIdCounter.current++,
      x: Math.random() * (width - size),
      y: -size,
      speed,
      size,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * (isSpecial ? 2 : 4),
      type,
      glow: isSpecial,
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
    let bronzeCaught = 0;
    let silverCaught = 0;
    let goldCaught = 0;
    let blackCaught = 0;
    let heartsCaught = 0;
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
          case 'bronze':
            bronzeCaught++;
            addCatchEffect(item.x, height - GAME_CONFIG.BASKET_HEIGHT - 20, 'bronze', '+2');
            setScreenFlash('bronze');
            setTimeout(() => setScreenFlash(null), 250);
            break;
          case 'silver':
            silverCaught++;
            addCatchEffect(item.x, height - GAME_CONFIG.BASKET_HEIGHT - 20, 'silver', '+3');
            setScreenFlash('silver');
            setTimeout(() => setScreenFlash(null), 250);
            break;
          case 'gold':
            goldCaught++;
            addCatchEffect(item.x, height - GAME_CONFIG.BASKET_HEIGHT - 20, 'gold', '+5');
            setScreenFlash('gold');
            setTimeout(() => setScreenFlash(null), 300);
            break;
          case 'black':
            blackCaught++;
            addCatchEffect(item.x, height - GAME_CONFIG.BASKET_HEIGHT - 20, 'black', '-3');
            setScreenFlash('black');
            setTimeout(() => setScreenFlash(null), 350);
            break;
          case 'heart':
            heartsCaught++;
            addCatchEffect(item.x, height - GAME_CONFIG.BASKET_HEIGHT - 20, 'heart', '+❤️');
            setScreenFlash('pink');
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

    const totalCaught = eggsCaught + bronzeCaught + silverCaught + goldCaught + blackCaught + heartsCaught + starsCaught;
    if (totalCaught > 0 || missed > 0) {
      setGameState((prev) => {
        // Подсчёт очков
        const pointsFromEggs = eggsCaught * GAME_CONFIG.EGG_POINTS;
        const pointsFromBronze = bronzeCaught * GAME_CONFIG.BRONZE_POINTS;
        const pointsFromSilver = silverCaught * GAME_CONFIG.SILVER_POINTS;
        const pointsFromGold = goldCaught * GAME_CONFIG.GOLD_POINTS;
        const pointsFromBlack = blackCaught * GAME_CONFIG.BLACK_POINTS;
        const pointsFromStars = starsCaught * GAME_CONFIG.STAR_POINTS;
        const rawScore = prev.score + pointsFromEggs + pointsFromBronze + pointsFromSilver + pointsFromGold + pointsFromBlack + pointsFromStars;
        const newScore = Math.max(0, rawScore); // Счёт не может быть отрицательным

        // Подсчёт жизней
        const healFromHearts = heartsCaught * GAME_CONFIG.HEART_HEAL;
        const healFromStars = starsCaught * 1;
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

  const getItemStyle = (item: FallingItem): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      left: item.x + 'px',
      top: item.y + 'px',
      width: item.size + 'px',
      height: item.size + 'px',
      transform: `rotate(${item.rotation}deg)`,
      fontSize: item.size * 0.85 + 'px',
      lineHeight: 1,
    };

    if (item.glow) {
      return {
        ...baseStyle,
        filter: ITEM_CSS_FILTER[item.type],
        animation: item.type === 'black' ? 'pulseDark 0.8s ease-in-out infinite' : 'pulse 1s ease-in-out infinite',
      };
    }

    return {
      ...baseStyle,
      filter: ITEM_CSS_FILTER[item.type],
    };
  };

  const getFlashStyle = (flash: string): React.CSSProperties => {
    switch (flash) {
      case 'pink':
        return { background: 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, transparent 70%)' };
      case 'gold':
        return { background: 'radial-gradient(circle, rgba(234,179,8,0.3) 0%, transparent 70%)' };
      case 'yellow':
        return { background: 'radial-gradient(circle, rgba(250,204,21,0.4) 0%, transparent 70%)' };
      case 'bronze':
        return { background: 'radial-gradient(circle, rgba(205,127,50,0.3) 0%, transparent 70%)' };
      case 'silver':
        return { background: 'radial-gradient(circle, rgba(192,192,192,0.3) 0%, transparent 70%)' };
      case 'black':
        return { background: 'radial-gradient(circle, rgba(80,0,0,0.5) 0%, transparent 70%)' };
      default:
        return {};
    }
  };

  const getEffectColor = (type: ItemType): string => {
    switch (type) {
      case 'heart': return 'text-red-400';
      case 'gold': return 'text-yellow-400';
      case 'silver': return 'text-gray-200';
      case 'bronze': return 'text-amber-600';
      case 'star': return 'text-amber-300';
      case 'black': return 'text-red-600';
      default: return 'text-green-400';
    }
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
            style={getFlashStyle(screenFlash)}
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
            <div className={`text-lg font-bold whitespace-nowrap ${getEffectColor(effect.type)}`}
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
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-20 overflow-y-auto">
            <div className="text-center p-5 max-w-md mx-4">
              <div className="text-5xl mb-3 animate-bounce">🥚</div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 drop-shadow-lg">
                Поймай Яйцо!
              </h1>
              <p className="text-white/80 text-sm mb-3">
                Лови яйца корзиной, не дай им упасть!
              </p>
              
              {/* Bonus items legend */}
              <div className="bg-white/10 rounded-xl p-3 mb-4 border border-white/20">
                <p className="text-white/70 text-xs mb-2 font-medium">✨ Виды яиц и бонусов:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🥚</span>
                    <span className="text-white/80 text-xs">Обычное — +1</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base" style={{ filter: ITEM_CSS_FILTER.bronze }}>🥚</span>
                    <span className="text-amber-400 text-xs">Бронзовое — +2</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base" style={{ filter: ITEM_CSS_FILTER.silver }}>🥚</span>
                    <span className="text-gray-200 text-xs">Серебряное — +3</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base" style={{ filter: ITEM_CSS_FILTER.gold }}>🥚</span>
                    <span className="text-yellow-400 text-xs">Золотое — +5</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base" style={{ filter: ITEM_CSS_FILTER.black }}>🥚</span>
                    <span className="text-red-400 text-xs">Чёрное — -3 ⚠️</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">❤️</span>
                    <span className="text-red-300 text-xs">Сердце — +жизнь</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">⭐</span>
                    <span className="text-amber-300 text-xs">Звезда — +10 +❤️</span>
                  </div>
                </div>
              </div>

              <p className="text-white/60 text-xs mb-4">
                ← → или касание для управления
              </p>
              {gameState.highScore > 0 && (
                <p className="text-yellow-300 text-base mb-3">
                  🏆 Рекорд: {gameState.highScore}
                </p>
              )}
              <button
                onClick={startGame}
                className="px-7 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-lg font-bold rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-transform duration-150 hover:shadow-green-500/50 hover:shadow-xl"
              >
                🎮 Начать игру
              </button>
              <p className="text-white/40 text-xs mt-2">
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
        @keyframes pulseDark {
          0%, 100% {
            transform: scale(1);
            filter: brightness(0) drop-shadow(0 0 6px rgba(150,0,0,0.6));
          }
          50% {
            transform: scale(1.1);
            filter: brightness(0) drop-shadow(0 0 12px rgba(200,0,0,0.9));
          }
        }
      `}</style>
    </div>
  );
}

export default App;
