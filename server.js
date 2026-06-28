const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'agendamento-delivery-secret-key-2024';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERRO: DATABASE_URL não configurada!');
  console.error('Configure a variável DATABASE_URL no Railway com a URL do MySQL');
  process.exit(1);
}
const pool = mysql.createPool(DATABASE_URL);

// Migration
async function migrate() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      company_name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      role ENUM('admin', 'supplier') DEFAULT 'supplier',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS available_slots (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slot_date DATE NOT NULL,
      slot_time TIME NOT NULL,
      max_bookings INT DEFAULT 1,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_slot (slot_date, slot_time)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      supplier_id INT NOT NULL,
      slot_date DATE NOT NULL,
      slot_time TIME NOT NULL,
      status ENUM('scheduled', 'completed', 'cancelled') DEFAULT 'scheduled',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES users(id)
    )
  `);

  // Create default admin if not exists
  const [admins] = await pool.execute('SELECT id FROM users WHERE role = ?', ['admin']);
  if (admins.length === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.execute(
      'INSERT INTO users (name, email, password_hash, company_name, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
      ['Administrador', 'admin@agendamento.com', hash, 'Deposito Central', '11999999999', 'admin']
    );
    console.log('Default admin created: admin@agendamento.com / admin123');
  }
}

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  next();
}

// AUTH ROUTES
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, company_name, phone } = req.body;
    if (!name || !email || !password || !company_name) {
      return res.status(400).json({ error: 'Campos obrigatórios: name, email, password, company_name' });
    }
    const hash = await bcrypt.hash(password, 10);
    await pool.execute(
      'INSERT INTO users (name, email, password_hash, company_name, phone) VALUES (?, ?, ?, ?, ?)',
      [name, email, hash, company_name, phone || null]
    );
    const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    const token = jwt.sign({ id: rows[0].id, name, email, role: 'supplier', company_name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: rows[0].id, name, email, role: 'supplier', company_name } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email já cadastrado' });
    res.status(500).json({ error: 'Erro ao cadastrar' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Credenciais inválidas' });
    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });
    const user = rows[0];
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role, company_name: user.company_name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, company_name: user.company_name } });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// AVAILABLE SLOTS ROUTES (Admin)
app.get('/api/slots', authMiddleware, async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const today = new Date().toISOString().split('T')[0];
    let query = 'SELECT * FROM available_slots WHERE active = TRUE AND slot_date >= ?';
    const params = [today];
    if (date_from && date_from > today) { query += ' AND slot_date >= ?'; params.push(date_from); }
    if (date_to) { query += ' AND slot_date <= ?'; params.push(date_to); }
    query += ' ORDER BY slot_date, slot_time';
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar slots' });
  }
});

app.post('/api/slots', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { slot_date, slot_time, max_bookings } = req.body;
    await pool.execute(
      'INSERT INTO available_slots (slot_date, slot_time, max_bookings) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE max_bookings = VALUES(max_bookings), active = TRUE',
      [slot_date, slot_time, max_bookings || 1]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar slot' });
  }
});

app.post('/api/slots/bulk', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { slots } = req.body;
    for (const slot of slots) {
      await pool.execute(
        'INSERT INTO available_slots (slot_date, slot_time, max_bookings) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE max_bookings = VALUES(max_bookings), active = TRUE',
        [slot.slot_date, slot.slot_time, slot.max_bookings || 1]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar slots' });
  }
});

app.put('/api/slots/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { slot_date, slot_time, max_bookings, active } = req.body;
    await pool.execute(
      'UPDATE available_slots SET slot_date = ?, slot_time = ?, max_bookings = ?, active = ? WHERE id = ?',
      [slot_date, slot_time, max_bookings, active !== undefined ? active : true, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar slot' });
  }
});

app.delete('/api/slots/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.execute('UPDATE available_slots SET active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover slot' });
  }
});

// APPOINTMENTS ROUTES
app.get('/api/appointments', authMiddleware, async (req, res) => {
  try {
    let query = `
      SELECT a.*, u.name as supplier_name, u.company_name, u.email, u.phone
      FROM appointments a
      JOIN users u ON a.supplier_id = u.id
      WHERE a.slot_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
    `;
    const params = [];
    if (req.user.role === 'supplier') {
      query += ' AND a.supplier_id = ?';
      params.push(req.user.id);
    }
    if (req.query.date_from) { query += ' AND a.slot_date >= ?'; params.push(req.query.date_from); }
    if (req.query.date_to) { query += ' AND a.slot_date <= ?'; params.push(req.query.date_to); }
    if (req.query.status) { query += ' AND a.status = ?'; params.push(req.query.status); }
    query += ' ORDER BY a.slot_date DESC, a.slot_time DESC';
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar agendamentos' });
  }
});

app.post('/api/appointments', authMiddleware, async (req, res) => {
  try {
    const { slot_date, slot_time, notes } = req.body;
    if (!slot_date || !slot_time) return res.status(400).json({ error: 'Data e horário são obrigatórios' });

    // Check if date is in the past
    const today = new Date().toISOString().split('T')[0];
    if (slot_date < today) return res.status(400).json({ error: 'Não é possível agendar em datas passadas' });

    // Check if time has already passed for today
    if (slot_date === today) {
      const now = new Date();
      const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      if (slot_time <= currentTime) return res.status(400).json({ error: 'Não é possível agendar em horários passados' });
    }

    // Check if supplier already has an appointment on this day (max 1 per day)
    const [dayAppts] = await pool.execute(
      'SELECT id FROM appointments WHERE supplier_id = ? AND slot_date = ? AND status = "scheduled"',
      [req.user.id, slot_date]
    );
    if (dayAppts.length > 0) {
      return res.status(400).json({ error: 'Você já possui um agendamento neste dia. Limite de 1 agendamento por dia.' });
    }

    // Check if slot exists and has availability
    const [slots] = await pool.execute(
      'SELECT * FROM available_slots WHERE slot_date = ? AND slot_time = ? AND active = TRUE',
      [slot_date, slot_time]
    );
    if (slots.length === 0) return res.status(400).json({ error: 'Horário indisponível' });

    // Check current bookings
    const [bookings] = await pool.execute(
      'SELECT COUNT(*) as count FROM appointments WHERE slot_date = ? AND slot_time = ? AND status = "scheduled"',
      [slot_date, slot_time]
    );
    if (bookings[0].count >= slots[0].max_bookings) {
      return res.status(400).json({ error: 'Horário lotado' });
    }

    await pool.execute(
      'INSERT INTO appointments (supplier_id, slot_date, slot_time, notes) VALUES (?, ?, ?, ?)',
      [req.user.id, slot_date, slot_time, notes || null]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
});

app.put('/api/appointments/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Agendamento não encontrado' });
    if (req.user.role === 'supplier' && rows[0].supplier_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    await pool.execute('UPDATE appointments SET status = "cancelled" WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cancelar agendamento' });
  }
});

app.put('/api/appointments/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    await pool.execute('UPDATE appointments SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

// Stats for admin
app.get('/api/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [todayAppts] = await pool.execute(
      'SELECT COUNT(*) as count FROM appointments WHERE slot_date = CURDATE() AND status = "scheduled"'
    );
    const [totalSuppliers] = await pool.execute('SELECT COUNT(*) as count FROM users WHERE role = "supplier"');
    const [weekAppts] = await pool.execute(
      'SELECT COUNT(*) as count FROM appointments WHERE slot_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND status = "scheduled"'
    );
    const [pendingSlots] = await pool.execute(
      'SELECT COUNT(*) as count FROM available_slots WHERE active = TRUE AND slot_date >= CURDATE()'
    );
    res.json({
      today: todayAppts[0].count,
      suppliers: totalSuppliers[0].count,
      week: weekAppts[0].count,
      available_slots: pendingSlots[0].count
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
(async () => {
  try {
    await migrate();
    console.log('Database connected and migrated');
  } catch (err) {
    console.error('Database error (continuing without DB):', err.message);
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
})();
