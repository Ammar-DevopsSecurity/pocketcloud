const fs = require('fs');
const path = require('path');

// This is the root folder where all buckets and files will be stored
// __dirname means "the folder where THIS file lives"
// We go up two levels (../../) to reach server/, then into 'storage'
const STORAGE_ROOT = path.join(__dirname, '../../storage');

// Make sure the storage root folder exists when the app starts
// { recursive: true } means "don't crash if it already exists"
if (!fs.existsSync(STORAGE_ROOT)) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

// CREATE a bucket (just creates a folder on disk)
function createBucket(bucketName) {
  const bucketPath = path.join(STORAGE_ROOT, bucketName);

  if (fs.existsSync(bucketPath)) {
    throw new Error(`Bucket "${bucketName}" already exists`);
  }

  fs.mkdirSync(bucketPath, { recursive: true });
  return { name: bucketName, createdAt: new Date().toISOString() };
}

// LIST all buckets (just lists all folders inside storage/)
function listBuckets() {
  const items = fs.readdirSync(STORAGE_ROOT, { withFileTypes: true });
  // withFileTypes gives us info about each item (is it a file or folder?)
  return items
    .filter(item => item.isDirectory()) // only folders = buckets
    .map(item => ({ name: item.name }));
}

// DELETE a bucket folder and everything inside it
function deleteBucket(bucketName) {
  const bucketPath = path.join(STORAGE_ROOT, bucketName);

  if (!fs.existsSync(bucketPath)) {
    throw new Error(`Bucket "${bucketName}" not found`);
  }

  fs.rmSync(bucketPath, { recursive: true, force: true });
}

// SAVE a file into a bucket
function saveObject(bucketName, key, filePath, mimeType) {
  const bucketPath = path.join(STORAGE_ROOT, bucketName);

  if (!fs.existsSync(bucketPath)) {
    throw new Error(`Bucket "${bucketName}" not found`);
  }

  const destPath = path.join(bucketPath, key);

  // Move the uploaded file from temp location to our bucket folder
  // Copy then delete (rename fails across Docker filesystems)
  fs.copyFileSync(filePath, destPath);
  fs.unlinkSync(filePath);

  return {
    key,
    bucket: bucketName,
    mimeType,
    uploadedAt: new Date().toISOString()
  };
}

// GET the full path of a file (so we can send it back to client)
function getObjectPath(bucketName, key) {
  const filePath = path.join(STORAGE_ROOT, bucketName, key);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Object "${key}" not found in bucket "${bucketName}"`);
  }

  return filePath;
}

// LIST all files inside a bucket
function listObjects(bucketName) {
  const bucketPath = path.join(STORAGE_ROOT, bucketName);

  if (!fs.existsSync(bucketPath)) {
    throw new Error(`Bucket "${bucketName}" not found`);
  }

  const files = fs.readdirSync(bucketPath, { withFileTypes: true });
  return files
    .filter(item => item.isFile()) // only files, not subfolders
    .map(item => ({
      key: item.name,
      bucket: bucketName
    }));
}

// DELETE a specific file from a bucket
function deleteObject(bucketName, key) {
  const filePath = path.join(STORAGE_ROOT, bucketName, key);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Object "${key}" not found in bucket "${bucketName}"`);
  }

  fs.unlinkSync(filePath); // unlinkSync = delete a file
}

// Export all functions so other files can use them
module.exports = {
  createBucket,
  listBuckets,
  deleteBucket,
  saveObject,
  getObjectPath,
  listObjects,
  deleteObject
};