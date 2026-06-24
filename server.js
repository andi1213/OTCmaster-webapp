const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/chat', async (req, res) => {
  const { apiKey, model, messages, systemPrompt } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'API 키가 설정되지 않았습니다.' });
  const msgs = [];
  if (systemPrompt) msgs.push({ role: 'system', content: systemPrompt });
  msgs.push(...messages);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: model || 'gpt-4o-mini', messages: msgs, temperature: 0.8, max_tokens: 2000 })
    });
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json({ content: data.choices[0].message.content });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/evaluate', async (req, res) => {
  const { apiKey, model, messages, systemPrompt } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'API 키가 설정되지 않았습니다.' });
  const msgs = [];
  if (systemPrompt) msgs.push({ role: 'system', content: systemPrompt });
  msgs.push(...messages);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: model || 'gpt-4o-mini', messages: msgs, temperature: 0.3, max_tokens: 3000 })
    });
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json({ content: data.choices[0].message.content });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`OTC Master running at http://localhost:${PORT}`));
