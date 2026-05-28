const express = require('express');
const router = express.Router();
const store = require('../sns/snsStore');
const publisher = require('../sns/snsPublisher');

// POST /sns/topics — Create topic
router.post('/topics', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Topic name required' });
    const topic = store.createTopic(name);
    res.status(201).json({ message: 'Topic created', topic });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

// GET /sns/topics — List all topics
router.get('/topics', (req, res) => {
  try {
    res.json({ topics: store.listTopics() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /sns/topics/:name — Delete topic
router.delete('/topics/:name', (req, res) => {
  try {
    store.deleteTopic(req.params.name);
    res.json({ message: `Topic "${req.params.name}" deleted` });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// GET /sns/topics/:name — Get topic details + subscriptions
router.get('/topics/:name', (req, res) => {
  try {
    res.json(store.getTopic(req.params.name));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /sns/topics/:name/subscribe — Subscribe to topic
router.post('/topics/:name/subscribe', (req, res) => {
  try {
    const { protocol, endpoint } = req.body;
    if (!protocol || !endpoint) {
      return res.status(400).json({ error: 'protocol and endpoint required' });
    }
    const result = store.subscribe(req.params.name, protocol, endpoint);
    res.status(201).json({ message: 'Subscribed!', subscription: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /sns/topics/:name/subscriptions/:id — Unsubscribe
router.delete('/topics/:name/subscriptions/:id', (req, res) => {
  try {
    store.unsubscribe(req.params.name, req.params.id);
    res.json({ message: 'Unsubscribed' });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /sns/topics/:name/publish — Publish message
router.post('/topics/:name/publish', async (req, res) => {
  try {
    const { message, subject } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });
    const result = await publisher.publish(req.params.name, message, subject);
    res.json({ message: 'Published!', result });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;