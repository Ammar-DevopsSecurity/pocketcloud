const express = require('express');
const router = express.Router();
const store = require('../billing/billingStore');

// GET /billing — Get billing summary
router.get('/', (req, res) => {
  try {
    res.json(store.getBillingSummary());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /billing/pricing — Get price list
router.get('/pricing', (req, res) => {
  try {
    res.json({ pricing: store.PRICING });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /billing/reset — Reset billing
router.delete('/reset', (req, res) => {
  try {
    store.resetBilling();
    res.json({ message: 'Billing reset to $0.00' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;