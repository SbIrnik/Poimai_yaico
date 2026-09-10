import { useEffect, useRef, useState } from 'react';

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
}

interface GameConfig {
  basketWidth: number;
  basketHeight: number;
  eggSize: number;
  initialLives: number;
  maxLives: number;
  spawnInterval: number;
  minSpawnInterval: number;
  baseSpeed: number;
  maxSpeed: number;
  basketSpeed: number;
  levelThreshold: number;
  invulnerableDuration: number;
  points: Record<ItemType, number>;
  spawnChances: Record<string, number>;
}

const CONFIG: GameConfig = {
  basketWidth: 80,
  basketHeight: 60,
  eggSize: 36,
  initialLives: 3,
  maxLives: 5,
  spawnInterval: 1200,
  minSpawnInterval: 400,
  baseSpeed: 2,
  maxSpeed: 6,
  basketSpeed: 8,
  levelThreshold: 10,
  invulnerableDuration: 2500,
  points: {
    egg: 1,
    bronze: 2,
    silver: 3,
    gold: 5,
    black: -3,
    heart: 0,
    star: 10,
  },
  spawnChances: {
    star: 3,
    gold: 3,
    silver: 5,
    bronze: 8,
    black: 7,
    heart: 6,
  },
};

const ITEM_STYLES: Record<ItemType, { emoji: string; filter: string }> = {
  egg: {
    emoji: '🥚',
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
  },
  bronze: {
    emoji: '🥚',
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3)) sepia(1) saturate(3) hue-rotate(-15deg) brightness(0.85)',
  },
  silver: {
    emoji: '🥚',
    filter: 'drop-shadow(0 2px 6px rgba(192,192,192,0.5)) grayscale(1) brightness(1.6) contrast(0.9)',
  },
  gold: {
    emoji: '🥚',
    filter: 'drop-shadow(0 0 8px rgba(255,215,0,0.7)) sepia(1) saturate(5) hue-rotate(10deg) brightness(1.3)',
  },
  black: {
    emoji: '🥚',
    filter: 'drop-shadow(0 0 6px rgba(100,0,0,0.6)) brightness(0) invert(0) saturate(0) contrast(2)',
  },
  heart: {
    emoji: '❤️',
    filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.8)) drop-shadow(0 0 16px rgba(239,68,68,0.4))',
  },
  star: {
    emoji: '⭐',
    filter: 'drop-shadow(0 0 10px rgba(250,204,21,0.9)) drop-shadow(0 0 20px rgba(250,204,21,0.5))',
  },
};

export default function App() {
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(CONFIG.initialLives);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('eggCatchHighScore') || '0'));
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [items, setItems] = useState<FallingItem[]>([]);
  const [basketX, setBasketX] = useState(0);
  const [isInvulnerable, setIsInvulnerable] = useState(false);
  const [basketFlash, setBasketFlash] = useState(false);

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const lastSpawnRef = useRef(0);
  const itemsRef = useRef<FallingItem[]>([]);
  const basketXRef = useRef(0);
  const keysRef = useRef<Set<string>>(new Set());
  const itemIdRef = useRef(0);
  const invulnerableUntilRef = useRef(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(CONFIG.initialLives);
  const levelRef = useRef(1);
  const isPlayingRef = useRef(false);
  const highScoreRef = useRef(highScore);

  // Синхронизация ref со state
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { livesRef.current = lives; }, [lives]);
  useEffect(() => { levelRef.current = level; }, [level]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { highScoreRef.current = highScore; }, [highScore]);

  const getGameArea = () => {
    if (!gameAreaRef.current) return { width: 800, height: 600 };
    return {
      width: gameAreaRef.current.clientWidth,
      height: gameAreaRef.current.clientHeight,
    };
  };

  const getRandomType = (): ItemType => {
    const roll = Math.random() * 100;
    let cumulative = 0;

    for (const [type, chance] of Object.entries(CONFIG.spawnChances)) {
      cumulative += chance;
      if (roll < cumulative) return type as ItemType;
    }
    return 'egg';
  };

  const spawnItem = () => {
    const { width } = getGameArea();
    const currentLevel = levelRef.current;
    const type = getRandomType();
    const isSpecial = type !== 'egg';
    const baseSpeed = CONFIG.baseSpeed + Math.random() * (CONFIG.maxSpeed - CONFIG.baseSpeed) * (1 + currentLevel * 0.15);
    const speed = isSpecial && type !== 'black' ? baseSpeed * 0.75 : baseSpeed;
    const size = CONFIG.eggSize + Math.random() * 8 - 4;

    const newItem: FallingItem = {
      id: itemIdRef.current++,
      x: Math.random() * (width - size),
      y: -size,
      speed,
      size,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * (isSpecial ? 2 : 4),
      type,
    };

    itemsRef.current = [...itemsRef.current, newItem];
  };

  const checkCollision = (item: FallingItem, bX: number): boolean => {
    const { height } = getGameArea();
    const basketTop = height - CONFIG.basketHeight - 10;
    const basketLeft = bX;
    const basketRight = bX + CONFIG.basketWidth;
    const itemCenterX = item.x + item.size / 2;
    const itemBottom = item.y + item.size;

    return (
      itemBottom >= basketTop &&
      itemBottom <= basketTop + CONFIG.basketHeight / 2 &&
      itemCenterX >= basketLeft &&
      itemCenterX <= basketRight
    );
  };

  const activateInvulnerability = () => {
    // Ref уже установлен в gameLoop, просто обновляем визуал
    setIsInvulnerable(true);
    setTimeout(() => {
      invulnerableUntilRef.current = 0;
      setIsInvulnerable(false);
    }, CONFIG.invulnerableDuration);
  };



  const startGame = () => {
    itemsRef.current = [];
    setItems([]);
    basketXRef.current = getGameArea().width / 2 - CONFIG.basketWidth / 2;
    setBasketX(basketXRef.current);
    lastSpawnRef.current = 0;
    invulnerableUntilRef.current = 0;
    setIsInvulnerable(false);

    setScore(0);
    setLives(CONFIG.initialLives);
    setLevel(1);
    setIsPlaying(true);
    setIsGameOver(false);
  };

  // Клавиатура
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key === ' ' && !isPlaying) startGame();
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
  }, [isPlaying]);

  // Касания
  useEffect(() => {
    const gameArea = gameAreaRef.current;
    if (!gameArea) return;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const rect = gameArea.getBoundingClientRect();
      const touchX = e.touches[0].clientX - rect.left;
      basketXRef.current = Math.max(0, Math.min(rect.width - CONFIG.basketWidth, touchX - CONFIG.basketWidth / 2));
      setBasketX(basketXRef.current);
    };

    gameArea.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => gameArea.removeEventListener('touchmove', handleTouchMove);
  }, []);

  // Игровой цикл
  useEffect(() => {
    const loop = (timestamp: number) => {
      if (!isPlayingRef.current) {
        animationRef.current = requestAnimationFrame(loop);
        return;
      }

      const { width, height } = getGameArea();

      // Движение корзины
      if (keysRef.current.has('ArrowLeft') || keysRef.current.has('a')) {
        basketXRef.current = Math.max(0, basketXRef.current - CONFIG.basketSpeed);
      }
      if (keysRef.current.has('ArrowRight') || keysRef.current.has('d')) {
        basketXRef.current = Math.min(width - CONFIG.basketWidth, basketXRef.current + CONFIG.basketSpeed);
      }
      setBasketX(basketXRef.current);

      // Спавн предметов
      const spawnInterval = Math.max(CONFIG.minSpawnInterval, CONFIG.spawnInterval - levelRef.current * 80);
      if (timestamp - lastSpawnRef.current > spawnInterval) {
        spawnItem();
        lastSpawnRef.current = timestamp;
      }

      // Обновление предметов
      let scoreChange = 0;
      let livesChange = 0;
      let shouldActivateInvulnerability = false;

      itemsRef.current = itemsRef.current.filter((item) => {
        item.y += item.speed;
        item.rotation += item.rotationSpeed;

        // Проверка столкновения с корзиной
        if (checkCollision(item, basketXRef.current)) {
          scoreChange += CONFIG.points[item.type];
          if (item.type === 'heart') livesChange += 1;
          if (item.type === 'star') livesChange += 1;
          return false;
        }

        // Проверка падения за экран
        if (item.y > height) {
          if (item.type === 'egg') {
            const isInvulnerableNow = Date.now() < invulnerableUntilRef.current;
            if (!isInvulnerableNow) {
              livesChange -= 1;
              shouldActivateInvulnerability = true;
              // СРАЗУ устанавливаем неуязвимость, чтобы другие яйца в этом кадре не отнимали жизни
              invulnerableUntilRef.current = Date.now() + CONFIG.invulnerableDuration;
            }
          }
          return false;
        }

        return true;
      });

      setItems([...itemsRef.current]);

      // Применение изменений
      if (scoreChange !== 0 || livesChange !== 0) {
        const newScore = Math.max(0, scoreRef.current + scoreChange);
        const newLives = Math.min(CONFIG.maxLives, Math.max(0, livesRef.current + livesChange));
        const newLevel = Math.floor(newScore / CONFIG.levelThreshold) + 1;

        setScore(newScore);
        setLives(newLives);
        setLevel(newLevel);

        if (shouldActivateInvulnerability) {
          activateInvulnerability();
        }

        if (newLives <= 0) {
          const newHighScore = Math.max(newScore, highScoreRef.current);
          localStorage.setItem('eggCatchHighScore', newHighScore.toString());
          setHighScore(newHighScore);
          setIsPlaying(false);
          setIsGameOver(true);
        }
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Мигание корзины
  useEffect(() => {
    if (!isInvulnerable) {
      setBasketFlash(false);
      return;
    }
    const interval = setInterval(() => setBasketFlash(prev => !prev), 150);
    return () => clearInterval(interval);
  }, [isInvulnerable]);

  // Инициализация позиции корзины
  useEffect(() => {
    const init = () => {
      const { width } = getGameArea();
      basketXRef.current = width / 2 - CONFIG.basketWidth / 2;
      setBasketX(basketXRef.current);
    };
    init();
    window.addEventListener('resize', init);
    return () => window.removeEventListener('resize', init);
  }, []);

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col items-center justify-center bg-gradient-to-b from-sky-900 via-indigo-900 to-purple-950 select-none">
      {/* Звёзды */}
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

      {/* Заголовок */}
      <div className="w-full max-w-2xl px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20">
            <span className="text-yellow-300 text-xs font-medium">⭐ Счёт</span>
            <span className="text-white text-lg font-bold ml-2">{score}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20">
            <span className="text-purple-300 text-xs font-medium">📊 Ур.</span>
            <span className="text-white text-lg font-bold ml-1">{level}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: CONFIG.maxLives }).map((_, i) => (
            <span
              key={i}
              className={`text-xl transition-all duration-300 ${
                i < lives ? 'scale-100 opacity-100' : 'scale-50 opacity-30 grayscale'
              }`}
            >
              ❤️
            </span>
          ))}
        </div>
      </div>

      {/* Игровая зона */}
      <div
        ref={gameAreaRef}
        className="relative w-full max-w-2xl flex-1 mx-4 mb-4 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl"
        style={{
          background: 'linear-gradient(180deg, rgba(30,41,59,0.8) 0%, rgba(51,65,85,0.6) 50%, rgba(34,197,94,0.3) 100%)',
        }}
      >
        {/* Земля */}
        <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-green-800 to-green-600 opacity-60" />

        {/* Падающие предметы */}
        {items.map((item) => (
          <div
            key={item.id}
            className="absolute pointer-events-none"
            style={{
              left: item.x + 'px',
              top: item.y + 'px',
              width: item.size + 'px',
              height: item.size + 'px',
              transform: `rotate(${item.rotation}deg)`,
              fontSize: item.size * 0.85 + 'px',
              lineHeight: 1,
              filter: ITEM_STYLES[item.type].filter,
            }}
          >
            {ITEM_STYLES[item.type].emoji}
          </div>
        ))}

        {/* Корзина */}
        <div
          className="absolute"
          style={{
            left: basketX + 'px',
            bottom: '12px',
            width: CONFIG.basketWidth + 'px',
            height: CONFIG.basketHeight + 'px',
            fontSize: '52px',
            lineHeight: 1,
            transition: 'opacity 0.15s ease-in-out, filter 0.15s ease-in-out',
            opacity: isInvulnerable ? (basketFlash ? 1 : 0.3) : 1,
            filter: isInvulnerable
              ? basketFlash
                ? 'drop-shadow(0 0 12px rgba(250,204,21,0.9)) drop-shadow(0 4px 6px rgba(0,0,0,0.4))'
                : 'drop-shadow(0 0 6px rgba(34,197,94,0.7)) drop-shadow(0 4px 6px rgba(0,0,0,0.4))'
              : 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))',
          }}
        >
          🧺
        </div>

        {/* Стартовый экран */}
        {!isPlaying && !isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-20">
            <div className="text-center p-6 max-w-md mx-4">
              <div className="text-6xl mb-4 animate-bounce">🥚</div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 drop-shadow-lg">
                Поймай Яйцо!
              </h1>
              <p className="text-white/80 text-lg mb-6">
                Лови яйца корзиной, не дай им упасть!
              </p>
              {highScore > 0 && (
                <p className="text-yellow-300 text-lg mb-4">
                  🏆 Рекорд: {highScore}
                </p>
              )}
              <button
                onClick={startGame}
                className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xl font-bold rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-transform duration-150"
              >
                🎮 Начать игру
              </button>
              <p className="text-white/40 text-xs mt-3">или нажмите Пробел</p>
            </div>
          </div>
        )}

        {/* Экран Game Over */}
        {isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20">
            <div className="text-center p-6 bg-white/10 rounded-3xl border border-white/20 backdrop-blur-md max-w-sm mx-4">
              <div className="text-5xl mb-4">😢</div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">Игра окончена!</h2>
              <div className="space-y-2 my-5">
                <p className="text-white text-xl">
                  Счёт: <span className="text-yellow-300 font-bold">{score}</span>
                </p>
                <p className="text-white text-lg">
                  Уровень: <span className="text-purple-300 font-bold">{level}</span>
                </p>
                {score >= highScore && score > 0 && (
                  <p className="text-yellow-400 text-lg font-bold animate-pulse">🎉 Новый рекорд! 🎉</p>
                )}
                <p className="text-white/60 text-sm">🏆 Лучший результат: {highScore}</p>
              </div>
              <button
                onClick={startGame}
                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xl font-bold rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-transform duration-150"
              >
                🔄 Играть снова
              </button>
              <p className="text-white/40 text-xs mt-3">или нажмите Пробел</p>
            </div>
          </div>
        )}
      </div>

      {/* Подвал */}
      <div className="text-white/40 text-xs pb-2 text-center z-10">
        ← → или касание для управления
      </div>
    </div>
  );
}
