exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { url } = JSON.parse(event.body);
    if (!url || !url.includes('zonaprop')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'URL inválida' }) };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: 'Extraés datos de propiedades de ZonaProp Argentina a partir de la URL. La URL contiene información en el slug. Por ejemplo: callao-al-1300 significa Callao 1300, monoambiente significa dorm 0, 1-dormitorio significa dorm 1. Respondé SOLO con JSON sin texto adicional: {"dir":"calle numero","dorm":0,"m2c":null,"m2t":null,"patio":"No","ubic":"Frente","valor":null}',
        messages: [{ role: 'user', content: 'Extraé los datos de esta URL: ' + url }]
      })
    });

    const data = await response.json();
    const textBlock = data.content && data.content.find(b => b.type === 'text');
    if (!textBlock) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Sin respuesta' }) };
    }

    const text = textBlock.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { statusCode: 500, body: JSON.stringify({ error: 'No se encontró JSON' }) };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed)
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
