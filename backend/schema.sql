-- =====================================================================
-- СЕМЕЙНЫЙ БЮДЖЕТ (FAMILY BUDGET MVP) - POSTGRESQL SCHEMA
-- Архитектурные паттерны: Firefly-III (minor units), Beancount (data integrity),
-- Paperless-ngx (document pipeline), iHateMoney (family members & splits)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- 1. USERS & TELEGRAM ACCOUNTS
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE,
    username VARCHAR(64),
    first_name VARCHAR(128) NOT NULL,
    last_name VARCHAR(128),
    avatar_url TEXT,
    language_code VARCHAR(8) DEFAULT 'ru',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_telegram_id ON users(telegram_id);

-- ---------------------------------------------------------------------
-- 2. FAMILY (Семья / Пространство бюджета)
-- ---------------------------------------------------------------------
CREATE TABLE family (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(128) NOT NULL,
    base_currency VARCHAR(3) NOT NULL DEFAULT 'RUB' CHECK (base_currency IN ('RUB', 'USD', 'EUR')),
    invite_code VARCHAR(16) NOT NULL UNIQUE,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_family_invite_code ON family(invite_code);

-- ---------------------------------------------------------------------
-- 3. FAMILY MEMBERS (Участники семьи - до 5 человек)
-- ---------------------------------------------------------------------
CREATE TABLE family_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES family(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    display_name VARCHAR(64) NOT NULL,
    avatar_emoji VARCHAR(8) DEFAULT '👤',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_family_user UNIQUE (family_id, user_id)
);
CREATE INDEX idx_family_members_family ON family_members(family_id);

-- ---------------------------------------------------------------------
-- 4. CATEGORIES (Категории и подкатегории)
-- ---------------------------------------------------------------------
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES family(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(64) NOT NULL,
    icon VARCHAR(32) NOT NULL DEFAULT 'Tag',
    color VARCHAR(16) NOT NULL DEFAULT 'emerald',
    is_income BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_categories_family ON categories(family_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- ---------------------------------------------------------------------
-- 5. TAGS (Метки операций)
-- ---------------------------------------------------------------------
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES family(id) ON DELETE CASCADE,
    name VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_family_tag UNIQUE (family_id, name)
);
CREATE INDEX idx_tags_family ON tags(family_id);

-- ---------------------------------------------------------------------
-- 6. DOCUMENTS (Файлы чеков, квитанций, выписок)
-- Паттерн paperless-ngx: хранение исходников, статусы обработки
-- ---------------------------------------------------------------------
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES family(id) ON DELETE CASCADE,
    uploaded_by_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE RESTRICT,
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(64) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'review_needed', 'confirmed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_documents_family_status ON documents(family_id, status);

-- ---------------------------------------------------------------------
-- 7. DOCUMENT EXTRACTIONS (Результаты локального OCR Tesseract)
-- ---------------------------------------------------------------------
CREATE TABLE document_extractions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    merchant_name VARCHAR(128),
    merchant_inn VARCHAR(16),
    receipt_date DATE,
    receipt_time TIME,
    -- Minor units (копейки)
    extracted_total_kopecks BIGINT CHECK (extracted_total_kopecks >= 0),
    confidence_score NUMERIC(4, 2) NOT NULL DEFAULT 0.0 CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    suggested_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    raw_ocr_text TEXT NOT NULL,
    ocr_engine VARCHAR(32) NOT NULL DEFAULT 'tesseract-5.4-rus+eng',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 8. DOCUMENT LINE ITEMS (Позиции в чеке)
-- ---------------------------------------------------------------------
CREATE TABLE document_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    extraction_id UUID NOT NULL REFERENCES document_extractions(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(10, 3) NOT NULL DEFAULT 1.0,
    unit_price_kopecks BIGINT NOT NULL CHECK (unit_price_kopecks >= 0),
    total_price_kopecks BIGINT NOT NULL CHECK (total_price_kopecks >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_doc_line_items ON document_line_items(extraction_id);

-- ---------------------------------------------------------------------
-- 9. TRANSACTIONS (Операции: расход, доход, перевод)
-- Суммы строго в минорных единицах (BIGINT копейки) - без float!
-- ---------------------------------------------------------------------
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES family(id) ON DELETE CASCADE,
    paid_by_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    type VARCHAR(16) NOT NULL CHECK (type IN ('expense', 'income', 'transfer', 'saving')),
    amount_kopecks BIGINT NOT NULL CHECK (amount_kopecks > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'RUB' CHECK (currency IN ('RUB', 'USD', 'EUR')),
    description TEXT NOT NULL,
    transaction_date DATE NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'review_needed' 
        CHECK (status IN ('draft', 'review_needed', 'confirmed', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_transactions_family_date ON transactions(family_id, transaction_date DESC);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_category ON transactions(category_id);

-- ---------------------------------------------------------------------
-- 10. TRANSACTION SPLITS (Разбивка расходов между участниками)
-- Паттерн iHateMoney: кто за кого оплатил, учет взаимных долгов
-- ---------------------------------------------------------------------
CREATE TABLE transaction_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    share_kopecks BIGINT NOT NULL CHECK (share_kopecks >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tx_member_split UNIQUE (transaction_id, member_id)
);
CREATE INDEX idx_tx_splits_member ON transaction_splits(member_id);

-- ---------------------------------------------------------------------
-- 11. TRANSACTION TAGS (M:N связь операций и тегов)
-- ---------------------------------------------------------------------
CREATE TABLE transaction_tags (
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (transaction_id, tag_id)
);

-- ---------------------------------------------------------------------
-- 12. BUDGETS (Месячные бюджеты: План / Факт - Actual Budget pattern)
-- ---------------------------------------------------------------------
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES family(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    month_period CHAR(7) NOT NULL, -- Формат YYYY-MM
    limit_kopecks BIGINT NOT NULL CHECK (limit_kopecks >= 0),
    notify_threshold_percent INT NOT NULL DEFAULT 80 CHECK (notify_threshold_percent BETWEEN 1 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_family_cat_month UNIQUE (family_id, category_id, month_period)
);
CREATE INDEX idx_budgets_period ON budgets(family_id, month_period);

-- ---------------------------------------------------------------------
-- 13. DOCUMENT COMMENTS (Заметки и комментарии к документам)
-- ---------------------------------------------------------------------
CREATE TABLE document_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 14. RECURRING RULES (Правила регулярных списаний: подписки, ЖКХ)
-- ---------------------------------------------------------------------
CREATE TABLE recurring_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES family(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    amount_kopecks BIGINT NOT NULL CHECK (amount_kopecks > 0),
    frequency VARCHAR(16) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    day_of_month INT CHECK (day_of_month BETWEEN 1 AND 31),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 15. SCHEDULED PAYMENTS (Запланированные платежи)
-- ---------------------------------------------------------------------
CREATE TABLE scheduled_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recurring_rule_id UUID REFERENCES recurring_rules(id) ON DELETE SET NULL,
    family_id UUID NOT NULL REFERENCES family(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    amount_kopecks BIGINT NOT NULL CHECK (amount_kopecks > 0),
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'skipped')),
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 16. SAVINGS GOALS (Копилки и целевые фонды семьи, alias: funds)
-- ---------------------------------------------------------------------
CREATE TABLE savings_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES family(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    target_amount_kopecks BIGINT NOT NULL CHECK (target_amount_kopecks > 0),
    current_amount_kopecks BIGINT NOT NULL DEFAULT 0 CHECK (current_amount_kopecks >= 0),
    target_date DATE,
    icon VARCHAR(32) DEFAULT 'PiggyBank',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE VIEW funds AS SELECT * FROM savings_goals;

-- ---------------------------------------------------------------------
-- 17. AUDIT LOGS (Журнал аудита действий пользователей)
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID REFERENCES family(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_family ON audit_logs(family_id, created_at DESC);
