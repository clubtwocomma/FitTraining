-- Migration: global_wod_expanded_and_custom_workout_per_user
-- Gerada por: FitTraining Strategy Execution
-- Data: 2026-04-26
-- 
-- INSTRUÇÕES:
--   Aplica com: psql -U <user> -d fittraining -f migration.sql
--   Ou no servidor: npx prisma migrate deploy (após copiar este ficheiro)

-- =============================================
-- 1. DROP da tabela GlobalWod antiga (era apenas title/content/type)
--    e criar nova versão expandida
-- =============================================

-- Remove a tabela antiga (os dados eram zero — nada era inserido nela)
DROP TABLE IF EXISTS "GlobalWod" CASCADE;

-- Cria nova GlobalWod com todos os campos necessários
CREATE TABLE "GlobalWod" (
    "id"          SERIAL       PRIMARY KEY,
    "slug"        TEXT         NOT NULL UNIQUE,
    "name"        TEXT         NOT NULL,
    "wodType"     TEXT         NOT NULL,  -- 'girl' | 'hero' | 'painstorm'
    "description" TEXT         NOT NULL,
    "stimulus"    TEXT,
    "workout"     JSONB        NOT NULL DEFAULT '[]',
    "rounds"      INTEGER,
    "amrap"       INTEGER,
    "honor"       TEXT,        -- Para Hero WODs: quem é homenageado
    "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX "GlobalWod_wodType_idx" ON "GlobalWod"("wodType");

-- =============================================
-- 2. Nova tabela CustomWorkout — isolada por utilizador
--    (anteriormente era um ficheiro JSON partilhado por todos)
-- =============================================
CREATE TABLE IF NOT EXISTS "CustomWorkout" (
    "id"        TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId"    INTEGER      NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "name"      TEXT         NOT NULL,
    "type"      TEXT         NOT NULL DEFAULT 'outro',
    "source"    TEXT,
    "rawText"   TEXT         NOT NULL,
    "exercises" JSONB        NOT NULL DEFAULT '[]',
    "structure" TEXT,
    "aiNotes"   TEXT,
    "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX "CustomWorkout_userId_createdAt_idx" ON "CustomWorkout"("userId", "createdAt");

-- =============================================
-- 3. Atualizar Result para referenciar nova GlobalWod
-- =============================================
-- A FK globalWodId já existe e o CASCADE behavior mantém-se.
-- Como recriamos GlobalWod com o mesmo nome, a FK deve continuar válida.
-- Se existia algum Result com globalWodId, remover a referência agora é seguro
-- porque a tabela original estava vazia.

-- =============================================
-- 4. Atualizar Prisma _prisma_migrations (regista a migration manualmente)
-- =============================================
INSERT INTO "_prisma_migrations" (
    "id", "checksum", "finished_at", "migration_name",
    "logs", "rolled_back_at", "started_at", "applied_steps_count"
) VALUES (
    gen_random_uuid()::text,
    'manual-migration-global-wod-custom-workout',
    NOW(),
    '20260426_global_wod_expanded_and_custom_workout_per_user',
    NULL, NULL, NOW(), 1
) ON CONFLICT DO NOTHING;
