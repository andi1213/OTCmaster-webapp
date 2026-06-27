exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const API_KEY = process.env.OPENAI_API_KEY;
  if (!API_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'API Key가 설정되지 않았습니다.' }) };

  const { model, messages, systemPrompt, mode } = JSON.parse(event.body);
  const msgs = [];
  if (systemPrompt) msgs.push({ role: 'system', content: systemPrompt });
  msgs.push(...messages);

  const isEval = mode === 'evaluate';

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: msgs,
        temperature: isEval ? 0.3 : 0.8,
        max_tokens: isEval ? 3000 : 2000
      })
    });
    const data = await res.json();
    if (data.error) return { statusCode: 400, body: JSON.stringify({ error: data.error.message }) };
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: data.choices[0].message.content })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
