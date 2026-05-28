const express = require('express');
const router = express.Router();
const fileStore = require('../storage/fileStore');

// POST /buckets/:name — Create a new bucket
// :name is a URL parameter, like /buckets/my-photos
router.post('/:name', (req, res) => {
  try {
    const result = fileStore.createBucket(req.params.name);
    res.status(201).json({
      message: 'Bucket created successfully',
      bucket: result
    });
  } catch (err) {
    // If bucket already exists, send 409 Conflict
    res.status(409).json({ error: err.message });
  }
});

// GET /buckets — List all buckets
router.get('/', (req, res) => {
  try {
    const buckets = fileStore.listBuckets();
    res.json({ buckets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /buckets/:name — Delete a bucket
router.delete('/:name', (req, res) => {
  try {
    fileStore.deleteBucket(req.params.name);
    res.json({ message: `Bucket "${req.params.name}" deleted` });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;