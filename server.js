const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
});

// ✨ FIX CORS - Allow your Netlify domain
app.use(cors({
  origin: [
    'https://todolist-fun.netlify.app',  // 👈 Your NEW URL
    'https://deft-sfogliatella-e217fb.netlify.app',  // Old one (optional, can remove)
    'http://localhost:5500',  // For local testing
    'http://127.0.0.1:5500'   // For local testing
  ],
  credentials: true
}));

app.use(express.json());

// Database initialization
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        task TEXT NOT NULL,
        due_date DATE,
        completed BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Database table ready!');
  } catch (err) {
    console.error('❌ Database init error:', err);
  }
}

initDatabase();

// Your routes...
app.get('/tasks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

app.post('/tasks', async (req, res) => {
  try {
    const { task, due_date } = req.body;
    const result = await pool.query(
      'INSERT INTO tasks (task, due_date) VALUES ($1, $2) RETURNING *',
      [task, due_date]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error adding task:', err);
    res.status(500).json({ error: 'Failed to add task' });
  }
});

app.delete('/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

app.put('/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { task, due_date, completed } = req.body;

    const result = await pool.query(
      'UPDATE tasks SET task = $1, due_date = $2, completed = $3 WHERE id = $4 RETURNING *',
      [task, due_date, completed, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// TEMP DIAGNOSTIC ROUTES — add above app.listen(...)
app.get('/db-info', async (req, res) => {
  try {
    // Query information_schema for column type
    const q = `
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'tasks' AND column_name = 'task';
    `;
    const info = await pool.query(q);

    // Mask DATABASE_URL a little for safety when printing
    const dbUrl = process.env.DATABASE_URL || 'not-set';
    const masked = dbUrl.length > 30
      ? dbUrl.slice(0, 15) + '...' + dbUrl.slice(-10)
      : dbUrl;

    res.json({
      db: masked,
      columnInfo: info.rows[0] || null
    });
  } catch (err) {
    console.error('/db-info error', err);
    res.status(500).json({ error: 'failed to fetch db info' });
  }
});

app.get('/fix-task-column', async (req, res) => {
  try {
    // run the ALTER — safe to run repeatedly
    await pool.query(`ALTER TABLE tasks ALTER COLUMN task TYPE TEXT;`);
    res.send("Task column changed to TEXT (or already TEXT).");
  } catch (err) {
    console.error('/fix-task-column error', err);
    res.status(500).send("Failed to update column: " + (err.message || err));
  }
});


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});