# Этап 1: сборка
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY . .
RUN npm run prisma:generate
RUN npm run build

# Этап 2: рантайм
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev
RUN npm run prisma:generate

COPY --from=build /app/dist ./dist

EXPOSE 5187
CMD ["node", "dist/main"]
