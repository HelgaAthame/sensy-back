# Sensy Backend

Бэкенд системы контроля качества звонков колл-центра. Контракт API и общий план разработки — см. [BACKEND_PLAN.md](./BACKEND_PLAN.md).

Стек: NestJS + TypeScript, PostgreSQL (Prisma), Redis (BullMQ, с Фазы 1), MinIO (с Фазы 1), self-hosted Whisper/LLM (с Фаз 2-4). Подробности и обоснование — в плане.

## Запуск одной командой (рекомендуется)

```bash
cp .env.example .env
docker compose up -d --build
```

Поднимает всё: Postgres, Redis, MinIO и сам API. Контейнер `api` при старте сам накатывает миграции Prisma и наполняет базу сидом (идемпотентно — при перезапуске ничего не дублирует), см. [docker-entrypoint.sh](./docker-entrypoint.sh).

API — на `http://localhost:5187`, Swagger UI — на `http://localhost:5187/api/docs`.

Сид создаёт пользователя `admin@sensy.by` / `admin12345` (переопределяется через `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

## Режим разработки (hot-reload)

Для активной разработки удобнее поднять только инфраструктуру в Docker, а сам API — локально через `npm`, чтобы правки в коде подхватывались на лету:

```bash
cp .env.example .env
docker compose up -d postgres redis minio
npm install
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

## Статус реализации

- **Фаза 0 (готово)**: каркас, auth (`signin`), CRUD `operators`/`projects`/`dictionaries`/`checklists`, Swagger.
- **Фазы 1-5**: см. раздел 9 [BACKEND_PLAN.md](./BACKEND_PLAN.md).
