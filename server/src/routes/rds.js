const express = require('express');
const router = express.Router();
const engine = require('../rds/rdsEngine');
const store = require('../rds/rdsStore');

// POST /rds/instances — Create new instance
router.post('/instances', async (req, res) => {
  try {
    const { dbName, username, password } = req.body;
    if (!dbName || !username || !password) {
      return res.status(400).json({ error: 'dbName, username and password required' });
    }

    // Start creation in background
    res.status(202).json({
      message: 'RDS instance creation started. This takes 20-30 seconds.',
      hint: 'Poll GET /rds/instances to check status'
    });

    // Actually create it async
    engine.createRdsInstance(dbName, username, password).catch(err => {
      console.error('RDS creation failed:', err.message);
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /rds/instances — List instances
router.get('/instances', (req, res) => {
  try {
    res.json({ instances: store.listInstances() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /rds/instances/:id — Get instance details
router.get('/instances/:id', (req, res) => {
  try {
    res.json(store.getInstance(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /rds/instances/:id/query — Execute SQL
router.post('/instances/:id/query', async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: 'sql required' });

    const result = await engine.executeQuery(req.params.id, sql);
    res.json({ result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /rds/instances/:id — Delete instance
router.delete('/instances/:id', async (req, res) => {
  try {
    await engine.deleteRdsInstance(req.params.id);
    res.json({ message: 'Instance deleted' });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;