# Sensy Backend

Бэкенд системы контроля качества звонков колл-центра. Контракт API и общий план разработки — см. [BACKEND_PLAN.md](./BACKEND_PLAN.md).

Стек: NestJS + TypeScript, PostgreSQL (Prisma), Redis (BullMQ, с Фазы 1), MinIO (с Фазы 1), self-hosted Whisper/LLM (с Фаз 2-4). Подробности и обоснование — в плане.

## Локальный запуск (Docker)

```bash
cp .env.example .env
docker compose up -d postgres redis minio
npm install
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

API поднимется на `http://localhost:5187`, Swagger UI — на `http://localhost:5187/api/docs`.

Сид создаёт пользователя `admin@sensy.by` / `admin12345` (переопределяется через `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

## Запуск всего стека в Docker

```bash
cp .env.example .env
docker compose up -d --build
```

## Статус реализации

- **Фаза 0 (готово)**: каркас, auth (`signin`), CRUD `operators`/`projects`/`dictionaries`/`checklists`, Swagger.
- **Фазы 1-5**: см. раздел 9 [BACKEND_PLAN.md](./BACKEND_PLAN.md).
