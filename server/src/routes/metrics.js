const express = require('express');
const router = express.Router();
const store = require('../metrics/metricsStore');

// GET /metrics — Get all metrics
router.get('/', (req, res) => {
  try {
    res.json(store.getMetrics());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /metrics — Reset metrics
router.delete('/', (req, res) => {
  try {
    store.resetMetrics();
    res.json({ message: 'Metrics reset' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;