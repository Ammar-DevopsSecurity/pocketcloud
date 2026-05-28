const express = require('express');
const router = express.Router();
const store = require('../secrets/secretsStore');

// POST /secrets — Create or update a secret
router.post('/', (req, res) => {
  try {
    const { name, value, description } = req.body;
    if (!name || !value) {
      return res.status(400).json({ error: 'name and value required' });
    }
    const result = store.putSecret(name, value, description);
    res.status(201).json({ message: 'Secret stored securely 🔐', secret: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /secrets — List all secrets (no values!)
router.get('/', (req, res) => {
  try {
    res.json({ secrets: store.listSecrets() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /secrets/:name — Get a secret value
router.get('/:name', (req, res) => {
  try {
    const secret = store.getSecret(req.params.name);
    res.json({ secret });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// PUT /secrets/:name/rotate — Rotate secret value
router.put('/:name/rotate', (req, res) => {
  try {
    const { newValue } = req.body;
    if (!newValue) return res.status(400).json({ error: 'newValue required' });
    const result = store.rotateSecret(req.params.name, newValue);
    res.json({ message: 'Secret rotated!', result });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// DELETE /secrets/:name — Delete a secret
router.delete('/:name', (req, res) => {
  try {
    store.deleteSecret(req.params.name);
    res.json({ message: `Secret "${req.params.name}" deleted` });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;