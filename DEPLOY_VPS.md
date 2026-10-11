# 🚀 Полное руководство по развертыванию FinSync на VPS (включая не новый сервер)

Данное руководство содержит подробную пошаговую инструкцию по переносу и запуску проекта **FinSync (Семейный Бюджет)** из GitHub на ваш VPS (виртуальный сервер под управлением Ubuntu / Debian / Rocky Linux).

Особое внимание уделено тому, что **сервер не новый** — на нём уже могут быть установлены другие программы (Nginx, старый Docker, PostgreSQL), заняты порты или ограничен объём оперативной памяти.

---

## 📋 Содержание
1. [Предварительный аудит не нового VPS (Ресурсы, Порты, Установленное ПО)](#1-предварительный-аудит-не-нового-vps)
2. [Подготовка сервера (Swap, Docker, Git)](#2-подготовка-сервера-swap-docker-git)
3. [Клонирование проекта с GitHub](#3-клонирование-проекта-с-github)
4. [Создание и настройка файла секретов (.env)](#4-создание-и-настройка-файла-секретов-env)
5. [Запуск, сборка контейнеров и миграции Alembic (Docker Compose)](#5-запуск-и-сборка-контейнеров-docker-compose)
6. [Настройка Nginx Reverse Proxy и SSL (Let's Encrypt)](#6-настройка-nginx-reverse-proxy-и-ssl-lets-encrypt)
7. [Настройка Firewall (UFW) и безопасность](#7-настройка-firewall-ufw-и-безопасность)
8. [Резервное копирование и восстановление данных (Disaster Recovery)](#8-резервное-копирование-и-восстановление-данных-disaster-recovery)
9. [Обновление проекта из GitHub в будущем](#9-обновление-проекта-из-github-в-будущем)
10. [Диагностика и решение проблем (Troubleshooting)](#10-диагностика-и-решение-проблем-troubleshooting)

---

## 1. Предварительный аудит не нового VPS

Перед запуском или установкой любых пакетов необходимо проверить текущее состояние сервера, чтобы ничего не сломать и не вызвать конфликт с существующими сайтами/службами.

### 1.1. Проверка свободного места на диске и inodes (индексных дескрипторов)
```bash
# Проверка гигабайт дискового пространства:
df -h /

# Проверка количества свободных inodes (файловых дескрипторов):
df -ih /
```
* **Требование:** Минимум **5–8 ГБ** свободного места на корневом разделе для сборки образов Docker (Node.js + Python + Tesseract OCR).
* **Специфика не нового VPS:** На старых серверах частой скрытой проблемой является ошибка `No space left on device` при наличии свободных гигабайт. Причина — исчерпание inodes (100% IUse%) из-за миллионов мелких временных файлов, старых версий пакетов или логов. Убедитесь, что `IUse%` на разделе `/` составляет менее 85%.
* Если места или inodes мало, очистите старые неиспользуемые контейнеры, слои и логи:
  ```bash
  docker system prune -a --volumes -f
  sudo apt-get clean && sudo journalctl --vacuum-time=3d
  ```

### 1.2. Проверка оперативной памяти (RAM) и Swap
```bash
free -h
```
* **Требование:** Минимум **1.5–2 ГБ** доступной памяти (RAM + Swap).
* Локальный OCR (Tesseract) и сборка Vite/React в Docker требуют кратковременных всплесков памяти. Если памяти **<= 1.5 ГБ** и нет Swap, процесс сборки может быть аварийно завершен ядром Linux (ошибка `OOMKilled` или `Exit 137`).
* **Если Swap отсутствует (0B), создайте файл подкачки на 2 ГБ:**
  ```bash
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  # Сохранить Swap после перезагрузки:
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```

### 1.3. Проверка занятых сетевых портов
Поскольку VPS не новый, на нём могут работать другие веб-серверы, базы данных или боты. Проверьте ключевые порты:
```bash
sudo ss -tulpn | grep -E ':(80|443|3000|8000|5432|6379)'
```
или с помощью `lsof`:
```bash
sudo lsof -i :80 -i :443 -i :3000 -i :8000 -i :5432 -i :6379
```
* **Порты 80 и 443:** Если заняты процессом `nginx` или `apache2`, это нормально — мы используем хостовый Nginx как внешний реверс-прокси.
* **Порт 3000:** Используется фронтендом FinSync. Если он уже занят другим вашим проектом (например, Grafana, Gitea, Next.js), вы можете изменить внешний порт в `docker-compose.yml` (например, `"3005:3000"`).
* **Порты 5432 (Postgres) и 6379 (Redis):** В нашем `docker-compose.yml` порт PostgreSQL привязан только к локальному интерфейсу `127.0.0.1:5432`. Если на сервере уже работает отдельный хостовый PostgreSQL, просто измените привязку в `docker-compose.yml` на `"127.0.0.1:5433:5432"`, чтобы не было конфликта.

---

## 2. Подготовка сервера (Swap, Docker, Git)

### 2.1. Проверка наличия Git
```bash
git --version
```
Если Git не установлен:
```bash
sudo apt-get update && sudo apt-get install -y git curl openssl
```

### 2.2. Проверка версии Docker и Docker Compose
Проверьте, установлен ли Docker и работает ли его демон:
```bash
docker --version
docker compose version
```

> ⚠️ **Важно для не нового VPS:**
> * Если у вас установлена очень старая версия `docker.io` из репозиториев Ubuntu (версии 18.x или 19.x) или устаревший Python-пакет `docker-compose` 1.x (с дефисом), рекомендуется обновить Docker до официальной ветки **Docker-CE** и плагина **Docker Compose V2** (`docker compose` без дефиса).
> * Проверьте права текущего пользователя: если команда `docker ps` выдает `permission denied`, добавьте пользователя в группу `docker`:
>   ```bash
>   sudo usermod -aG docker $USER
>   newgrp docker
>   ```

Если Docker отсутствует, установите официальную версию одной командой:
```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
```

---

## 3. Клонирование проекта с GitHub

Рекомендуется размещать проект в директории `/opt/finsync` (общепринятый стандарт для серверных приложений) или в домашнем каталоге пользователя.

```bash
# Создаем каталог приложения и переходим в него
sudo mkdir -p /opt/finsync
sudo chown $USER:$USER /opt/finsync
cd /opt/finsync

# Клонируем ваш репозиторий (замените URL на ваш)
git clone https://github.com/ВАШ_АККАУНТ/ВАШ_РЕПОЗИТОРИЙ.git .
```

Проверьте структуру файлов:
```bash
ls -la
```
В каталоге должны присутствовать: `docker-compose.yml`, `.env.example`, `package.json`, папки `backend/`, `scripts/`, `src/`.

### ⚡ Экспресс-проверка скриптом автодиагностики
В проекте предусмотрен готовый скрипт, разработанный специально для не новых VPS:
```bash
./scripts/vps_check_and_setup.sh
```
Скрипт автоматически проверит RAM, Swap, место на диске, занятые порты и поможет интерактивно сгенерировать файл `.env` со всеми паролями и секретами.

---

## 4. Создание и настройка файла секретов (.env)

Файл `.env` хранит все пароли к базам данных, секретные ключи шифрования и токен Telegram-бота. Никогда не коммитьте `.env` в публичный Git!

### 4.1. Создание файла из шаблона
```bash
cp .env.example .env
```

### 4.2. Получение Telegram Bot Token и ID администратора
1. **Токен бота:**
   * Откройте Telegram и найдите официального бота **[@BotFather](https://t.me/BotFather)**.
   * Отправьте команду `/newbot`.
   * Введите отображаемое имя (например, `Семейный Бюджет`).
   * Введите системный username, заканчивающийся на `bot` (например, `IvanovFamilyBudget_bot`).
   * `@BotFather` выдаст токен вида: `7123456789:AAFlkBwD...`. Скопируйте его.
   * *(Рекомендуется)* Там же в `@BotFather` выполните `/setcommands` и укажите команды:
     ```text
     start - Подключиться к семье по инвайт-коду
     dashboard - Ссылка на веб-интерфейс и сводка месяца
     savings - Прогресс по целям и вкладам
     help - Справка по формату ввода расходов
     ```
2. **Ваш Telegram ID (для прав администратора):**
   * Откройте в Telegram бота **[@userinfobot](https://t.me/userinfobot)** или **[@getmyid_bot](https://t.me/getmyid_bot)**.
   * Нажмите `Start` и скопируйте числовой `Id` (например, `198765432`).

### 4.3. Генерация надежных криптографических паролей и токенов
Сгенерируйте уникальные ключи прямо в консоли VPS с помощью `openssl`:
```bash
# Пароль для PostgreSQL (16 байт hex = 32 символа):
openssl rand -hex 16

# Пароль для Redis (16 байт hex = 32 символа):
openssl rand -hex 16

# Секретный ключ подписи JWT токенов пользователей (32 байта hex = 64 символа):
openssl rand -hex 32

# Секретный токен для системных операций и аварийного сброса (24 байта hex):
openssl rand -hex 24

# Внутренний ключ межсервисного взаимодействия backend <-> ocr_worker (24 байта hex):
openssl rand -hex 24
```

> 💡 **Совет:** Вы также можете воспользоваться интерактивным скриптом `./scripts/vps_check_and_setup.sh`, который автоматически сгенерирует все эти секреты криптографически стойким генератором и бережно создаст готовый `.env`.

### 4.4. Заполнение параметров в файле `.env`
Откройте файл в текстовом редакторе (например, `nano .env`):
```bash
nano .env
```

Заполните ключевые секции:

```ini
# ============================================================
# FinSync — Боевая конфигурация (.env)
# ============================================================

# Доменное имя вашего сервера или внешний IP-адрес VPS:
DOMAIN_NAME=budget.yourdomain.ru
APP_URL=https://budget.yourdomain.ru

# PostgreSQL (База данных):
POSTGRES_DB=family_budget
POSTGRES_USER=budget_admin
POSTGRES_PASSWORD=СЮДА_ВСТАВЬТЕ_СГЕНЕРИРОВАННЫЙ_ПАРОЛЬ_БД

# Redis (Очереди задач и кэш):
REDIS_PASSWORD=СЮДА_ВСТАВЬТЕ_СГЕНЕРИРОВАННЫЙ_ПАРОЛЬ_REDIS
REDIS_URL=redis://:СЮДА_ВСТАВЬТЕ_СГЕНЕРИРОВАННЫЙ_ПАРОЛЬ_REDIS@redis:6379/0

# Telegram-бот (aiogram 3):
TELEGRAM_BOT_TOKEN=СЮДА_ТОКЕН_ИЗ_BOTFATHER
TELEGRAM_ADMIN_CHAT_IDS=ВАШ_ЦИФРОВОЙ_TELEGRAM_ID
TELEGRAM_BOT_MODE=long_polling

# JWT / Сессии и межсервисные ключи (ОБЯЗАТЕЛЬНЫ):
SECRET_KEY=СЮДА_ВСТАВЬТЕ_64_ЗНАЧНЫЙ_HEX_КЛЮЧ
ADMIN_TOKEN=СЮДА_ВСТАВЬТЕ_СГЕНЕРИРОВАННЫЙ_ADMIN_TOKEN
INTERNAL_API_KEY=СЮДА_ВСТАВЬТЕ_СГЕНЕРИРОВАННЫЙ_INTERNAL_API_KEY

# Базовая валюта и хранилище чеков:
BASE_CURRENCY=RUB
STORAGE_PATH=/app/storage
UPLOAD_DIR=/app/storage/uploads
```

Сохраните файл (`Ctrl+O`, затем `Enter`, для выхода `Ctrl+X`).

### 4.5. Установка строгих прав доступа на `.env`
На сервере с несколькими пользователями защитите файл от чтения чужими процессами:
```bash
chmod 600 .env
```

---

## 5. Запуск и сборка контейнеров (Docker Compose)

Стек состоит из 6 сервисов, разделенных по принципу наименьших сетевых привилегий:
1. `family_budget_postgres` — СУБД PostgreSQL 16 (изолирована в закрытой сети `db_net`, доступной только для API).
2. `family_budget_redis` — Очередь фоновых задач и кэширование (сеть `queue_net`).
3. `family_budget_api` — Бэкенд FastAPI (шлюз между сетями `db_net`, `queue_net` и `app_net`).
4. `family_budget_ocr_worker` — Локальный воркер Tesseract OCR (сеть `queue_net`, без прямого доступа к PostgreSQL).
5. `family_budget_bot` — Асинхронный Telegram-бот на aiogram 3 (сеть `app_net`, без прямого доступа к PostgreSQL).
6. `family_budget_dashboard` — Веб/PWA интерфейс на React + Vite (сеть `app_net`, порт 3000).

> **Сетевая безопасность:** `bot` и `ocr_worker` физически не находятся в одной сети с базой данных `postgres`. Доступ к БД разрешен исключительно для `family_budget_api` через внутреннюю сеть `db_net` (`internal: true`).
>
> **Оптимизация под VPS со слабым CPU:** Для сервиса `ocr_worker` жестко зафиксирован лимит `OMP_THREAD_LIMIT=1`, а также выставлены ограничения ресурсов (`cpus: 1.0`, `memory: 512M`), что исключает перегрузку процессора и кратковременное зависание сервера при обработке объемных чеков.

### 5.1. Запуск сборки и старт всех служб в фоне
```bash
docker compose up -d --build
```
*(При первом запуске сборка займет около 2–3 минут, так как скомпилируются образы Python и загрузятся пакеты Tesseract OCR)*.

### 5.2. Проверка статуса контейнеров
```bash
docker compose ps
```
Все контейнеры должны иметь статус `Up` (healthy):
```text
NAME                        STATUS              PORTS
family_budget_postgres      Up (healthy)        127.0.0.1:5432->5432/tcp
family_budget_redis         Up                  6379/tcp
family_budget_api           Up                  127.0.0.1:8000->8000/tcp
family_budget_ocr_worker    Up                  
family_budget_bot           Up                  
family_budget_dashboard     Up                  0.0.0.0:3000->3000/tcp
```

### 5.3. Проверка логов
Убедитесь, что бот успешно подключился к Telegram, а база данных создала таблицы:
```bash
# Проверка логов Telegram-бота:
docker compose logs -f telegram_bot

# Проверка логов API:
docker compose logs -f backend

# Проверка работы воркера OCR:
docker compose logs -f ocr_worker
```

### 5.4. Проверка безопасности эндпоинтов (Smoke Check)
Проверьте защиту внутренних межсервисных эндпоинтов OCR и системного сброса:
```bash
# 1. Запрос к internal-эндпоинту без ключа — должен вернуть 401 Unauthorized:
curl -i -X POST -H "Content-Type: application/json" \
  -d '{"status":"failed"}' \
  http://127.0.0.1:8000/api/internal/documents/doc-test/status

# 2. Запрос с правильным INTERNAL_API_KEY — вернет 404 Not Found (auth пройдена, документ не существует):
curl -i -X POST -H "Content-Type: application/json" \
  -H "X-Internal-Key: ВАШ_INTERNAL_API_KEY" \
  -d '{"status":"failed"}' \
  http://127.0.0.1:8000/api/internal/documents/doc-test/status

# 3. Запрос на системный сброс без ADMIN_TOKEN — должен вернуть 401 Unauthorized:
curl -i -X POST -H "Content-Type: application/json" \
  -d '{"mode":"clean"}' \
  http://127.0.0.1:8000/api/system/reset
```

Напишите вашему боту в Telegram команду `/start` — он должен мгновенно ответить приветственным сообщением.

---

## 6. Настройка Nginx Reverse Proxy и SSL (Let's Encrypt)

На не новом VPS веб-сервер Nginx обычно уже установлен на самом хосте и обслуживает порты 80 и 443. Настроим проксирование запросов к нашему контейнеру FinSync.

### 6.1. Установка Nginx и Certbot (если они ещё не установлены)
```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

### 6.2. Создание конфигурации виртуального хоста
Создайте файл конфигурации для вашего домена (замените `budget.yourdomain.ru` на ваш домен):
```bash
sudo nano /etc/nginx/sites-available/finsync.conf
```

Вставьте следующую оптимизированную конфигурацию с поддержкой PWA, WebSockets и проксирования API:

```nginx
# Перенаправление HTTP на HTTPS будет настроено Certbot автоматически
server {
    listen 80;
    server_name budget.yourdomain.ru;

    # Максимальный размер загружаемого фото чека (25 МБ)
    client_max_body_size 25M;

    # Сжатие gzip для быстрой отдачи PWA
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # Веб-дашборд (React PWA)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Прямое проксирование к FastAPI Core Backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

### 6.3. Активация конфигурации и проверка
```bash
# Создаем символическую ссылку в sites-enabled
sudo ln -s /etc/nginx/sites-available/finsync.conf /etc/nginx/sites-enabled/

# Проверяем корректность синтаксиса Nginx:
sudo nginx -t

# Если синтаксис OK, перезагружаем Nginx:
sudo systemctl reload nginx
```

### 6.4. Выпуск бесплатного SSL-сертификата Let's Encrypt
Убедитесь, что A-запись вашего домена (`budget.yourdomain.ru`) в панели DNS уже указывает на IP-адрес вашего VPS. Затем выполните:

```bash
sudo certbot --nginx -d budget.yourdomain.ru
```
* Введите ваш email для уведомлений об истечении сертификата.
* Согласитесь с условиями (`Y`).
* Certbot автоматически пропишет SSL-сертификат в конфигурацию Nginx и включит автоматическое перенаправление с HTTP на HTTPS.
* Сертификат продлевается автоматически каждые 90 дней (за это отвечает таймер `certbot.timer`).

---

## 7. Настройка Firewall (UFW) и безопасность

На не новом VPS критически важно убедиться, что внутренние порты базы данных и сервисов закрыты от сканирования из интернета.

```bash
# Разрешаем SSH (не заблокируйте свой доступ!):
sudo ufw allow 22/tcp

# Разрешаем стандартный веб-трафик:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Включаем UFW (если был выключен):
sudo ufw enable
sudo ufw status
```
> 🛡️ **Безопасность:** В `docker-compose.yml` порты PostgreSQL (`5432`), Redis (`6379`) и API (`8000`) привязаны к `127.0.0.1`. Они доступны **только локально** внутри сервера и изолированы от внешнего интернета.

---

## 8. Автоматическое резервное копирование (Cron)

В репозитории подготовлен скрипт резервного копирования `scripts/backup.sh`. Он создает сжатый дамп базы данных PostgreSQL и архивирует файлы чеков с ротацией за 14 дней.

### 8.1. Проверка прав на выполнение скрипта
```bash
chmod +x /opt/finsync/scripts/backup.sh
```

### 8.2. Тестовый запуск бэкапа
```bash
cd /opt/finsync
./scripts/backup.sh
```
В каталоге `/opt/finsync/backups/` появятся архивы `db/*.sql.gz` и `media/*.tar.gz`.

### 8.3. Добавление расписания в cron
Откройте планировщик задач:
```bash
crontab -e
```
Добавьте строку для ежедневного запуска бэкапа в 03:30 ночи:
```cron
30 3 * * * /opt/finsync/scripts/backup.sh >> /var/log/finsync_backup.log 2>&1
```

---

## 9. Обновление проекта из GitHub в будущем

Когда вы внесете изменения в код (например, добавите новую фичу или поправите фронтенд) и сделаете `git push` в репозиторий:

Обновить проект на VPS можно буквально тремя командами:

```bash
cd /opt/finsync

# 1. Загружаем свежий код из репозитория
git pull origin main

# 2. Пересобираем измененные контейнеры без остановки неизмененных
docker compose build

# 3. Перезапускаем контейнеры без простоя базы данных
docker compose up -d

# 4. Проверяем статус
docker compose ps
```

Если обновились только файлы фронтенда или бота, база данных PostgreSQL и все накопленные данные останутся нетронутыми в volume `pg_data`.

---

## 10. Диагностика и решение проблем (Troubleshooting)

### Ошибка: `port is already allocated` при запуске `docker compose up`
* **Причина:** Порт 3000, 8000 или 5432 занят другой программой на VPS.
* **Решение:** Найдите виновника: `sudo ss -tulpn | grep :3000`.
  В `docker-compose.yml` измените внешний порт сервиса (например, `"3005:3000"`), после чего обновите `proxy_pass http://127.0.0.1:3005` в Nginx.

### Ошибка: `Killed` или `Exit Code 137` во время `docker compose build`
* **Причина:** Нехватка оперативной памяти (OOM) во время компиляции Vite или сборки пакетов Tesseract.
* **Решение:** Подключите 2 ГБ Swap-файла (см. [Раздел 1.2](#12-проверка-оперативной-памяти-ram-и-swap)).

### Бот не реагирует на сообщения в Telegram
* Проверьте логи бота: `docker compose logs --tail=100 telegram_bot`.
* Убедитесь, что токен в `.env` указан верно без лишних кавычек или пробелов.
* Проверьте, что бот не запущен параллельно на вашей локальной машине (Telegram Bot API не разрешает два одновременных экземпляра в режиме Long Polling с одним токеном).

### Ошибка: `permission denied` при доступе к Docker
* Выполните: `sudo usermod -aG docker $USER && newgrp docker`.

---

🎉 **Поздравляем! Ваша персональная система учета семейных финансов FinSync успешно развернута на VPS, защищена SSL-сертификатом и подключена к Telegram-боту.**
