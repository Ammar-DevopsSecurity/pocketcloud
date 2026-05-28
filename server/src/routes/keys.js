const express = require('express');
const router = express.Router();
const { generateKey, listKeys, deleteKey } = require('../auth/keyStore');

// POST /keys — Generate a new API key
router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const key = generateKey(name);
    res.status(201).json({
      message: 'API key created! Save this — it won\'t be shown again.',
      key
    });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

// GET /keys — List all keys
router.get('/', (req, res) => {
  const keys = listKeys();
  res.json({ keys });
});

// DELETE /keys/:id — Delete a key
router.delete('/:id', (req, res) => {
  try {
    deleteKey(req.params.id);
    res.json({ message: 'Key deleted' });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;