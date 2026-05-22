-- ═══════════════════════════════════════════════════════════
-- FitGenome AI — PostgreSQL Schema
-- Run on startup via asyncpg to create tables if they don't exist.
-- ═══════════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enum Types ─────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE activity_level_enum AS ENUM ('sedentary', 'light', 'moderate', 'active', 'very_active');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE fitness_goal_enum AS ENUM ('lose_weight', 'maintain', 'build_muscle', 'improve_endurance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE blood_group_enum AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE meal_type_enum AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── Users ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,
    full_name   VARCHAR(120) NOT NULL,

    -- Biometrics
    age         INTEGER,
    gender      gender_enum,
    height_cm   DOUBLE PRECISION,
    weight_kg   DOUBLE PRECISION,
    goal_weight_kg DOUBLE PRECISION,
    blood_group blood_group_enum,

    -- Goals & Activity
    activity_level activity_level_enum,
    fitness_goal   fitness_goal_enum,

    -- Calculated
    bmr         DOUBLE PRECISION,
    tdee        DOUBLE PRECISION,
    is_onboarded BOOLEAN NOT NULL DEFAULT FALSE,

    -- Timestamps
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);


-- ── Workout Logs ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workout_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_name   VARCHAR(200) NOT NULL,
    sets            INTEGER NOT NULL,
    reps            INTEGER NOT NULL,
    weight_kg       DOUBLE PRECISION,
    duration_minutes DOUBLE PRECISION,
    notes           TEXT,
    logged_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id ON workout_logs(user_id);


-- ── Nutrition Logs ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nutrition_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_item   VARCHAR(300) NOT NULL,
    calories    DOUBLE PRECISION NOT NULL,
    protein_g   DOUBLE PRECISION NOT NULL,
    carbs_g     DOUBLE PRECISION NOT NULL,
    fat_g       DOUBLE PRECISION NOT NULL,
    meal_type   meal_type_enum NOT NULL,
    logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_id ON nutrition_logs(user_id);


-- ── Daily Metrics ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_metrics (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date                DATE NOT NULL,
    steps               INTEGER DEFAULT 0,
    sleep_hours         DOUBLE PRECISION NOT NULL,
    weight_kg           DOUBLE PRECISION,
    water_ml            DOUBLE PRECISION,
    resting_heart_rate  INTEGER,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_user_id ON daily_metrics(user_id);


-- ── User Personas (Behavioral Pivot) ───────────────────────

CREATE TABLE IF NOT EXISTS user_personas (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    workout_volume_modifier DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    target_calories         DOUBLE PRECISION,
    deload_until            DATE,
    last_pivot_at           TIMESTAMPTZ,
    pivot_notes             TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_personas_user_id ON user_personas(user_id);


-- ── XP Ledger ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS xp_ledger (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    xp_amount   INTEGER NOT NULL,
    source      VARCHAR(100) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_ledger_user_id ON xp_ledger(user_id);


-- ── User Streaks ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_streaks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    current_streak      INTEGER DEFAULT 0,
    longest_streak      INTEGER DEFAULT 0,
    last_activity_date  DATE,
    total_xp            INTEGER DEFAULT 0,
    level               INTEGER DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);


-- ── Generated Plans ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS generated_plans (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_type   VARCHAR(20) NOT NULL,
    plan_data   JSONB NOT NULL,
    preferences VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_plans_user_id ON generated_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_plans_type ON generated_plans(plan_type);


-- ── Chat Messages ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(10) NOT NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
