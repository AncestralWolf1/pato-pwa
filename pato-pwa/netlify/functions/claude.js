exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const API_KEY = process.env.GROQ_API_KEY;
  if (!API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key não configurada' }) };
  }

  try {
    // Recebe o body no formato Anthropic, converte pra OpenAI/Groq
    const body = JSON.parse(event.body);

    // Monta messages no formato OpenAI
    const messages = [];
    if (body.system) {
      messages.push({ role: 'system', content: body.system });
    }
    for (const msg of body.messages) {
      // Suporte a content array (imagem + texto) — Groq aceita só texto, descarta imagens
      if (Array.isArray(msg.content)) {
        const text = msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
        messages.push({ role: msg.role, content: text });
      } else {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    const groqBody = {
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: body.max_tokens || 500,
      temperature: 0.7,
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(groqBody),
    });

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: data }) };
    }

    // Converte resposta Groq de volta pro formato Anthropic que o app espera
    const text = data.choices?.[0]?.message?.content || '';
    const anthropicFormat = {
      content: [{ type: 'text', text }]
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(anthropicFormat),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
