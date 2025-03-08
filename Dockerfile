FROM node:18-alpine as build

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install --production

# Копируем исходный код
COPY . .

# Создаем оптимизированную сборку
RUN npm run build

# Финальный образ
FROM node:18-alpine

WORKDIR /app

# Копируем зависимости и сборку из предыдущего этапа
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

# Экспонируем порт
EXPOSE 3000

# Запускаем приложение
CMD ["node", "dist/server.js"]