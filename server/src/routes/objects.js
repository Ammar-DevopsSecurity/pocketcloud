const express = require('express');
const router = express.Router({ mergeParams: true }); 
// mergeParams: true allows us to access :bucketName from the parent route

const multer = require('multer');
const path = require('path');
const fileStore = require('../storage/fileStore');

// Multer config — where to temporarily store uploaded files
// We use disk storage so we can move it ourselves
const upload = multer({
  dest: path.join(__dirname, '../../temp'), // temp holding area
  limits: { fileSize: 100 * 1024 * 1024 }  // 100MB max file size
});

// PUT /buckets/:bucketName/objects/:key — Upload a file
// 'file' is the field name expected in the form-data
const { processTriggers } = require('../triggers/triggerEngine');

// PUT /buckets/:bucketName/objects/:key — Upload a file
router.put('/:key', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { bucketName } = req.params;
    const key = req.params.key;
    const mimeType = req.file.mimetype;

    const result = fileStore.saveObject(bucketName, key, req.file.path, mimeType);
    const log = req.app.locals.activityLog;
if (log) {
  log.push({
    type: 'PUT',
    message: `⬆️  Uploaded "${key}" to bucket "${bucketName}"`,
    timestamp: new Date().toISOString()
  });
}
    // 🔥 Fire triggers after successful upload
    const triggerEvent = {
      event: 'PUT',
      bucket: bucketName,
      key,
      mimeType,
      uploadedAt: result.uploadedAt
    };

    processTriggers(triggerEvent).catch(err =>
      console.error('Trigger error:', err)
    );

    res.status(200).json({
      message: 'Object uploaded successfully',
      object: result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /buckets/:bucketName/objects — List all files in a bucket
router.get('/', (req, res) => {
  try {
    const objects = fileStore.listObjects(req.params.bucketName);
    res.json({ objects });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// GET /buckets/:bucketName/objects/:key — Download a file
router.get('/:key', (req, res) => {
  try {
    const filePath = fileStore.getObjectPath(req.params.bucketName, req.params.key);
    // res.sendFile sends the actual file bytes back to the client
    res.sendFile(filePath);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// DELETE /buckets/:bucketName/objects/:key — Delete a file
router.delete('/:key', (req, res) => {
  try {
    fileStore.deleteObject(req.params.bucketName, req.params.key);
    res.json({ message: `Object "${req.params.key}" deleted` });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;