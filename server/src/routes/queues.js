const express = require('express');
const router = express.Router();
const queueStore = require('../queues/queueStore');

// POST /queues/:name — Create queue
router.post('/:name', (req, res) => {
  try {
    const result = queueStore.createQueue(req.params.name, req.body);
    res.status(201).json({ message: 'Queue created', queue: result });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});
// GET /queues — List all queues
router.get('/', (req, res) => {
  try {
    res.json({ queues: queueStore.listQueues() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /queues/:name/stats — Queue stats
router.get('/:name/stats', (req, res) => {
  try {
    res.json(queueStore.getQueueStats(req.params.name));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /queues/:name/messages — Send message
router.post('/:name/messages', (req, res) => {
  try {
    const { body, delaySeconds } = req.body;
    if (!body) return res.status(400).json({ error: 'Message body is required' });

    const result = queueStore.sendMessage(req.params.name, body, { delaySeconds });
    res.status(201).json({ message: 'Message sent', ...result });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// GET /queues/:name/messages — Receive messages
router.get('/:name/messages', (req, res) => {
  try {
    const max = parseInt(req.query.max) || 1;
    const messages = queueStore.receiveMessages(req.params.name, max);
    res.json({ messages, count: messages.length });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// DELETE /queues/:name/messages/:receiptHandle — Delete after processing
router.delete('/:name/messages/:receiptHandle', (req, res) => {
  try {
    queueStore.deleteMessage(req.params.name, req.params.receiptHandle);
    res.json({ message: 'Message deleted successfully' });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// DELETE /queues/:name — Delete queue
router.delete('/:name', (req, res) => {
  try {
    queueStore.deleteQueue(req.params.name);
    res.json({ message: `Queue "${req.params.name}" deleted` });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;