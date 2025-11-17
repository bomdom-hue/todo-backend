const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env

const app = express();
const port = process.env.PORT || 3000; // Use PORT from .env or default to 3000

// Configure PostgreSQL connection using DATABASE_URL from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  console.log('Serving index.html');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/tasks', async (req, res) => {
  try {
    console.log('GET /tasks called');
    const result = await pool.query('SELECT * FROM tasks ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

app.post('/tasks', async (req, res) => {
  try {
    console.log('POST /tasks received:', req.body);
    const { task, due_date } = req.body;
    const result = await pool.query('INSERT INTO tasks (task, due_date) VALUES ($1, $2) RETURNING *', [task, due_date]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error adding task:', err);
    res.status(500).json({ error: 'Failed to add task' });
  }
});

app.delete('/tasks/:id', async (req, res) => {
  try {
    console.log('DELETE /tasks/:id called:', req.params.id);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);
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
    console.log('PUT /tasks/:id called:', req.params.id, req.body);
    const id = parseInt(req.params.id, 10);
    const { task, due_date, completed } = req.body;
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }
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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});