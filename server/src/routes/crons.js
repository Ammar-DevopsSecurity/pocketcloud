const express = require('express');
const router = express.Router();
const scheduler = require('../cron/scheduler');

// POST /crons — Create cron job
router.post('/', (req, res) => {
  try {
    const { name, schedule, functionName, payload } = req.body;
    if (!name || !schedule || !functionName) {
      return res.status(400).json({
        error: 'name, schedule and functionName are required'
      });
    }
    const result = scheduler.createCronJob(name, schedule, functionName, payload);
    res.status(201).json({ message: 'Cron job created', cron: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /crons — List all cron jobs
router.get('/', (req, res) => {
  try {
    res.json({ crons: scheduler.listCronJobs() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /crons/:name — Delete cron job
router.delete('/:name', (req, res) => {
  try {
    scheduler.deleteCronJob(req.params.name);
    res.json({ message: `Cron "${req.params.name}" deleted` });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// PATCH /crons/:name/toggle — Enable or disable
router.patch('/:name/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    const result = scheduler.toggleCronJob(req.params.name, enabled);
    res.json({ message: `Cron "${req.params.name}" updated`, cron: result });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;
