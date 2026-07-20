# Этап 1: сборка
# node:22-slim (Debian/glibc), а не alpine: onnxruntime-node (нужен @xenova/transformers
# для Whisper) поставляется прекомпилированным под glibc и не грузится на musl —
# падает с "Error loading shared library ld-linux-x86-64.so.2".
FROM node:22-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
COPY stubs ./stubs
RUN npm install

COPY . .
RUN npm run prisma:generate
RUN npm run build

# Этап 2: рантайм
FROM node:22-slim AS runner
WORKDIR /app

# ffmpeg даёт и ffmpeg, и ffprobe (нужен для извлечения метаданных аудио при загрузке звонка)
RUN apt-get update && apt-get install -y --no-install-recommends openssl ffmpeg && rm -rf /var/lib/apt/lists/*

# prisma/ts-node остаются в зависимостях: entrypoint сам накатывает миграции и сид при старте контейнера.
# NODE_ENV=production выставляется ПОСЛЕ npm install — иначе npm сам пропускает devDependencies
# (в т.ч. ts-node/prisma), даже без явного --omit=dev.
COPY package*.json ./
COPY prisma ./prisma
COPY stubs ./stubs
RUN npm install
RUN npm run prisma:generate

# Качаем веса Whisper в образ на этапе сборки — иначе рантайм тянул бы их
# заново при каждом холодном старте контейнера на Render.
COPY scripts ./scripts
RUN node scripts/prefetch-models.mjs

ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 5187
ENTRYPOINT ["./docker-entrypoint.sh"]
