# 🏆 Telegram Gift Auction

Premium Real-Time Auction Platform для Telegram Mini Apps.

---

## 📖 Описание проекта

**Telegram Gift Auction** — это современная аукционная платформа, интегрированная с Telegram Mini Apps, позволяющая пользователям участвовать в аукционах цифровых подарков в режиме реального времени. Платформа обеспечивает честное и прозрачное проведение торгов благодаря многораундовой системе и защите от последнесекундных ставок (anti-sniping).

### Ключевые особенности:
- 🎯 **Многораундовая модель аукционов** — каждый аукцион состоит из нескольких раундов
- 💰 **Двухбалансовая система** — разделение средств на доступные и заблокированные
- 🛡️ **Anti-sniping защита** — автопродление при ставках в последние секунды
- 🔐 **Telegram-интеграция** — авторизация через Telegram WebApp
- ⚡ **Real-time обновления** — мгновенная синхронизация ставок

---

## 🏗️ Архитектура системы

### Высокоуровневая схема

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TELEGRAM MINI APP                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   React     │  │   Vite      │  │  WebSocket  │                 │
│  │  Frontend   │──│   Build     │──│   Client    │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP/WS
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Node.js)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Express   │  │   Service   │  │   Auction   │                 │
│  │   REST API  │──│    Layer    │──│   Engine    │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│         │                │                │                         │
│         ▼                ▼                ▼                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │    JWT      │  │   Mongoose  │  │  Anti-Snipe │                 │
│  │    Auth     │  │    ODM      │  │   Handler   │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└────────────────────────────┬────────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌───────────┐  ┌───────────┐  ┌───────────┐
       │  MongoDB  │  │   Redis   │  │  WebSocket│
       │   (Data)  │  │  (Cache)  │  │  (Events) │
       └───────────┘  └───────────┘  └───────────┘
```

### Слои приложения

| Слой | Ответственность |
|------|-----------------|
| **Controllers** | Обработка HTTP-запросов, валидация входных данных |
| **Services** | Бизнес-логика, оркестрация операций |
| **Models** | Схемы данных MongoDB, валидация на уровне БД |
| **Middleware** | Аутентификация, обработка ошибок, логирование |
| **Utils** | Вспомогательные функции, форматирование |

---

## ⚙️ Механика аукциона

### Жизненный цикл аукциона

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  DRAFT   │───▶│  ACTIVE  │───▶│ FINISHED │───▶│ CLAIMED  │
│(создан)  │    │(идёт)    │    │(завершён)│    │(получен) │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │
     │               ▼               │
     │         ┌──────────┐          │
     └────────▶│ CANCELLED│◀─────────┘
               │(отменён) │
               └──────────┘
```

### Многораундовая система

Каждый аукцион состоит из **N раундов**, которые выполняются последовательно:

```
AUCTION
├── Round 1 (завершён)
│   ├── Bid 1: User A — 100₽ ✓ Победитель
│   ├── Bid 2: User B — 80₽
│   └── Bid 3: User C — 50₽
├── Round 2 (активен)
│   ├── Bid 1: User B — 120₽ ← Лидер
│   └── Bid 2: User D — 90₽
├── Round 3 (ожидает)
└── Round 4 (ожидает)
```

**Правила раундов:**
- В каждом раунде побеждает **максимальная ставка**
- После завершения раунда победитель получает право на приз этого раунда
- Раунды могут иметь разные призы или быть частью одного лота

### Модели данных

```typescript
// User — участник платформы
User {
  telegramId: string       // ID в Telegram
  username: string         // @username
  balance: {
    available: number      // Доступные средства
    locked: number         // Заблокированные в ставках
  }
  stats: {
    auctionsWon: number
    totalBids: number
    totalSpent: number
  }
}

// Auction — аукцион
Auction {
  title: string            // Название
  description: string      // Описание
  gift: GiftInfo          // Информация о призе
  status: AuctionStatus   // draft/active/finished/cancelled
  rounds: Round[]         // Массив раундов
  createdBy: User         // Создатель
}

// Round — раунд аукциона
Round {
  number: number          // Номер раунда
  status: RoundStatus     // pending/active/finished
  startTime: Date
  endTime: Date
  currentHighBid: Bid     // Текущая максимальная ставка
  antiSnipeExtensions: number  // Кол-во продлений
}

// Bid — ставка
Bid {
  user: User              // Кто поставил
  round: Round            // В каком раунде
  amount: number          // Сумма
  timestamp: Date         // Время ставки
  status: BidStatus       // active/outbid/won/refunded
}
```

---

## 💰 Двухбалансовая система

Система разделяет баланс пользователя на две части для обеспечения честности торгов:

```
┌─────────────────────────────────────────────────────────────┐
│                    БАЛАНС ПОЛЬЗОВАТЕЛЯ                      │
├─────────────────────────────┬───────────────────────────────┤
│      AVAILABLE (500₽)       │        LOCKED (200₽)          │
│   Доступно для новых ставок │   Заморожено в активных ставках│
└─────────────────────────────┴───────────────────────────────┘
                 │                            │
                 ▼                            ▼
         ┌─────────────┐              ┌─────────────┐
         │ Новая ставка│              │ Ставка      │
         │    150₽     │              │ перебита    │
         └──────┬──────┘              └──────┬──────┘
                │                            │
                ▼                            ▼
┌───────────────────────────────┐  ┌───────────────────────────┐
│ Available: 350₽ │ Locked: 350₽│  │ Available: 550₽ │Locked:0₽│
│   (-150₽)       │   (+150₽)   │  │   (+200₽)       │ (-200₽) │
└───────────────────────────────┘  └───────────────────────────┘
```

### Сценарии движения средств

| Событие | Available | Locked | Описание |
|---------|-----------|--------|----------|
| **Новая ставка** | −100₽ | +100₽ | Средства блокируются |
| **Ставка перебита** | +100₽ | −100₽ | Возврат на available |
| **Победа в раунде** | — | −100₽ | Списание locked |
| **Отмена аукциона** | +100₽ | −100₽ | Полный возврат |

### Преимущества системы:
- ✅ **Гарантия покрытия** — ставка всегда обеспечена средствами
- ✅ **Мгновенные возвраты** — при перебитии средства сразу доступны
- ✅ **Защита от овердрафта** — невозможно поставить больше, чем есть
- ✅ **Прозрачность** — пользователь видит, сколько заморожено

---

## 🛡️ Anti-Sniping механизм

**Sniping** — тактика, когда участник ждёт последних секунд аукциона и делает ставку, не оставляя другим времени на ответ.

### Как работает защита:

```
Время до конца раунда: 2:00 ──▶ 1:00 ──▶ 0:30 ──▶ 0:05 ──▶ СТАВКА!
                                              │
                                              ▼
                              ┌───────────────────────────┐
                              │  Ставка в последние 30 сек│
                              │  THRESHOLD = 30 секунд    │
                              └─────────────┬─────────────┘
                                            │
                                            ▼
                              ┌───────────────────────────┐
                              │  Продление на 15 секунд   │
                              │  EXTENSION = 15 секунд    │
                              │  Новое время: 0:20        │
                              └───────────────────────────┘
```

### Параметры конфигурации:

```env
ANTI_SNIPE_THRESHOLD_SECONDS=30   # Порог срабатывания (последние N сек)
ANTI_SNIPE_EXTENSION_SECONDS=15   # На сколько продлевать
MAX_ANTI_SNIPE_EXTENSIONS=5       # Макс. количество продлений
```

### Алгоритм:

```javascript
function handleBid(bid, round) {
  const timeLeft = round.endTime - now();
  
  if (timeLeft <= ANTI_SNIPE_THRESHOLD) {
    if (round.antiSnipeExtensions < MAX_EXTENSIONS) {
      round.endTime += ANTI_SNIPE_EXTENSION;
      round.antiSnipeExtensions++;
      notifyParticipants('round_extended');
    }
  }
}
```

---

## 🚀 Этап 1 — Core Auction Engine (Завершён ✅)

Базовая инфраструктура аукционов:

- ✅ MongoDB модели (User, Auction, Round, Bid, Balance)
- ✅ Двухбалансовая система (available/locked)
- ✅ Аукционная логика с многораундовой моделью
- ✅ Anti-sniping механизм
- ✅ REST API
- ✅ JWT авторизация

## � Требования

Перед установкой убедитесь, что у вас установлены:

### Обязательные
- **Node.js** v18 или выше ([скачать](https://nodejs.org/))
- **npm** v9+ (устанавливается вместе с Node.js)
- **Docker Desktop** ([скачать](https://www.docker.com/products/docker-desktop/))
  - Для Windows: Docker Desktop for Windows
  - Для macOS: Docker Desktop for Mac
  - Для Linux: Docker Engine

### Опциональные
- **Git** для клонирования репозитория ([скачать](https://git-scm.com/))
- **MongoDB Compass** для просмотра БД ([скачать](https://www.mongodb.com/products/compass))

### Проверка установки

```bash
# Проверить версию Node.js
node --version  # должно быть v18.0.0 или выше

# Проверить версию npm
npm --version   # должно быть 9.0.0 или выше

# Проверить Docker
docker --version
docker-compose --version
```

## �📦 Установка

### Шаг 1: Клонирование репозитория

```bash
git clone <repository-url>
cd telegram-gift-auction
```

### Шаг 2: Установка зависимостей

```bash
# Установить зависимости для backend
npm install

# Установить зависимости для frontend
cd client
npm install
cd ..
```

### Шаг 3: Настройка окружения

```bash
# Создать .env файл (скопировать из .env.example)
cp .env.example .env

# Открыть .env и настроить переменные окружения
# Минимальные настройки:
# - MONGODB_URI=mongodb://localhost:27017/telegram-auction
# - REDIS_URL=redis://localhost:6379
# - JWT_SECRET=your-secret-key-here
```

### Шаг 4: Запуск MongoDB и Redis через Docker

```bash
# Запустить MongoDB
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Запустить Redis
docker run -d -p 6379:6379 --name redis redis:7.2

# Проверить, что контейнеры запущены
docker ps
```

### Шаг 5: Заполнение тестовыми данными

```bash
# Запустить seed для создания тестовых данных
npm run seed
```

### Шаг 6: Запуск приложения

```bash
# Вариант 1: Запустить через start.bat (Windows)
start.bat

# Вариант 2: Запустить вручную
# Backend (в одном терминале)
npm run dev

# Frontend (в другом терминале)
cd client
npm run dev
```

Приложение будет доступно:
- **Backend API**: http://localhost:3000
- **Frontend**: http://localhost:5173

## 🛑 Остановка приложения

```bash
# Остановить серверы через stop.bat (Windows)
stop.bat

# Остановить все Docker контейнеры
docker-compose down

# Или остановить контейнеры по отдельности
docker stop mongodb redis

# Удалить контейнеры (если нужно)
docker rm mongodb redis
```

## 🔧 Конфигурация

Настройки в `.env`:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/telegram-auction
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key

# Anti-sniping
ANTI_SNIPE_THRESHOLD_SECONDS=30
ANTI_SNIPE_EXTENSION_SECONDS=15
MAX_ANTI_SNIPE_EXTENSIONS=5
```

## 📡 API Endpoints

### Health
- `GET /api/health` - Проверка статуса API

### Users
- `POST /api/users/auth/telegram` - Регистрация/вход через Telegram
- `GET /api/users/me/profile` - Профиль текущего пользователя
- `GET /api/users/me/balance` - Баланс пользователя
- `POST /api/users/me/balance/add` - Пополнить баланс (тест)
- `GET /api/users/leaderboard` - Лидерборд

### Auctions
- `GET /api/auctions` - Все аукционы
- `GET /api/auctions/active` - Активные аукционы
- `GET /api/auctions/:id` - Информация об аукционе
- `POST /api/auctions` - Создать аукцион
- `POST /api/auctions/:id/start` - Запустить аукцион
- `GET /api/auctions/:id/leaderboard` - Лидерборд аукциона

### Bids
- `POST /api/bids` - Сделать ставку
- `GET /api/bids/round/:roundId/top` - Топ ставки раунда
- `GET /api/bids/round/:roundId/my-bid` - Моя ставка в раунде
- `GET /api/bids/history` - История ставок

## 🧪 Тестирование

```bash
# Авторизация (получить токен)
curl -X POST http://localhost:3000/api/users/auth/telegram \
  -H "Content-Type: application/json" \
  -d '{"telegramId": "111111111", "firstName": "Test"}'

# Получить активные аукционы
curl http://localhost:3000/api/auctions/active

# Сделать ставку (с токеном)
curl -X POST http://localhost:3000/api/bids \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"auctionId": "...", "roundId": "...", "amount": 100}'
```

## 💰 Двухбалансовая система

```
┌─────────────┐     ┌─────────────┐
│  Available  │ ──▶ │   Locked    │   Ставка
│   (можно    │     │ (заморожено │
│  тратить)   │     │  для ставки)│
└─────────────┘     └─────────────┘
       ▲                   │
       │                   ▼
       │            ┌─────────────┐
       └──────────  │   Outbid    │   Возврат
                    │  (перебит)  │
                    └─────────────┘
```

## 🛡️ Anti-Sniping

Если ставка приходит в последние 60 секунд:
- Раунд продлевается на 30 секунд
- Нельзя поставить ставку в последнюю секунду
- Неограниченное количество продлений

## 📂 Структура проекта

```
src/
├── config/          # Конфигурация
├── controllers/     # REST контроллеры
├── middleware/      # Auth, Error handling
├── models/          # MongoDB модели
├── routes/          # API роуты
├── services/        # Бизнес-логика
├── types/           # TypeScript типы
├── utils/           # Утилиты
├── scripts/         # Скрипты (seed)
└── index.ts         # Entry point
```

## 🔜 Следующие этапы

- **Этап 2**: WebSocket & Real-Time
- **Этап 3**: Social & Gamification
- **Этап 4**: Premium UI
- **Этап 5**: Auto-Bid Engine
- **Этап 6**: Telegram Bot Integration
- **Этап 7**: Load Testing
