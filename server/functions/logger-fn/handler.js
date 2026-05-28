// This function receives an "event" object — just like AWS Lambda
// It contains info about what file was uploaded and where
function handler(event) {
  console.log('⚡ Function triggered!');
  console.log('📦 Bucket:', event.bucket);
  console.log('🗂️  File:', event.key);
  console.log('📅 At:', event.uploadedAt);
  console.log('📋 MimeType:', event.mimeType);

  return {
    success: true,
    message: `Processed file "${event.key}" from bucket "${event.bucket}"`
  };
}

module.exports = { handler };