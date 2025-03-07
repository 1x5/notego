// server.js
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');

// Инициализация Express
const app = express();
const PORT = process.env.PORT || 3000;

// Настройка пула соединений с базой данных
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'telegraph',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  max: 20, // максимальное количество клиентов в пуле
  idleTimeoutMillis: 30000 // время ожидания свободного клиента
});

// Проверка соединения с базой данных
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Ошибка подключения к базе данных', err);
  } else {
    console.log('База данных подключена успешно');
  }
});

// Промежуточное ПО
app.use(compression()); // сжатие ответов
app.use(helmet()); // безопасность заголовков
app.use(cors()); // разрешение кросс-доменных запросов
app.use(express.json()); // парсинг JSON
app.use(express.urlencoded({ extended: true })); // парсинг URL-encoded данных

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация таблицы при запуске
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('База данных инициализирована');
  } catch (error) {
    console.error('Ошибка инициализации базы данных', error);
  }
}

// API Endpoints

// Получение всех статей (с пагинацией)
app.get('/api/articles', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const { rows, rowCount } = await pool.query(
      'SELECT id, title, LEFT(content, 200) as preview, slug, created_at FROM articles ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    
    const totalCount = await pool.query('SELECT COUNT(*) FROM articles');
    
    res.json({
      data: rows,
      meta: {
        page,
        limit,
        total: parseInt(totalCount.rows[0].count),
        pages: Math.ceil(parseInt(totalCount.rows[0].count) / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при получении статей' });
  }
});

// Получение статьи по slug
app.get('/api/articles/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { rows } = await pool.query(
      'SELECT * FROM articles WHERE slug = $1',
      [slug]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при получении статьи' });
  }
});

// Создание новой статьи
app.post('/api/articles', async (req, res) => {
  try {
    const { title, content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Контент обязателен' });
    }
    
    // Генерация уникального slug
    const slug = generateSlug(title || 'Без заголовка');
    
    const { rows } = await pool.query(
      'INSERT INTO articles (title, content, slug) VALUES ($1, $2, $3) RETURNING *',
      [title || 'Без заголовка', content, slug]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при создании статьи' });
  }
});

// Обновление статьи
app.put('/api/articles/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { title, content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Контент обязателен' });
    }
    
    const { rows } = await pool.query(
      'UPDATE articles SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP WHERE slug = $3 RETURNING *',
      [title || 'Без заголовка', content, slug]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при обновлении статьи' });
  }
});

// Удаление статьи
app.delete('/api/articles/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    const { rowCount } = await pool.query(
      'DELETE FROM articles WHERE slug = $1',
      [slug]
    );
    
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при удалении статьи' });
  }
});

// Вспомогательная функция для генерации slug
function generateSlug(title) {
  // Транслитерация и нормализация строки
  const translit = title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // удаляем спецсимволы
    .replace(/\s+/g, '-'); // заменяем пробелы на дефисы
  
  // Добавляем случайную строку для уникальности
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${translit}-${randomStr}`;
}

// Обработка запросов к одностраничному приложению
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, async () => {
  await initializeDatabase();
  console.log(`Сервер запущен на порту ${PORT}`);
});

// Обработка завершения работы
process.on('SIGINT', async () => {
  await pool.end();
  console.log('Соединение с базой данных закрыто');
  process.exit(0);
});