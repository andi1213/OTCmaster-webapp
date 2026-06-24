const express = require('express');
const router = express.Router();

router.post('/chat', async (req, res) => {
  try {
    const { apiKey, model, messages, systemPrompt } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'API key required' });

    const body = {
      model: model || 'gpt-4o-mini',
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...messages
      ]
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
