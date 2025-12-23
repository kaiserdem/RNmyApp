import React, {useEffect, useRef, useState} from 'react';
import {
  Dimensions,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Типи

type Screen = 'start' | 'game' | 'results';

type Obstacle = {
  id: number;
  x: number;
  sprite: 'box' | 'rock';
};

type Collectible = {
  id: number;
  x: number;
  y: number;
  sprite: 'grain' | 'egg';
};

// Константи поля

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const GROUND_Y = SCREEN_HEIGHT * 0.2;
const CHICKEN_X = SCREEN_WIDTH * 0.14;
const CHICKEN_SIZE = 80;
const OBSTACLE_SIZE = 90;
const COLLECTIBLE_SIZE = 56;

// Розміри фону (оригінальна картинка 2150 × 932)
const BACKGROUND_WIDTH = 2150;
const BACKGROUND_HEIGHT = 932;

// Швидкість гри (трохи нижче середньої)
const GAME_SPEED = 5;

// Завантаження зображень

const chickenImg = require('./assets/images/chicken.png');
const obstacleBoxImg = require('./assets/images/obstacle_box.png');
const obstacleRockImg = require('./assets/images/obstacle_rock.png');
const grainImg = require('./assets/images/collectible_grain.png');
const eggImg = require('./assets/images/collectible_egg.png');
const bgDayImg = require('./assets/images/bg_day.png');

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('start');
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [lastScore, setLastScore] = useState(0);

  const [chickenY, setChickenY] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [collectibles, setCollectibles] = useState<Collectible[]>([]);
  const [backgroundX, setBackgroundX] = useState(0);

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const obstacleIdRef = useRef(0);
  const collectibleIdRef = useRef(0);
  const lastJumpTimeRef = useRef(0);
  const isDoubleJumpRef = useRef(false);

  // Зчитуємо найкращий результат
  useEffect(() => {
    AsyncStorage.getItem('bestScore')
      .then(stored => {
        if (stored) {
          setBestScore(Number(stored));
        }
      })
      .catch(() => {});
  }, []);

  const resetGameState = () => {
    setScore(0);
    setChickenY(0);
    setIsJumping(false);
    setObstacles([]);
    setCollectibles([]);
    setBackgroundX(0);
    obstacleIdRef.current = 0;
    collectibleIdRef.current = 0;
    lastJumpTimeRef.current = 0;
    isDoubleJumpRef.current = false;
  };

  const startGame = () => {
    resetGameState();
    setScreen('game');
  };

  const goToResults = (finalScore: number) => {
    setLastScore(finalScore);
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      AsyncStorage.setItem('bestScore', String(finalScore)).catch(() => {});
    }
    setScreen('results');
  };

  // Стрибок
  const handleJump = () => {
    if (screen !== 'game') {
      return;
    }
    
    const now = Date.now();
    const timeSinceLastJump = now - lastJumpTimeRef.current;
    
    // Подвійний стрибок (якщо натиснуто менше ніж 300мс після першого стрибка)
    if (isJumping && timeSinceLastJump < 300 && !isDoubleJumpRef.current) {
      isDoubleJumpRef.current = true;
      // Подвійний стрибок - вище
      setChickenY(200);
      setTimeout(() => {
        setChickenY(0);
        setIsJumping(false);
        isDoubleJumpRef.current = false;
      }, 500);
      return;
    }
    
    // Звичайний стрибок (тільки якщо не в стрибку)
    if (!isJumping) {
      setIsJumping(true);
      lastJumpTimeRef.current = now;
      setChickenY(130);
      setTimeout(() => {
        setChickenY(0);
        setIsJumping(false);
        isDoubleJumpRef.current = false;
      }, 420);
    }
  };

  // Основний ігровий цикл
  useEffect(() => {
    if (screen !== 'game') {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
      return;
    }

    // Розраховуємо масштабовану ширину фону
    const backgroundScale = SCREEN_HEIGHT / BACKGROUND_HEIGHT;
    const scaledBackgroundWidth = BACKGROUND_WIDTH * backgroundScale;

    gameLoopRef.current = setInterval(() => {
      // Рух фону (повторюється з масштабованою шириною картинки)
      setBackgroundX(prev => {
        const newX = prev - GAME_SPEED;
        // Якщо перше зображення повністю вийшло за екран, скидаємо позицію
        // Друге зображення вже на позиції newX + scaledBackgroundWidth, тому просто скидаємо на 0
        return newX <= -scaledBackgroundWidth ? 0 : newX;
      });

      // Рух перешкод
      setObstacles(prev =>
        prev
          .map(o => ({...o, x: o.x - GAME_SPEED}))
          .filter(o => o.x + OBSTACLE_SIZE > 0),
      );

      // Рух бонусів
      setCollectibles(prev =>
        prev
          .map(c => ({...c, x: c.x - GAME_SPEED}))
          .filter(c => c.x + COLLECTIBLE_SIZE > 0),
      );

      // Нові перешкоди
      if (Math.random() < 0.02) {
        setObstacles(prev => [
          ...prev,
          {
            id: obstacleIdRef.current++,
            x: SCREEN_WIDTH + 30,
            sprite: Math.random() > 0.5 ? 'box' : 'rock',
          },
        ]);
      }

      // Нові бонуси
      if (Math.random() < 0.015) {
        setCollectibles(prev => [
          ...prev,
          {
            id: collectibleIdRef.current++,
            x: SCREEN_WIDTH + 30,
            y: Math.random() > 0.5 ? -45 : -95,
            sprite: Math.random() > 0.5 ? 'grain' : 'egg',
          },
        ]);
      }

      // Перевірка зіткнень з перешкодами
      setObstacles(prev => {
        for (const o of prev) {
          const obstacleLeft = o.x;
          const obstacleRight = o.x + OBSTACLE_SIZE;
          const chickenLeft = CHICKEN_X;
          const chickenRight = CHICKEN_X + CHICKEN_SIZE;

          const overlapX =
            obstacleRight > chickenLeft && obstacleLeft < chickenRight;

          // Курка має bottom: GROUND_Y і transform: translateY(-chickenY)
          // Тому візуальна позиція: bottom = GROUND_Y - chickenY
          const chickenBottom = GROUND_Y - chickenY;
          const chickenTop = chickenBottom - CHICKEN_SIZE;
          
          // Перешкода має bottom: GROUND_Y
          const obstacleBottom = GROUND_Y;
          const obstacleTop = GROUND_Y - OBSTACLE_SIZE;

          // Зіткнення відбувається, коли курка перетинається з перешкодою по вертикалі
          // Але НЕ коли курка над перешкодою (chickenBottom <= obstacleTop)
          const overlapY = chickenBottom > obstacleTop && chickenTop < obstacleBottom;

          if (overlapX && overlapY) {
            if (gameLoopRef.current) {
              clearInterval(gameLoopRef.current);
            }
            goToResults(score);
            return prev;
          }
        }
        return prev;
      });

      // Перевірка збору бонусів
      setCollectibles(prev => {
        const remaining: Collectible[] = [];
        for (const c of prev) {
          const dx =
            CHICKEN_X +
            CHICKEN_SIZE / 2 -
            (c.x + COLLECTIBLE_SIZE / 2);
          const dy =
            (GROUND_Y + chickenY) -
            (GROUND_Y + c.y + COLLECTIBLE_SIZE / 2);
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < (CHICKEN_SIZE + COLLECTIBLE_SIZE) / 2) {
            setScore(s => s + 1);
          } else {
            remaining.push(c);
          }
        }
        return remaining;
      });
    }, 16);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [screen, chickenY, score, bestScore]);

  // Екран старту
  if (screen === 'start') {
    return (
      <View style={styles.startContainer}>
        <StatusBar barStyle="light-content" />
        <Image source={chickenImg} style={styles.startChicken} />
        <Text style={styles.title}>Гра «Курка»</Text>
        <Text style={styles.subtitle}>
          Натискай на екран, щоб курка стрибала.{'\n'}Уникай перешкод і збирай
          зерно.
      </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={startGame}>
          <Text style={styles.primaryButtonText}>ПОЧАТИ ГРУ</Text>
        </TouchableOpacity>
        <View style={styles.bestBox}>
          <Text style={styles.bestLabel}>Найкращий результат:</Text>
          <Text style={styles.bestValue}>{bestScore}</Text>
        </View>
    </View>
  );
}

  // Екран результатів
  if (screen === 'results') {
    return (
      <View style={styles.resultsContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.resultsTitle}>РЕЗУЛЬТАТИ</Text>
        <Text style={styles.resultsEmoji}>
          {lastScore >= bestScore ? '🏆' : '🐔'}
        </Text>
        <Text style={styles.resultsLabel}>Поточний рахунок:</Text>
        <Text style={styles.resultsScore}>{lastScore}</Text>
        <Text style={styles.resultsLabel}>Найкращий результат:</Text>
        <Text style={styles.resultsScore}>{bestScore}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={startGame}>
          <Text style={styles.primaryButtonText}>ЗІГРАТИ ЩЕ РАЗ</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, styles.secondaryButton]}
          onPress={() => setScreen('start')}>
          <Text style={[styles.primaryButtonText, styles.secondaryButtonText]}>
            ГОЛОВНЕ МЕНЮ
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Екран гри
  // Розраховуємо масштабовану ширину фону для збереження пропорцій
  const backgroundScale = SCREEN_HEIGHT / BACKGROUND_HEIGHT;
  const scaledBackgroundWidth = BACKGROUND_WIDTH * backgroundScale;

  return (
    <View style={styles.gameContainer}>
      <StatusBar hidden />
      {/* Рухомий фон (два зображення для безперервного повторення) */}
      <Image
        source={bgDayImg}
        style={[
          styles.backgroundImage,
          {left: backgroundX, width: scaledBackgroundWidth},
        ]}
      />
      <Image
        source={bgDayImg}
        style={[
          styles.backgroundImage,
          {left: backgroundX + scaledBackgroundWidth, width: scaledBackgroundWidth},
        ]}
      />
      <View style={styles.scoreBar}>
        <Text style={styles.scoreText}>Очки: {score}</Text>
        <Text style={styles.scoreBestText}>Рекорд: {bestScore}</Text>
      </View>

      {/* Курка */}
      <View
        style={[
          styles.chicken,
          {
            left: CHICKEN_X,
            bottom: GROUND_Y,
            transform: [{ translateY: -chickenY }],
          },
        ]}>
        <Image source={chickenImg} style={styles.chickenSprite} />
      </View>

      {/* Перешкоди */}
      {obstacles.map(o => (
        <View
          key={o.id}
          style={[
            styles.obstacle,
            {
              left: o.x,
              bottom: GROUND_Y,
            },
          ]}>
          <Image
            source={o.sprite === 'box' ? obstacleBoxImg : obstacleRockImg}
            style={styles.obstacleSprite}
          />
        </View>
      ))}

      {/* Бонуси */}
      {collectibles.map(c => (
        <View
          key={c.id}
          style={[
            styles.collectible,
            {
              left: c.x,
              bottom: GROUND_Y + c.y,
            },
          ]}>
          <Image
            source={c.sprite === 'grain' ? grainImg : eggImg}
            style={styles.collectibleSprite}
          />
        </View>
      ))}

      {/* Область торкання */}
      <TouchableOpacity
        activeOpacity={1}
        style={StyleSheet.absoluteFill}
        onPress={handleJump}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  startContainer: {
    flex: 1,
    backgroundColor: '#87CEEB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  startChicken: {
    width: 140,
    height: 140,
    marginBottom: 16,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFD700',
    textShadowColor: '#000',
    textShadowOffset: {width: 2, height: 2},
    textShadowRadius: 4,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#222',
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 28,
    marginBottom: 16,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  bestBox: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  bestLabel: {
    color: '#fff',
    fontSize: 16,
  },
  bestValue: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  gameContainer: {
    flex: 1,
    backgroundColor: '#87CEEB',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    // Використовуємо оригінальні розміри картинки
    // Масштабуємо висоту до екрана, ширина розраховується пропорційно
    height: SCREEN_HEIGHT,
    // Ширина встановлюється динамічно в JSX для тайлування
    resizeMode: 'cover',
  },
  scoreBar: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scoreText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scoreBestText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chicken: {
    position: 'absolute',
    width: CHICKEN_SIZE,
    height: CHICKEN_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chickenSprite: {
    width: CHICKEN_SIZE,
    height: CHICKEN_SIZE,
    resizeMode: 'contain',
  },
  obstacle: {
    position: 'absolute',
    width: OBSTACLE_SIZE,
    height: OBSTACLE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  obstacleSprite: {
    width: OBSTACLE_SIZE,
    height: OBSTACLE_SIZE,
    resizeMode: 'contain',
  },
  collectible: {
    position: 'absolute',
    width: COLLECTIBLE_SIZE,
    height: COLLECTIBLE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collectibleSprite: {
    width: COLLECTIBLE_SIZE,
    height: COLLECTIBLE_SIZE,
    resizeMode: 'contain',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  resultsTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 12,
  },
  resultsEmoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  resultsLabel: {
    fontSize: 18,
    color: '#fff',
    marginTop: 8,
  },
  resultsScore: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  secondaryButtonText: {
    color: '#4CAF50',
  },
});

export default App;

