# Этап 1: сборка
FROM node:22-alpine AS build
WORKDIR /app

# openssl нужен движку Prisma — без него на Alpine он не может определить версию libssl и падает в рантайме
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY . .
RUN npm run prisma:generate
RUN npm run build

# Этап 2: рантайм
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

# prisma/ts-node остаются в зависимостях: entrypoint сам накатывает миграции и сид при старте контейнера.
# NODE_ENV=production выставляется ПОСЛЕ npm install — иначе npm сам пропускает devDependencies
# (в т.ч. ts-node/prisma), даже без явного --omit=dev.
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
RUN npm run prisma:generate

ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 5187
ENTRYPOINT ["./docker-entrypoint.sh"]
