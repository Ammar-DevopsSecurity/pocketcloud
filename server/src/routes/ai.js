const express = require('express');
const router = express.Router();

const OLLAMA_URL = 'http://host.docker.internal:11434';

// GET /ai/status — Check if Ollama is running
router.get('/status', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await response.json();
    const hasLlama = data.models?.some(m => m.name.includes('llama3.2'));
    res.json({
      running: true,
      model: hasLlama ? 'llama3.2' : 'unknown',
      models: data.models?.map(m => m.name) || []
    });
  } catch {
    res.json({ running: false });
  }
});

// POST /ai/analyze — Analyze text directly
router.post('/analyze', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        stream: false,
        prompt: `Analyze this text and respond ONLY with valid JSON, no markdown:

{
  "summary": "one sentence summary",
  "topics": ["topic1", "topic2", "topic3"],
  "sentiment": "positive or negative or neutral",
  "wordCount": 123,
  "tags": ["tag1", "tag2", "tag3"],
  "language": "English"
}

Text: ${text.slice(0, 2000)}`
      })
    });

    const data = await response.json();
    let analysis;
    try {
      const jsonMatch = data.response.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: data.response, topics: [], tags: [], sentiment: 'neutral', wordCount: 0 };
    } catch {
      analysis = { summary: data.response, topics: [], tags: [], sentiment: 'neutral', wordCount: 0 };
    }

    res.json({ analysis, engine: 'ollama/llama3.2' });
  } catch (err) {
    // Fallback demo mode
    res.json({
      analysis: {
        summary: 'AI analysis (demo mode — start Ollama for real analysis)',
        topics: ['text', 'content', 'analysis'],
        sentiment: 'neutral',
        wordCount: req.body.text?.split(' ').length || 0,
        tags: ['demo', 'pocketcloud', 'ai'],
        language: 'English'
      },
      engine: 'demo'
    });
  }
});

module.exports = router;