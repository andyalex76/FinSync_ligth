#!/usr/bin/env bash
# ==============================================================================
# FinSync — Скрипт предварительной диагностики и настройки для не нового VPS
# ==============================================================================
# Функции скрипта:
# 1. Диагностика текущего состояния сервера (ОС, RAM, Swap, свободный диск).
# 2. Проверка наличия и версий установленного ПО (Docker, Compose, Git, Nginx).
# 3. Проверка конфликтов сетевых портов (80, 443, 3000, 8000, 5432, 6379).
# 4. Безопасная генерация .env файла с криптостойкими секретами и правами 600.
# 5. Проверка готовности к первому запуску через Docker Compose.
# ==============================================================================

set -e

# Цвета для удобного вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BLUE}${BOLD}==============================================================================${NC}"
echo -e "${CYAN}${BOLD}     FinSync — Семейный Бюджет: Диагностика и Подготовка к Развертыванию${NC}"
echo -e "${BLUE}${BOLD}==============================================================================${NC}"
echo -e "Режим: Проверка существующего (не нового) VPS сервера перед установкой.\n"

# ------------------------------------------------------------------------------
# 1. Диагностика системных ресурсов
# ------------------------------------------------------------------------------
echo -e "${BOLD}[1/5] Проверка системных ресурсов (Память, Swap, Диск, ОС)...${NC}"

if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo -e "  ОС: ${GREEN}$PRETTY_NAME${NC} ($ID $VERSION_ID), Архитектура: ${GREEN}$(uname -m)${NC}"
else
    echo -e "  ОС: ${YELLOW}$(uname -s) $(uname -r)${NC}"
fi

# Проверка дискового пространства
DISK_AVAIL=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
echo -e "  Свободно на диске (/): ${GREEN}${DISK_AVAIL} GB${NC}"
if [ "$DISK_AVAIL" -lt 5 ]; then
    echo -e "  ${RED}⚠️ ВНИМАНИЕ: На диске осталось менее 5 GB! Docker сборка может завершиться ошибкой.${NC}"
    echo -e "     Рекомендуется очистить старые образы Docker: ${YELLOW}docker system prune -a --volumes${NC}"
fi

# Проверка оперативной памяти
RAM_TOTAL_MB=$(free -m | awk '/^Mem:/{print $2}')
SWAP_TOTAL_MB=$(free -m | awk '/^Swap:/{print $2}')
echo -e "  Оперативная память (RAM): ${GREEN}${RAM_TOTAL_MB} MB${NC}"
echo -e "  Файл подкачки (Swap): ${GREEN}${SWAP_TOTAL_MB} MB${NC}"

if [ "$RAM_TOTAL_MB" -lt 1500 ] && [ "$SWAP_TOTAL_MB" -lt 1000 ]; then
    echo -e "  ${YELLOW}⚠️ ПРЕДУПРЕЖДЕНИЕ: На сервере менее 1.5 GB RAM и отсутствует Swap!${NC}"
    echo -e "     Сборка OCR (Tesseract) или компиляция Vite может вызвать OOM (Out Of Memory)."
    echo -e "     Для добавления 2 GB Swap выполните:"
    echo -e "     ${CYAN}sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile${NC}"
    echo -e "     ${CYAN}echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab${NC}"
fi

# ------------------------------------------------------------------------------
# 2. Проверка наличия установленного ПО
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}[2/5] Проверка наличия необходимого программного обеспечения...${NC}"

# Git
if command -v git &> /dev/null; then
    echo -e "  [+] Git: ${GREEN}Установлен ($(git --version))${NC}"
else
    echo -e "  [-] Git: ${RED}НЕ установлен!${NC} Установите: ${YELLOW}sudo apt-get update && sudo apt-get install -y git${NC}"
fi

# Docker
DOCKER_FOUND=false
if command -v docker &> /dev/null; then
    DOCKER_VER=$(docker --version 2>/dev/null || echo "error")
    echo -e "  [+] Docker: ${GREEN}Установлен ($DOCKER_VER)${NC}"
    DOCKER_FOUND=true
    
    # Проверка работы демона Docker
    if docker ps &> /dev/null; then
        echo -e "      Статус службы: ${GREEN}Docker демон запущен и доступен без sudo${NC}"
    elif sudo docker ps &> /dev/null; then
        echo -e "      Статус службы: ${YELLOW}Docker требует прав sudo. Текущий пользователь не в группе docker.${NC}"
        echo -e "      (Чтобы не писать sudo: ${CYAN}sudo usermod -aG docker \$USER && newgrp docker${NC})"
    else
        echo -e "      ${RED}Внимание: Служба Docker не запущена! Запустите: sudo systemctl start docker${NC}"
    fi
else
    echo -e "  [-] Docker: ${RED}НЕ установлен!${NC}"
    echo -e "      Для установки официального Docker на Ubuntu/Debian:"
    echo -e "      ${CYAN}curl -fsSL https://get.docker.com | sh${NC}"
fi

# Docker Compose (V2 plugin or standalone)
COMPOSE_CMD=""
if docker compose version &> /dev/null; then
    COMPOSE_VER=$(docker compose version)
    echo -e "  [+] Docker Compose: ${GREEN}Установлен ($COMPOSE_VER)${NC}"
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_VER=$(docker-compose --version)
    echo -e "  [+] Docker Compose: ${YELLOW}Установлена устаревшая standalone версия ($COMPOSE_VER)${NC}"
    COMPOSE_CMD="docker-compose"
else
    echo -e "  [-] Docker Compose: ${RED}НЕ установлен!${NC}"
    echo -e "      Установите официальный плагин: ${YELLOW}sudo apt-get update && sudo apt-get install -y docker-compose-plugin${NC}"
fi

# Nginx
if command -v nginx &> /dev/null; then
    echo -e "  [+] Nginx: ${GREEN}Установлен ($(nginx -v 2>&1))${NC}"
    if systemctl is-active --quiet nginx 2>/dev/null; then
        echo -e "      Статус Nginx: ${GREEN}Активен (запущен на хосте)${NC}"
    else
        echo -e "      Статус Nginx: ${YELLOW}Остановлен или не управляется systemd${NC}"
    fi
else
    echo -e "  [-] Nginx: ${YELLOW}Не установлен на хосте (будет использоваться как реверс-прокси для SSL и домена)${NC}"
fi

# Certbot
if command -v certbot &> /dev/null; then
    echo -e "  [+] Certbot (SSL): ${GREEN}Установлен ($(certbot --version 2>&1))${NC}"
else
    echo -e "  [-] Certbot: ${YELLOW}Не установлен (потребуется для бесплатного SSL Let's Encrypt: sudo apt-get install -y certbot python3-certbot-nginx)${NC}"
fi

# ------------------------------------------------------------------------------
# 3. Проверка сетевых портов на не новом VPS
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}[3/5] Проверка сетевых портов (поиск возможных конфликтов с другими сервисами)...${NC}"

check_port() {
    local port=$1
    local name=$2
    local occupied=false
    local proc=""

    if command -v ss &> /dev/null; then
        proc=$(ss -tulpn 2>/dev/null | grep -E ":$port\s" | awk '{print $NF}' | head -n 1 || true)
    elif command -v netstat &> /dev/null; then
        proc=$(netstat -tulpn 2>/dev/null | grep -E ":$port\s" | awk '{print $NF}' | head -n 1 || true)
    fi

    if [ -n "$proc" ]; then
        echo -e "  Порт ${BOLD}$port${NC} ($name): ${YELLOW}ЗАНЯТ${NC} процессом ${CYAN}$proc${NC}"
    else
        echo -e "  Порт ${BOLD}$port${NC} ($name): ${GREEN}СВОБОДЕН${NC}"
    fi
}

check_port 80 "HTTP веб-сервер"
check_port 443 "HTTPS веб-сервер"
check_port 3000 "FinSync Dashboard (PWA)"
check_port 8000 "FinSync FastAPI Backend"
check_port 5432 "PostgreSQL (Хост/Контейнер)"
check_port 6379 "Redis (Хост/Контейнер)"

echo -e "  ${BLUE}Примечание: Внутренние порты PostgreSQL (5432) и Redis (6379) в docker-compose.yml привязаны к 127.0.0.1 и изолированы во внутренней сети Docker.${NC}"

# ------------------------------------------------------------------------------
# 4. Проверка и создание .env с криптостойкими секретами
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}[4/5] Конфигурация окружения (.env)...${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"

if [ -f "$ENV_FILE" ]; then
    echo -e "  Файл ${GREEN}.env${NC} уже существует в каталоге проекта."
    read -p "  Хотите проверить его или сгенерировать заново? (y/N): " REGEN_ENV
    if [[ "$REGEN_ENV" =~ ^[YyДд]$ ]]; then
        BACKUP_NAME="$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$ENV_FILE" "$BACKUP_NAME"
        echo -e "  Создана резервная копия: ${YELLOW}$BACKUP_NAME${NC}"
    else
        echo -e "  Используется текущий .env. Пропуск генерации."
        chmod 600 "$ENV_FILE"
        echo -e "  Установлены безопасные права: ${GREEN}chmod 600 .env${NC}"
    fi
fi

if [ ! -f "$ENV_FILE" ] || [[ "$REGEN_ENV" =~ ^[YyДд]$ ]]; then
    echo -e "  Генерация нового файла ${GREEN}.env${NC} с криптографически стойкими ключами..."
    
    # Генерация случайных паролей
    if command -v openssl &> /dev/null; then
        GEN_PG_PASS=$(openssl rand -hex 16)
        GEN_REDIS_PASS=$(openssl rand -hex 16)
        GEN_SECRET_KEY=$(openssl rand -hex 32)
        GEN_ADMIN_TOKEN=$(openssl rand -hex 24)
        GEN_INTERNAL_API_KEY=$(openssl rand -hex 24)
    else
        GEN_PG_PASS=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 24 | head -n 1)
        GEN_REDIS_PASS=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 24 | head -n 1)
        GEN_SECRET_KEY=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 48 | head -n 1)
        GEN_ADMIN_TOKEN=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
        GEN_INTERNAL_API_KEY=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    fi

    # Интерактивный запрос параметров
    echo -e "\n  ${BOLD}Введите параметры вашего развертывания:${NC}"
    
    read -p "  1. Ваш домен (например, budget.mysite.ru) или IP сервера [localhost]: " USER_DOMAIN
    USER_DOMAIN=${USER_DOMAIN:-localhost}
    
    if [ "$USER_DOMAIN" = "localhost" ]; then
        APP_URL="http://localhost:3000"
    else
        APP_URL="https://$USER_DOMAIN"
    fi

    echo -e "\n  ${YELLOW}Получение Telegram Bot Token:${NC}"
    echo -e "  1. Откройте @BotFather в Telegram"
    echo -e "  2. Отправьте /newbot, укажите название и username (например: MyFamilyBudget_bot)"
    echo -e "  3. Скопируйте полученный HTTP API токен."
    read -p "  2. Вставьте TELEGRAM_BOT_TOKEN: " USER_BOT_TOKEN
    USER_BOT_TOKEN=${USER_BOT_TOKEN:-"YOUR_TELEGRAM_BOT_TOKEN_HERE"}

    echo -e "\n  ${YELLOW}Telegram Admin Chat ID:${NC}"
    echo -e "  Узнайте ваш ID через бота @userinfobot или @getmyid_bot в Telegram."
    read -p "  3. Вставьте ваш Telegram ID (цифры): " USER_ADMIN_ID
    USER_ADMIN_ID=${USER_ADMIN_ID:-"123456789"}

    # Запись в .env
    cat <<EOF > "$ENV_FILE"
# ============================================================
# FinSync — Сгенерированная конфигурация (.env)
# Дата создания: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# ============================================================

# ---------- Общие настройки ----------
APP_ENV=production
APP_DEBUG=false
APP_LOG_LEVEL=INFO
TZ=Europe/Moscow

# ---------- Домен и сетевой доступ ----------
DOMAIN_NAME=${USER_DOMAIN}
APP_URL=${APP_URL}

# ---------- PostgreSQL (База данных) ----------
POSTGRES_DB=family_budget
POSTGRES_USER=budget_admin
POSTGRES_PASSWORD=${GEN_PG_PASS}
POSTGRES_PORT=5432
POSTGRES_HOST=postgres

# ---------- Redis (Очереди задач и кэш) ----------
REDIS_PASSWORD=${GEN_REDIS_PASS}
REDIS_URL=redis://:${GEN_REDIS_PASS}@redis:6379/0
REDIS_HOST=redis
REDIS_PORT=6379

# ---------- Telegram-бот (aiogram 3) ----------
TELEGRAM_BOT_TOKEN=${USER_BOT_TOKEN}
TELEGRAM_ADMIN_CHAT_IDS=${USER_ADMIN_ID}
TELEGRAM_BOT_MODE=long_polling

# ---------- JWT / Аутентификация ----------
SECRET_KEY=${GEN_SECRET_KEY}
ADMIN_TOKEN=${GEN_ADMIN_TOKEN}
INTERNAL_API_KEY=${GEN_INTERNAL_API_KEY}
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30
JWT_ALGORITHM=HS256

# ---------- Хранилище файлов и сканов чеков ----------
STORAGE_PATH=/app/storage
UPLOAD_DIR=/app/storage/uploads
MAX_UPLOAD_SIZE_MB=20
ALLOWED_EXTENSIONS=jpg,jpeg,png,webp,tiff,pdf

# ---------- OCR (Tesseract / Распознавание чеков) ----------
OCR_ENGINE=tesseract
TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata
OCR_LANGUAGES=rus+eng
OCR_DPI=300
OCR_CONFIDENCE_THRESHOLD=60

# ---------- Валюты и интерфейс ----------
BASE_CURRENCY=RUB
SUPPORTED_CURRENCIES=RUB,USD,EUR

# ---------- CORS и безопасность ----------
CORS_ORIGINS=${APP_URL},http://localhost:3000
RATE_LIMIT_PER_MINUTE=60

# ---------- Резервное копирование ----------
BACKUP_ENABLED=true
BACKUP_RETENTION_DAYS=14
EOF

    chmod 600 "$ENV_FILE"
    echo -e "  [+] Файл ${GREEN}.env${NC} успешно создан!"
    echo -e "  [+] Установлены безопасные права: ${GREEN}chmod 600 .env${NC} (чтение только владельцем)"
fi

# ------------------------------------------------------------------------------
# 5. Итоговый отчет и команды для старта
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}[5/5] Диагностика завершена! Готовность к развертыванию:${NC}"

echo -e "\n${GREEN}${BOLD}Следующие шаги для запуска FinSync на вашем VPS:${NC}"
if [ -n "$COMPOSE_CMD" ]; then
    echo -e "  1. Запуск всех сервисов (фоновый режим со сборкой):"
    echo -e "     ${CYAN}$COMPOSE_CMD up -d --build${NC}"
    echo -e "  2. Проверка статуса запущенных контейнеров:"
    echo -e "     ${CYAN}$COMPOSE_CMD ps${NC}"
    echo -e "  3. Просмотр логов в реальном времени:"
    echo -e "     ${CYAN}$COMPOSE_CMD logs -f${NC}"
    echo -e "  4. Просмотр логов только Telegram-бота:"
    echo -e "     ${CYAN}$COMPOSE_CMD logs -f telegram_bot${NC}"
else
    echo -e "  ${YELLOW}Сначала установите Docker и Docker Compose по инструкции выше!${NC}"
fi

echo -e "\n${BLUE}Полный пошаговый гайд с настройкой Nginx и SSL доступен в файле: ${BOLD}DEPLOY_VPS.md${NC}\n"
