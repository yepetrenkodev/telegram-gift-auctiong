# 📋 Telegram Gift Auction — Полная спецификация

> Версия: 2.0 | Обновлено: Январь 2026

## 📖 Содержание

1. [Быстрый старт](#-быстрый-старт)
2. [Архитектура проекта](#-архитектура-проекта)
3. [Установка и запуск](#-установка-и-запуск)
4. [API Reference](#-api-reference)
5. [WebSocket Events](#-websocket-events)
6. [Модели данных](#-модели-данных)
7. [Сервисы](#-сервисы)
8. [Бизнес-логика](#-бизнес-логика)
9. [Stress Testing](#-stress-testing)
10. [Production Features](#-production-features)

---

## 🚀 Быстрый старт

### Требования

- **Node.js** 18+ 
- **MongoDB** 6.0+ (локально или Atlas)
- **Redis** 7.0+ (опционально, но рекомендуется)
- **npm** или **yarn**

### Установка за 2 минуты

```bash
# 1. Клонировать репозиторий
git clone https://github.com/your-repo/telegram-gift-auction.git
cd telegram-gift-auction

# 2. Установить зависимости
npm install

# 3. Создать .env файл
copy .env.example .env
# Отредактировать .env - указать MONGODB_URI и другие настройки

# 4. Запустить MongoDB и Redis (Docker)
docker run -d -p 27017:27017 --name mongodb mongo:6
docker run -d -p 6379:6379 --name redis redis:7-alpine

# 5. Заполнить тестовыми данными
npm run seed

# 6. Запустить сервер
npm run dev
```

### Проверка работы

```bash
# Health check
curl http://localhost:3000/api/health

# Все аукционы
curl http://localhost:3000/api/client/auctions

# Метрики Prometheus
curl http://localhost:3000/api/health/metrics
```

---

## 🏗️ Архитектура проекта

### Структура директорий

```
telegram-gift-auction/
├── src/
│   ├── bot/                    # Telegram Bot
│   │   └── TelegramBot.ts      # Обработка команд /start, /balance и т.д.
│   │
│   ├── config/                 # Конфигурация
│   │   └── index.ts            # Загрузка из .env
│   │
│   ├── controllers/            # HTTP контроллеры
│   │   ├── auctionController.ts
│   │   ├── bidController.ts
│   │   └── userController.ts
│   │
│   ├── middleware/             # Express middleware
│   │   ├── auth.ts             # JWT авторизация
│   │   ├── errorHandler.ts     # Обработка ошибок
│   │   ├── idempotency.ts      # Double-submit protection
│   │   └── rateLimiter.ts      # Rate limiting
│   │
│   ├── models/                 # MongoDB модели
│   │   ├── Activity.ts         # Лента активности
│   │   ├── Auction.ts          # Аукционы
│   │   ├── AuditLog.ts         # Аудит логи
│   │   ├── AutoBid.ts          # Авто-ставки
│   │   ├── Balance.ts          # Балансы пользователей
│   │   ├── Bid.ts              # Ставки
│   │   ├── Category.ts         # Категории и теги
│   │   ├── Gift.ts             # Подарки
│   │   ├── Round.ts            # Раунды
│   │   ├── User.ts             # Пользователи
│   │   └── Watchlist.ts        # Избранное
│   │
│   ├── routes/                 # Express роуты
│   │   ├── activityRoutes.ts   # /api/activity/*
│   │   ├── auctionRoutes.ts    # /api/auctions/*
│   │   ├── autoBidRoutes.ts    # /api/autobid/*
│   │   ├── bidRoutes.ts        # /api/bids/*
│   │   ├── clientRoutes.ts     # /api/client/* (для фронтенда)
│   │   ├── healthRoutes.ts     # /api/health/*
│   │   ├── searchRoutes.ts     # /api/search/*
│   │   ├── userRoutes.ts       # /api/users/*
│   │   └── watchlistRoutes.ts  # /api/watchlist/*
│   │
│   ├── services/               # Бизнес-логика
│   │   ├── ActivityFeedService.ts   # Лента активности
│   │   ├── AuctionSearchService.ts  # Поиск и фильтрация
│   │   ├── AuctionService.ts        # Управление аукционами
│   │   ├── AuditService.ts          # Аудит логирование
│   │   ├── AutoBidService.ts        # Авто-ставки
│   │   ├── BalanceService.ts        # Финансовые операции
│   │   ├── BidService.ts            # Обработка ставок
│   │   ├── LeaderboardService.ts    # Таблица лидеров
│   │   ├── MetricsService.ts        # Prometheus метрики
│   │   ├── RedisService.ts          # Redis операции
│   │   ├── SocketService.ts         # WebSocket
│   │   ├── TimerService.ts          # Таймеры раундов
│   │   └── WatchlistService.ts      # Избранное
│   │
│   ├── types/                  # TypeScript типы
│   │   └── index.ts
│   │
│   ├── utils/                  # Утилиты
│   │   ├── database.ts         # MongoDB подключение
│   │   └── logger.ts           # Winston логгер
│   │
│   └── index.ts                # Entry point
│
├── stress-test/                # Нагрузочное тестирование
│   ├── cli.ts                  # CLI интерфейс
│   ├── StressTestManager.ts    # Управление тестами
│   ├── TradingBot.ts           # Симуляция ботов
│   └── AuctionGenerator.ts     # Генерация аукционов
│
├── docs/                       # Документация
│   └── SPEC.md                 # Этот файл
│
├── .env.example                # Пример конфигурации
├── package.json
└── tsconfig.json
```

### Технологический стек

| Компонент | Технология | Назначение |
|-----------|------------|------------|
| Runtime | Node.js 18+ | Серверное окружение |
| Language | TypeScript 5.x | Типизация |
| Framework | Express 4.x | HTTP сервер |
| Database | MongoDB 6.x | Основное хранилище |
| Cache | Redis 7.x | Кэш, locks, pub/sub |
| WebSocket | Socket.IO 4.x | Real-time |
| Bot | node-telegram-bot-api | Telegram интеграция |
| Metrics | prom-client | Prometheus метрики |
| Logging | Winston | Структурированные логи |

---

## ⚙️ Установка и запуск

### Конфигурация (.env)

```env
# ===== СЕРВЕР =====
PORT=3000
NODE_ENV=development    # development | production

# ===== БАЗА ДАННЫХ =====
MONGODB_URI=mongodb://localhost:27017/telegram-auction

# ===== REDIS (опционально) =====
REDIS_URL=redis://localhost:6379

# ===== АВТОРИЗАЦИЯ =====
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars
JWT_EXPIRES_IN=7d

# ===== TELEGRAM BOT =====
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# ===== НАСТРОЙКИ АУКЦИОНА =====
ANTI_SNIPE_THRESHOLD_SECONDS=30    # Порог anti-snipe (секунды до конца)
ANTI_SNIPE_EXTENSION_SECONDS=15    # Продление при anti-snipe
MAX_ANTI_SNIPE_EXTENSIONS=5        # Максимум продлений
DEFAULT_ROUND_DURATION_MINUTES=5   # Длительность раунда по умолчанию
```

### NPM скрипты

```bash
npm run dev      # Запуск в dev режиме (hot reload)
npm run build    # Сборка TypeScript → JavaScript
npm run start    # Запуск production билда
npm run seed     # Заполнение тестовыми данными
npm run test     # Запуск тестов
npm run lint     # Проверка кода ESLint
```

### Docker Compose (рекомендуется)

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/telegram-auction
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis

  mongo:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  mongo_data:
```

```bash
docker-compose up -d
```

### Windows BAT файлы

```bash
# start.bat - Запуск dev сервера
start-server.bat

# start-servers.bat - Запуск MongoDB + Redis + Server
start-servers.bat
```

---

## 📡 API Reference

### Health & Monitoring

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/health` | Статус сервиса |
| GET | `/api/health/detailed` | Детальный статус (DB, Redis, память) |
| GET | `/api/health/ready` | Kubernetes readiness probe |
| GET | `/api/health/live` | Kubernetes liveness probe |
| GET | `/api/health/metrics` | Prometheus метрики |

### Аукционы

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/client/auctions` | Список всех аукционов |
| GET | `/api/client/auctions/:id` | Детали аукциона |
| GET | `/api/client/auctions/:id/leaderboard` | Таблица лидеров |
| GET | `/api/client/auctions/:id/winner` | Победитель |
| POST | `/api/auctions` | Создать аукцион (admin) |
| POST | `/api/auctions/:id/start` | Запустить аукцион |
| POST | `/api/auctions/:id/cancel` | Отменить аукцион |

### Ставки

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/client/auctions/:id/bid` | Сделать ставку |
| GET | `/api/bids/round/:roundId` | Ставки в раунде |
| GET | `/api/bids/user/:userId` | Ставки пользователя |
| GET | `/api/bids/round/:roundId/minimum` | Минимальная ставка |
| POST | `/api/bids/quick/:auctionId/:roundId` | Quick Bid |
| GET | `/api/bids/quick-options/:roundId` | Опции Quick Bid |

### Авто-ставки

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/autobid/configure` | Настроить авто-ставку |
| GET | `/api/autobid/auction/:auctionId` | Получить конфиг |
| DELETE | `/api/autobid/:auctionId` | Отключить авто-ставку |
| GET | `/api/autobid/my` | Все мои авто-ставки |

### Пользователи

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/users/me` | Текущий пользователь |
| GET | `/api/users/:id/balance` | Баланс пользователя |
| POST | `/api/client/balance/add` | Пополнить баланс |
| GET | `/api/users/:id/stats` | Статистика |
| GET | `/api/users/:id/bids` | История ставок |

### Поиск и фильтры

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/search/auctions` | Поиск с фильтрами |
| GET | `/api/search/quick?q=` | Быстрый поиск (autocomplete) |
| GET | `/api/search/hot` | Горячие аукционы |
| GET | `/api/search/ending-soon` | Заканчиваются скоро |
| GET | `/api/search/new` | Новые аукционы |
| GET | `/api/search/upcoming` | Предстоящие |
| GET | `/api/search/categories` | Все категории |
| GET | `/api/search/tags` | Все теги |
| GET | `/api/search/category/:slug` | По категории |
| GET | `/api/search/tag/:slug` | По тегу |

### Watchlist (Избранное)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/watchlist` | Мои избранные |
| POST | `/api/watchlist/:auctionId` | Добавить в избранное |
| DELETE | `/api/watchlist/:auctionId` | Удалить из избранного |
| GET | `/api/watchlist/:auctionId/status` | Проверить статус |
| PATCH | `/api/watchlist/:auctionId/settings` | Настройки уведомлений |
| GET | `/api/watchlist/auction/:auctionId/count` | Количество наблюдателей |

### Activity Feed

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/activity/feed` | Глобальная лента |
| GET | `/api/activity/auction/:id` | Лента аукциона |
| GET | `/api/activity/user/:id` | Лента пользователя |
| GET | `/api/activity/my` | Моя лента |
| GET | `/api/activity/stats` | Статистика активности |

### Примеры запросов

#### Сделать ставку

```bash
curl -X POST http://localhost:3000/api/client/auctions/AUCTION_ID/bid \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Idempotency-Key: unique-key-123" \
  -d '{"amount": 100}'
```

#### Поиск с фильтрами

```bash
curl "http://localhost:3000/api/search/auctions?status=active&minPrice=100&maxPrice=1000&sortBy=ending_soon&limit=20"
```

#### Quick Bid

```bash
curl -X POST http://localhost:3000/api/bids/quick/AUCTION_ID/ROUND_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"type": "percent_10"}'
```

---

## 🔌 WebSocket Events

### Подключение

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});

// Подписка на аукцион
socket.emit('auction:join', { auctionId: 'AUCTION_ID' });
```

### События от сервера

| Event | Payload | Описание |
|-------|---------|----------|
| `bid:placed` | `{ auctionId, roundNumber, bidId, userId, userName, amount, position, totalBids, timestamp, isTopTen }` | Новая ставка |
| `bid:outbid` | `{ auctionId, roundNumber, outbidBy, newAmount, yourAmount, newPosition }` | Вас перебили |
| `leaderboard:update` | `{ auctionId, roundNumber, entries[], totalBids, highestBid }` | Обновление лидерборда |
| `timer:sync` | `{ auctionId, roundNumber, endsAt, remainingSeconds, status }` | Синхронизация таймера |
| `timer:tick` | `{ auctionId, roundNumber, remaining }` | Тик таймера (каждую секунду) |
| `round:ending` | `{ auctionId, roundNumber, secondsLeft }` | Раунд заканчивается (60, 30, 10 сек) |
| `round:extended` | `{ auctionId, roundNumber, newEndsAt, extensionCount, triggeredBy }` | Anti-snipe продление |
| `round:ended` | `{ auctionId, roundNumber, winners[], nextRound? }` | Раунд завершён |
| `auction:started` | `{ auctionId, title, round }` | Аукцион начался |
| `auction:ended` | `{ auctionId, winners[], totalBids, totalParticipants }` | Аукцион завершён |
| `auction:cancelled` | `{ auctionId, reason }` | Аукцион отменён |
| `autobid:triggered` | `{ auctionId, roundNumber, amount, remainingMax, bidCount }` | Авто-ставка сработала |
| `autobid:stopped` | `{ auctionId, reason, maxAmount, totalBidsPlaced }` | Авто-ставка остановлена |
| `watchlist:update` | `{ auctionId, event, data }` | Обновление избранного |

### События от клиента

| Event | Payload | Описание |
|-------|---------|----------|
| `auction:join` | `{ auctionId }` | Подписаться на аукцион |
| `auction:leave` | `{ auctionId }` | Отписаться от аукциона |
| `round:join` | `{ auctionId, roundNumber }` | Подписаться на раунд |

### Пример обработки событий

```javascript
// Новая ставка
socket.on('bid:placed', (data) => {
  console.log(`${data.userName} поставил ${data.amount}⭐`);
  updateLeaderboard(data);
});

// Вас перебили
socket.on('bid:outbid', (data) => {
  showNotification(`Вас перебил ${data.outbidBy}! Новая цена: ${data.newAmount}⭐`);
});

// Anti-snipe продление
socket.on('round:extended', (data) => {
  showNotification(`Раунд продлён! Осталось ${data.extensionCount}/5 продлений`);
  updateTimer(data.newEndsAt);
});

// Раунд завершён
socket.on('round:ended', (data) => {
  if (data.winners.some(w => w.oduserId === myUserId)) {
    showVictory('Поздравляем! Вы выиграли! 🎉');
  }
});
```

---

## 📦 Модели данных

### User

```typescript
interface IUser {
  _id: string;
  telegramId: string;           // Telegram ID
  username?: string;            // @username
  firstName: string;
  lastName?: string;
  photoUrl?: string;
  rank: 'bronze' | 'silver' | 'gold' | 'diamond' | 'whale' | 'legend';
  stats: {
    totalBids: number;          // Всего ставок
    totalWins: number;          // Всего побед
    totalSpent: number;         // Потрачено ⭐
    auctionsParticipated: number;
    winRate: number;            // % побед
    currentStreak: number;      // Текущая серия побед
    bestStreak: number;         // Лучшая серия
  };
  isBot?: boolean;              // Маркер бота (для тестов)
  createdAt: Date;
  updatedAt: Date;
}
```

### Balance

```typescript
interface IBalance {
  _id: string;
  userId: string;
  available: number;    // Доступные средства
  locked: number;       // Заблокированные под ставки
  totalDeposited: number;
  totalWithdrawn: number;
  totalWon: number;
  totalSpent: number;
  updatedAt: Date;
}

// Инвариант: available >= 0, locked >= 0
// total = available + locked
```

### Auction

```typescript
interface IAuction {
  _id: string;
  title: string;
  description: string;
  gift: IGift;                          // Разыгрываемый подарок
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  
  // Конфигурация
  totalGifts: number;                   // Всего подарков
  totalRounds: number;                  // Всего раундов
  giftsPerRound: number;                // Подарков за раунд
  winnersPerRound: number;              // Победителей за раунд
  minBidAmount: number;                 // Минимальная ставка
  bidIncrement: number;                 // Шаг ставки
  
  // Anti-snipe
  antiSnipeThresholdSeconds: number;    // Порог (default: 30)
  antiSnipeExtensionSeconds: number;    // Продление (default: 15)
  maxAntiSnipeExtensions: number;       // Макс. продлений (default: 5)
  
  // Тайминги
  scheduledStartAt?: Date;
  startedAt?: Date;
  endsAt?: Date;
  completedAt?: Date;
  
  // Статистика
  currentRound: number;
  totalBids: number;
  totalParticipants: number;
  highestBid: number;
  
  isStressTest?: boolean;               // Маркер тестового аукциона
}
```

### Round

```typescript
interface IRound {
  _id: string;
  auctionId: string;
  roundNumber: number;
  status: 'pending' | 'active' | 'processing' | 'completed';
  
  giftsAvailable: number;
  
  // Тайминги
  startsAt: Date;
  endsAt: Date;                         // Текущее время окончания
  originalEndsAt: Date;                 // Изначальное время
  extensionCount: number;               // Количество продлений
  
  // Результаты
  winningBids: string[];                // ID выигравших ставок
  totalBids: number;
  
  createdAt: Date;
}
```

### Bid

```typescript
interface IBid {
  _id: string;
  auctionId: string;
  roundId: string;
  userId: string;
  
  amount: number;
  status: 'active' | 'outbid' | 'won' | 'refunded';
  
  // Авто-ставка
  isAutoBid: boolean;
  autoBidConfigId?: string;
  
  // Тайминги
  placedAt: Date;
  processedAt?: Date;
  
  // Anti-snipe
  triggeredExtension: boolean;          // Вызвала ли продление
}
```

### AutoBid

```typescript
interface IAutoBidConfig {
  _id: string;
  userId: string;
  auctionId: string;
  
  maxAmount: number;                    // Максимальная сумма
  incrementAmount: number;              // Шаг повышения
  isActive: boolean;
  
  // Статистика
  totalBidsPlaced: number;
  totalAmountSpent: number;
  lastBidAt?: Date;
  stoppedReason?: 'manual' | 'max_reached' | 'outbid' | 'auction_ended' | 'insufficient_balance';
}
```

### Watchlist

```typescript
interface IWatchlist {
  _id: string;
  userId: string;
  auctionId: string;
  
  // Настройки уведомлений
  notifyOnStart: boolean;               // При старте
  notifyOnEndingSoon: boolean;          // За 5 минут до конца
  notifyOnOutbid: boolean;              // При перебитии
  
  notes?: string;                       // Заметки пользователя
  addedAt: Date;
}
```

### Activity

```typescript
interface IActivity {
  _id: string;
  type: 'BID_PLACED' | 'AUCTION_WON' | 'AUCTION_STARTED' | 'AUCTION_ENDED' | 
        'ROUND_ENDED' | 'PRICE_MILESTONE' | 'NEW_PARTICIPANT';
  
  auctionId: string;
  userId?: string;
  
  data: {
    userName?: string;
    amount?: number;
    position?: number;
    giftName?: string;
    roundNumber?: number;
    winnersCount?: number;
    milestone?: number;
    participantName?: string;
  };
  
  createdAt: Date;
  // TTL: 7 дней
}
```

### Category & Tag

```typescript
interface ICategory {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  auctionCount: number;
  isActive: boolean;
}

interface ITag {
  _id: string;
  name: string;
  slug: string;
  color?: string;
  isSystem: boolean;                    // Системный тег (hot, new, etc.)
  usageCount: number;
}

// Системные теги
const SYSTEM_TAGS = ['hot', 'new', 'ending-soon', 'popular', 'rare', 'featured'];
```

### AuditLog

```typescript
interface IAuditLog {
  _id: string;
  eventType: string;                    // 'BID_PLACED', 'AUCTION_CREATED', etc.
  
  userId?: string;
  auctionId?: string;
  bidId?: string;
  
  details: Record<string, any>;
  
  ip?: string;
  userAgent?: string;
  
  createdAt: Date;
  // TTL: 90 дней
}
```

---

## 🔧 Сервисы

### BalanceService

Управление балансами пользователей.

```typescript
// Основные методы
balanceService.getBalance(userId)                    // Получить баланс
balanceService.addFunds(userId, amount, reason)      // Пополнить
balanceService.lockFunds(userId, amount, reason)     // Заблокировать
balanceService.unlockFunds(userId, amount, reason)   // Разблокировать
balanceService.deductLockedFunds(userId, amount)     // Списать заблокированные
balanceService.refundBid(userId, bidId, amount)      // Вернуть за ставку
```

### BidService

Обработка ставок с distributed locking.

```typescript
// Основные методы
bidService.placeBid(userId, auctionId, roundId, amount)  // Сделать ставку
bidService.getUserBidInRound(userId, roundId)            // Текущая ставка
bidService.getRoundBids(roundId)                         // Все ставки раунда
bidService.getMinimumBidAmount(roundId)                  // Минимальная ставка
bidService.getRoundStats(roundId)                        // Статистика раунда
```

**Логика ставки:**
1. Acquire Redis lock на аукцион
2. Проверить статус раунда (active, не истёк)
3. Проверить баланс пользователя
4. Если есть старая ставка - пометить OUTBID, разблокировать средства
5. Заблокировать средства для новой ставки
6. Создать ставку в MongoDB (транзакция)
7. Проверить anti-snipe, продлить раунд если нужно
8. Обновить leaderboard в Redis
9. Broadcast через WebSocket
10. Release lock

### AuctionService

Управление жизненным циклом аукционов.

```typescript
auctionService.createAuction(data)           // Создать
auctionService.startAuction(auctionId)       // Запустить
auctionService.cancelAuction(auctionId)      // Отменить (с возвратом средств)
auctionService.pauseAuction(auctionId)       // Пауза
auctionService.resumeAuction(auctionId)      // Возобновить
auctionService.endRound(roundId)             // Завершить раунд
auctionService.extendRound(roundId)          // Продлить раунд (anti-snipe)
auctionService.processRoundWinners(roundId)  // Определить победителей
```

### AutoBidService

Система автоматических ставок.

```typescript
autoBidService.configure(userId, auctionId, config)  // Настроить
autoBidService.deactivate(userId, auctionId)         // Отключить
autoBidService.getConfig(userId, auctionId)          // Получить конфиг
autoBidService.getUserConfigs(userId)                // Все конфиги
autoBidService.triggerAutoBids(auctionId, roundId)   // Сработать авто-ставки
```

### LeaderboardService

Таблица лидеров на Redis Sorted Sets.

```typescript
leaderboardService.addBid(auctionId, round, userId, amount, time)
leaderboardService.getLeaderboard(auctionId, round, limit)
leaderboardService.getUserPosition(auctionId, round, userId)
leaderboardService.updateAfterBid(auctionId, round, winnersCount)
```

### TimerService

Управление таймерами раундов.

```typescript
timerService.startRoundTimer(auctionId, roundNumber, endsAt)
timerService.extendTimer(auctionId, round, newEndsAt, count, triggeredBy)
timerService.stopTimer(auctionId, roundNumber)
timerService.syncFromDatabase()              // Восстановление после рестарта
```

### SocketService

WebSocket коммуникация.

```typescript
socketService.initialize(httpServer)
socketService.broadcastBidPlaced(payload)
socketService.broadcastOutbid(userId, payload)
socketService.broadcastLeaderboard(payload)
socketService.broadcastTimerSync(payload)
socketService.broadcastRoundEnded(payload)
socketService.sendToUser(userId, event, data)
socketService.sendToUsers(userIds, event, data)
socketService.broadcastToAll(event, data)
socketService.isUserConnected(userId)
socketService.getAuctionViewers(auctionId)
```

### WatchlistService

Управление избранным.

```typescript
watchlistService.addToWatchlist(userId, auctionId, options)
watchlistService.removeFromWatchlist(userId, auctionId)
watchlistService.getUserWatchlist(userId, filters)
watchlistService.isWatching(userId, auctionId)
watchlistService.notifyWatchers(auctionId, event, data)
watchlistService.getWatchersCount(auctionId)
```

### AuctionSearchService

Поиск и фильтрация аукционов.

```typescript
// Полный поиск
auctionSearchService.search({
  status: ['active', 'scheduled'],
  category: 'rare-gifts',
  tags: ['hot', 'popular'],
  minPrice: 100,
  maxPrice: 1000,
  minParticipants: 5,
  endingWithin: 3600,              // Секунд до конца
  text: 'diamond',
  sortBy: 'ending_soon',
  limit: 20,
  skip: 0
})

// Quick методы
auctionSearchService.getHot(limit)
auctionSearchService.getEndingSoon(limit)
auctionSearchService.getNew(limit)
auctionSearchService.getUpcoming(limit)
auctionSearchService.quickSearch(query, limit)
```

### ActivityFeedService

Лента активности.

```typescript
activityFeedService.addActivity(type, auctionId, userId, data)
activityFeedService.getGlobalFeed(limit, before)
activityFeedService.getAuctionFeed(auctionId, limit)
activityFeedService.getUserFeed(userId, limit)
activityFeedService.getStats(hours)

// Quick методы
activityFeedService.bidPlaced(auctionId, userId, userName, amount, position)
activityFeedService.auctionWon(auctionId, userId, userName, amount, giftName)
activityFeedService.auctionStarted(auctionId, giftName)
activityFeedService.priceMilestone(auctionId, milestone, giftName)
```

### AuditService

Аудит логирование.

```typescript
auditService.log(eventType, details, context)
auditService.query(filters)
auditService.getByAuction(auctionId)
auditService.getByUser(userId)

// Event types
'BID_PLACED', 'BID_OUTBID', 'BID_WON', 'BID_REFUNDED',
'AUCTION_CREATED', 'AUCTION_STARTED', 'AUCTION_ENDED', 'AUCTION_CANCELLED',
'ROUND_STARTED', 'ROUND_ENDED', 'ROUND_EXTENDED',
'BALANCE_DEPOSIT', 'BALANCE_LOCK', 'BALANCE_UNLOCK', 'BALANCE_DEDUCT',
'AUTOBID_CONFIGURED', 'AUTOBID_TRIGGERED', 'AUTOBID_STOPPED',
'USER_REGISTERED', 'USER_LOGIN'
```

### MetricsService

Prometheus метрики.

```typescript
// Автоматически собираемые метрики
auction_bids_total{status}              // Всего ставок
auction_bid_processing_seconds          // Время обработки
auction_active_auctions                 // Активных аукционов
auction_active_rounds                   // Активных раундов
websocket_connections                   // WS подключений
websocket_messages_total{type}          // WS сообщений
balance_operations_total{type}          // Операций с балансом
redis_operations_total{operation}       // Redis операций
http_requests_total{method,path,status} // HTTP запросов
```

---

## 📊 Бизнес-логика

### Жизненный цикл аукциона

```
DRAFT ──────► SCHEDULED ──────► ACTIVE ──────► COMPLETED
                │                  │
                │                  ▼
                │               PAUSED
                │                  │
                ▼                  ▼
            CANCELLED ◄────── CANCELLED
```

### Жизненный цикл раунда

```
PENDING ──────► ACTIVE ──────► PROCESSING ──────► COMPLETED
                   │
                   ▼
              [Anti-snipe продление]
                   │
                   ▼
                ACTIVE (новое время)
```

### Алгоритм ставки

```
1. [Lock] Acquire Redis lock "bid:auction:{id}"
2. [Validate] Проверить:
   - Раунд активен
   - Время не истекло
   - Сумма >= минимальная
   - Баланс достаточен
3. [Outbid] Если есть старая ставка:
   - Пометить OUTBID
   - Разблокировать средства
4. [Lock Funds] Заблокировать сумму
5. [Create Bid] Создать ставку (MongoDB транзакция)
6. [Anti-snipe] Если осталось < 30 сек:
   - Продлить раунд на 15 сек
   - Увеличить extensionCount
7. [Leaderboard] Обновить Redis sorted set
8. [Notify] WebSocket broadcast:
   - bid:placed всем
   - bid:outbid перебитым
   - round:extended если продлили
9. [Unlock] Release Redis lock
```

### Алгоритм определения победителей

```
1. [Get Bids] Получить все ACTIVE ставки раунда
2. [Sort] Сортировать:
   - amount DESC
   - placedAt ASC (при равенстве)
3. [Select] Взять топ N (giftsAvailable)
4. [Mark Winners] Для каждого:
   - status = WON
   - Списать locked средства
   - Обновить stats пользователя
5. [Refund Others] Для остальных:
   - status = REFUNDED
   - Разблокировать средства
6. [Notify] WebSocket:
   - round:ended с победителями
7. [Next] Если есть ещё раунды:
   - Создать следующий раунд
   - auction:update
```

### Anti-Snipe механизм

**Цель:** Предотвратить "снайперские" ставки в последние секунды.

**Параметры:**
- `antiSnipeThresholdSeconds` = 30 (порог)
- `antiSnipeExtensionSeconds` = 15 (продление)
- `maxAntiSnipeExtensions` = 5 (максимум)

**Алгоритм:**
```
При каждой ставке:
1. Вычислить remaining = endsAt - now
2. Если remaining <= threshold И extensionCount < max:
   - endsAt += extension
   - extensionCount++
   - broadcast round:extended
```

**Пример:**
```
Раунд: 12:00:00
Threshold: 30 сек
Extension: 15 сек

11:59:35 - ставка → remaining=25 < 30 → продление → 12:00:15
11:59:50 - ставка → remaining=25 < 30 → продление → 12:00:30
12:00:10 - ставка → remaining=20 < 30 → продление → 12:00:45
...
После 5 продлений - больше не продлевается
```

### Финансовая модель

**Двухбалансовая система:**
```
available: свободные средства
locked: заблокированные под ставки
total = available + locked
```

**Операции:**
| Событие | available | locked |
|---------|-----------|--------|
| Пополнение | +X | — |
| Ставка | -X | +X |
| Перебит | +X | -X |
| Победа | — | -X |
| Проигрыш | +X | -X |
| Отмена | +X | -X |

### Автоматические ставки

**Конфигурация:**
```typescript
{
  maxAmount: 500,       // Макс. сумма ставки
  incrementAmount: 10   // Шаг повышения
}
```

**Алгоритм:**
```
1. При каждой ставке проверить все активные авто-конфиги
2. Для каждого конфига где не лидер:
   a. Вычислить newAmount = currentMax + increment
   b. Если newAmount <= maxAmount И достаточно баланса:
      - Сделать ставку
      - Обновить статистику
   c. Иначе:
      - Деактивировать
      - Уведомить через WebSocket
```

---

## 🧪 Stress Testing

### Установка

```bash
cd stress-test
npm install
```

### Запуск тестов

```bash
# Быстрый тест (3 бота, 2 аукциона, 60 секунд)
npx ts-node cli.ts --bots 3 --auctions 2 --duration 60

# Средний тест
npx ts-node cli.ts --bots 10 --auctions 5 --duration 120

# Тяжёлый тест
npx ts-node cli.ts --bots 50 --auctions 10 --duration 300

# С verbose логами
npx ts-node cli.ts --bots 5 --auctions 3 --duration 60 --verbose
```

### Параметры CLI

| Параметр | Описание | Default |
|----------|----------|---------|
| `--bots` | Количество ботов | 5 |
| `--auctions` | Количество аукционов | 2 |
| `--duration` | Длительность теста (сек) | 60 |
| `--verbose` | Подробные логи | false |

### BAT файлы (Windows)

```bash
# stress-test/quick-test.bat - Быстрый тест
quick-test.bat

# stress-test/heavy-test.bat - Тяжёлый тест
heavy-test.bat

# stress-test/cleanup.bat - Очистка тестовых данных
cleanup.bat
```

### Что тестируется

1. **Concurrent bids** - Одновременные ставки от множества ботов
2. **Anti-snipe** - Продление раундов при ставках в последние секунды
3. **Auto-bid** - Срабатывание автоматических ставок
4. **WebSocket** - Доставка событий в реальном времени
5. **Redis locks** - Корректность distributed locking
6. **Balance operations** - Атомарность финансовых операций
7. **Leaderboard** - Корректность ранжирования

### Метрики после теста

```
============ STRESS TEST RESULTS ============
Duration: 60 seconds
Total bids attempted: 1500
Successful bids: 1487 (99.1%)
Failed bids: 13 (0.9%)
Avg latency: 45ms
Max latency: 320ms
Bids per second: 24.8
WebSocket events: 4521
Anti-snipe triggers: 23
============================================
```

---

## 🏭 Production Features

### Health Checks

```bash
# Простой health check
GET /api/health
→ { "status": "ok", "timestamp": "..." }

# Детальный health check
GET /api/health/detailed
→ {
    "status": "healthy",
    "uptime": 3600,
    "version": "2.0.0",
    "services": {
      "database": { "status": "connected", "latency": 5 },
      "redis": { "status": "connected", "latency": 1 },
      "websocket": { "connections": 150 }
    },
    "memory": {
      "heapUsed": 85000000,
      "heapTotal": 120000000,
      "rss": 150000000
    }
  }

# Kubernetes probes
GET /api/health/ready  → 200 OK / 503 Service Unavailable
GET /api/health/live   → 200 OK
```

### Rate Limiting

```typescript
// Конфигурация в rateLimiter.ts
{
  global: { windowMs: 60000, max: 100 },     // 100 req/min общий
  bids: { windowMs: 1000, max: 5 },          // 5 ставок/сек
  auth: { windowMs: 900000, max: 5 },        // 5 попыток/15 мин
  search: { windowMs: 60000, max: 30 }       // 30 поисков/мин
}

// Ответ при превышении
HTTP 429 Too Many Requests
{
  "error": "Too many requests",
  "retryAfter": 45
}
```

### Graceful Shutdown

При остановке сервера:
1. Прекращение приёма новых запросов
2. Ожидание завершения текущих запросов (30 сек timeout)
3. Flush audit logs
4. Закрытие WebSocket соединений
5. Отключение от Redis
6. Отключение от MongoDB

```typescript
// Сигналы: SIGTERM, SIGINT
process.on('SIGTERM', gracefulShutdown);
```

### Prometheus Metrics

```bash
GET /api/health/metrics

# Пример вывода
# HELP auction_bids_total Total number of bids
# TYPE auction_bids_total counter
auction_bids_total{status="success"} 15234
auction_bids_total{status="failed"} 45

# HELP auction_bid_processing_seconds Bid processing time
# TYPE auction_bid_processing_seconds histogram
auction_bid_processing_seconds_bucket{le="0.01"} 12000
auction_bid_processing_seconds_bucket{le="0.05"} 14500
auction_bid_processing_seconds_bucket{le="0.1"} 15100
```

### Audit Logging

Все критичные операции логируются:

```typescript
// Автоматически логируются:
- Создание/запуск/отмена аукционов
- Каждая ставка (успешная и неуспешная)
- Финансовые операции
- Авторизация пользователей
- Ошибки и exceptions

// Retention: 90 дней (TTL index)
```

### Idempotency (Double-submit protection)

```bash
# Заголовок запроса
X-Idempotency-Key: unique-uuid-here

# При повторном запросе с тем же ключом
# в течение 60 секунд возвращается
# результат первого запроса
```

### Error Handling

```typescript
// Централизованная обработка ошибок
// middleware/errorHandler.ts

// Формат ответа при ошибке
{
  "success": false,
  "error": "Human readable message",
  "code": "ERROR_CODE",
  "details": { ... },          // В dev режиме
  "timestamp": "2026-01-11T..."
}

// HTTP коды
400 - Bad Request (валидация)
401 - Unauthorized
403 - Forbidden
404 - Not Found
409 - Conflict (race condition)
429 - Too Many Requests
500 - Internal Server Error
```

---

## 📋 Чеклист деплоя

### Перед деплоем

- [ ] Все тесты проходят (`npm test`)
- [ ] Lint чистый (`npm run lint`)
- [ ] TypeScript компилируется (`npm run build`)
- [ ] .env.production настроен
- [ ] MongoDB индексы созданы
- [ ] Redis доступен
- [ ] SSL сертификаты готовы
- [ ] Домен настроен

### Production .env

```env
NODE_ENV=production
PORT=3000

MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/auction
REDIS_URL=redis://:password@redis-host:6379

JWT_SECRET=very-long-random-secret-minimum-64-chars
JWT_EXPIRES_IN=7d

TELEGRAM_BOT_TOKEN=real-bot-token
```

### Nginx конфигурация

```nginx
server {
    listen 443 ssl http2;
    server_name auction.example.com;

    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Мониторинг

- **Prometheus** - сбор метрик с `/api/health/metrics`
- **Grafana** - визуализация
- **AlertManager** - алерты на:
  - Высокий latency ставок (>500ms)
  - Ошибки >1%
  - Память >80%
  - Redis disconnected

---

## 🔗 Полезные ссылки

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [MongoDB Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [Redis Sorted Sets](https://redis.io/docs/data-types/sorted-sets/)
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
- [Prometheus Node.js Client](https://github.com/siimon/prom-client)

---

*Документ создан: Январь 2026*
*Версия проекта: 2.0.0*
