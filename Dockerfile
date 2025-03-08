FROM mcr.microsoft.com/devcontainers/javascript-node:0-16

WORKDIR /app

# Копируем файлы package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код приложения
COPY . .

# Если приложение требует сборки (например, TypeScript)
RUN npm run build

# Открываем порт, который будет использоваться приложением
EXPOSE 3000

# Команда для запуска приложения
<<<<<<< HEAD
CMD ["npm", "start"]
=======
CMD ["npm", "start"]
>>>>>>> 1e6ed1ec73ffd390d2f43c992d7af99925950072
