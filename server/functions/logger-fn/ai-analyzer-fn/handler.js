async function handler(event) {
  console.log('🤖 AI Analyzer triggered!');
  console.log('📦 File:', event.key);
  console.log('📂 Bucket:', event.bucket);

  const fs = require('fs');
  const path = require('path');

  // Read file content
  const filePath = path.join('/app/storage', event.bucket, event.key);
  let fileContent = '';

  try {
    if (fs.existsSync(filePath)) {
      fileContent = fs.readFileSync(filePath, 'utf-8');
      console.log(`📄 File loaded (${fileContent.length} chars)`);
    } else {
      fileContent = `filename: ${event.key}`;
    }
  } catch (err) {
    fileContent = `filename: ${event.key}`;
  }

  // Call Ollama running on host machine
  // host.docker.internal = your laptop from inside Docker
  console.log('🤖 Calling Ollama AI...');

  try {
    const response = await fetch('http://host.docker.internal:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        stream: false,
        prompt: `Analyze this file and respond ONLY with a valid JSON object, no markdown, no explanation.

Return exactly this structure:
{
  "summary": "one sentence summary",
  "topics": ["topic1", "topic2", "topic3"],
  "sentiment": "positive or negative or neutral",
  "wordCount": 123,
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "language": "English"
}

File name: ${event.key}
File content: ${fileContent.slice(0, 1500)}`
      })
    });

    const data = await response.json();
    console.log('✅ Ollama responded!');

    let analysis;
    try {
      // Extract JSON from response
      const text = data.response;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: text };
    } catch {
      analysis = { summary: data.response, topics: [], tags: [] };
    }

    console.log('📊 Analysis:', JSON.stringify(analysis, null, 2));

    return {
      success: true,
      file: event.key,
      bucket: event.bucket,
      engine: 'ollama/llama3.2',
      analysis,
      analyzedAt: new Date().toISOString()
    };

  } catch (err) {
    console.error('❌ Ollama error:', err.message);

    // Fallback to demo mode if Ollama isn't running
    console.log('⚠️ Falling back to demo mode...');
    return {
      success: true,
      file: event.key,
      bucket: event.bucket,
      engine: 'demo',
      analysis: {
        summary: `File "${event.key}" uploaded to bucket "${event.bucket}".`,
        topics: ['cloud storage', 'file processing', 'automation'],
        sentiment: 'neutral',
        wordCount: Math.floor(Math.random() * 500) + 50,
        tags: ['pocketcloud', 'uploaded', event.bucket, 'local-cloud', 'automated'],
        language: 'English'
      },
      analyzedAt: new Date().toISOString()
    };
  }
}

module.exports = { handler };