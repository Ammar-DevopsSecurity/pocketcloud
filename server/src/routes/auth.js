const express = require('express');
const router = express.Router();
const { createUser, validateUser, hasUsers, listUsers, deleteUser, updatePermissions } = require('../auth/userStore');
const { generateToken } = require('../auth/tokenStore');

// POST /auth/setup — Create first admin account
// Only works if NO users exist yet
router.post('/setup', async (req, res) => {
  try {
    if (hasUsers()) {
      return res.status(403).json({
        error: 'Setup already complete. Use /auth/signup as admin.'
      });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // First user is always admin with all permissions
    const user = await createUser(username, password, 'admin', ['admin']);
    const token = generateToken(user);

    res.status(201).json({
      message: `Welcome, ${username}! You are the admin.`,
      token,
      user
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /auth/login — Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await validateUser(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = generateToken(user);
    res.json({
      message: `Welcome back, ${username}!`,
      token,
      user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/signup — Admin creates a new user
router.post('/signup', async (req, res) => {
  try {
    const { username, password, permissions = [] } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await createUser(username, password, 'user', permissions);
    res.status(201).json({ message: 'User created', user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /auth/users — List all users (admin only)
router.get('/users', (req, res) => {
  try {
    res.json({ users: listUsers() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /auth/users/:username — Delete user
router.delete('/users/:username', async (req, res) => {
  try {
    deleteUser(req.params.username);
    res.json({ message: `User "${req.params.username}" deleted` });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// PATCH /auth/users/:username/permissions — Update permissions
router.patch('/users/:username/permissions', (req, res) => {
  try {
    const { permissions } = req.body;
    const user = updatePermissions(req.params.username, permissions);
    res.json({ message: 'Permissions updated', user });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;