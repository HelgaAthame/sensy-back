#!/bin/sh
set -e

echo "Применяю миграции Prisma..."
npx prisma migrate deploy

echo "Наполняю базу сидом (идемпотентно, пропускается если уже есть)..."
npx prisma db seed

echo "Запускаю API..."
exec node dist/main
