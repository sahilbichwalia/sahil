// const express = require('express');
// const bodyParser = require('body-parser');
// const cors = require('cors');
// const { Client } = require('pg');
// const path = require('path');

// const app = express();
// const port = 3000;

// // PostgreSQL client setup
// const client = new Client({
//   connectionString: 'postgresql://jecrc_owner:Md5Dix4jfrEg@ep-plain-boat-a86yhz6z.eastus2.azure.neon.tech/jecrc?sslmode=require',
// });

// // Connect to the database
// client.connect()
//   .then(() => console.log('Connected to the database'))
//   .catch(err => console.error('Connection error', err.stack));




// Middleware setup
// app.use(cors({
//   origin: 'http://127.0.0.1:5500', // Allow requests only from your frontend origin
//   methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true
// }));
// app.use(bodyParser.json());

// // Serve static files from the frontend directory (adjust the path if necessary)
// app.use(express.static(path.join(__dirname, 'frontend')));

// Routes

require('dotenv').config(); // Load environment variables

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Client } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL client setup using environment variable
const client = new Client({
  connectionString: process.env.DB_CONNECTION_STRING,
});

// Connect to the database
client.connect()
  .then(() => console.log('Connected to the database'))
  .catch(err => console.error('Connection error', err.stack));

// Middleware setup
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN, // Use environment variable for frontend origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(bodyParser.json());

// Serve static files from the frontend directory (adjust the path if necessary)
app.use(express.static(path.join(__dirname, 'frontend')));


// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await client.query(
      'SELECT * FROM signup WHERE username = $1 OR email = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or email' });
    }

    const user = result.rows[0];

    if (password !== user.password) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    res.status(200).json({
      message: 'Login successful',
      department: user.department,
      user: { username: user.username, first_name: user.first_name, last_name: user.last_name },
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Registration endpoint
app.post('/register', async (req, res) => {
  const { email, password, first_name, last_name, emp_id, department } = req.body;

  if (!email || !password || !emp_id || !first_name || !last_name || !department) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const resultEmail = await client.query('SELECT * FROM signup WHERE email = $1', [email]);
    const resultEmpId = await client.query('SELECT * FROM signup WHERE emp_id = $1', [emp_id]);

    if (resultEmail.rows.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    if (resultEmpId.rows.length > 0) {
      return res.status(400).json({ message: 'Employee ID already registered' });
    }

    await client.query(
      'INSERT INTO signup (emp_id, email, password, first_name, last_name, department) VALUES ($1, $2, $3, $4, $5, $6)',
      [emp_id, email, password, first_name, last_name, department]
    );

    res.status(200).json({ message: 'Registration successful' });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete User endpoint
app.post('/delete-user', async (req, res) => {
  const { email, emp_id, department } = req.body;

  if (!email || !emp_id || !department) {
    return res.status(400).json({ message: 'Email, Employee ID, and Department are required' });
  }

  try {
    const result = await client.query(
      'SELECT * FROM signup WHERE email = $1 AND emp_id = $2 AND department = $3',
      [email, emp_id, department]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    await client.query(
      'DELETE FROM signup WHERE email = $1 AND emp_id = $2 AND department = $3',
      [email, emp_id, department]
    );

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error during user deletion:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Fetch all rooms from the database
app.get('/rooms', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM rooms ORDER BY block, floor, section');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Failed to load rooms' });
  }
});

// Update room status (Occupied/Available)
app.put('/rooms/update', async (req, res) => {
  const { id, status } = req.body;

  if (typeof id === 'undefined' || typeof status === 'undefined') {
    return res.status(400).json({ message: 'Invalid request: missing id or status' });
  }

  try {
    const result = await client.query(
      'UPDATE rooms SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rowCount > 0) {
      res.status(200).json({ message: 'Room status updated successfully.', room: result.rows[0] });
    } else {
      res.status(404).json({ message: 'Room not found' });
    }
  } catch (error) {
    console.error('Error updating room status:', error);
    res.status(500).json({ message: 'Failed to update room status' });
  }
});

// Fetch block-wise occupancy count
app.get('/block-counts', async (req, res) => {
  try {
    const result = await client.query(
      `SELECT 
        block, 
        COUNT(*) FILTER (WHERE status = true) AS occupied_count, 
        COUNT(*) FILTER (WHERE status = false) AS unoccupied_count 
      FROM rooms 
      GROUP BY block`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching block counts:', error);
    res.status(500).json({ message: 'Failed to fetch block counts' });
  }
});

// Add a new room
app.post('/rooms/add', async (req, res) => {
  const { roomNumber, floor, section, status, block } = req.body;

  if (!roomNumber || !floor || !section || !block) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const resultRoom = await client.query(
      'SELECT * FROM rooms WHERE room_number = $1 AND block = $2',
      [roomNumber, block]
    );

    if (resultRoom.rows.length > 0) {
      return res.status(400).json({ message: 'Room already exists in this block' });
    }

    await client.query(
      'INSERT INTO rooms (room_number, floor, section, status, block) VALUES ($1, $2, $3, $4, $5)',
      [roomNumber, floor, section, status, block]
    );

    res.status(201).json({ message: 'Room added successfully' });
  } catch (error) {
    console.error('Error during room addition:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to remove a room
app.delete('/rooms/delete', async (req, res) => {
  const { roomNumber, block } = req.body;

  if (!roomNumber || !block) {
    return res.status(400).json({ message: 'Room number and block are required' });
  }

  try {
    // Check if the room exists in the specified block
    const resultRoom = await client.query(
      'SELECT * FROM rooms WHERE room_number = $1 AND block = $2',
      [roomNumber, block]
    );

    if (resultRoom.rows.length === 0) {
      return res.status(404).json({ message: 'Room not found in this block' });
    }

    // Delete the room
    await client.query(
      'DELETE FROM rooms WHERE room_number = $1 AND block = $2',
      [roomNumber, block]
    );

    res.status(200).json({ message: 'Room removed successfully' });
  } catch (error) {
    console.error('Error during room deletion:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await client.end(); // Close the DB connection before exiting
  console.log('Database connection closed');
  process.exit(0);
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
