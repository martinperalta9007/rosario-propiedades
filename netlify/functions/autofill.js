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
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        body: JSON.stringify({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 800,
  system: `Extraés datos de propiedades de ZonaProp Argentina a partir de la URL. 
La URL contiene información en el slug. Por ejemplo:
- "callao-al-1300-venta-departamento-1-dormitorio" → dir: "Callao 1300", dorm: 1
- "monoambiente-en-venta-rosario" → dorm: 0
- "departamento-2-dormitorios" → dorm: 2
Respondé SOLO con el objeto JSON sin texto adicional:
{"dir":"calle número","dorm":0,"m2c":null,"m2t":null,"patio":"No","ubic":"Frente","valor":null}
dorm: 0=mono,1-4=dorms,"Of."=oficina. ubic: Frente/Interno/Contrafrente/Dúplex/Casa/Reciclado. valor: null si no está en la URL. SOLO JSON, nada más.`,
  messages: [{ role: 'user', content: `Extraé los datos de esta URL: ${url}` }]
})
{"dir":"calle número","dorm":0,"m2c":40,"m2t":45,"patio":"Sí","ubic":"Frente","valor":"55.000"}
dorm: 0=mono,1-4=dorms,"Of."=oficina. patio: "Sí" si tiene patio/terraza/jardín, sino "No". ubic: Frente/Interno/Contrafrente/Dúplex/Casa/Reciclado. valor: número con punto como miles. Si no encontrás un dato ponés null. IMPORTANTE: respondé ÚNICAMENTE el JSON, nada más.`,
        messages: [{ role: 'user', content: `Buscá en Google esta URL de ZonaProp y extraé los datos del inmueble: ${url} . Buscá el número de clasificado que aparece en la URL para encontrar la publicación exacta.` }]
      })
    });

    const data = await response.json();
    const textBlock = data.content && data.content.find(b => b.type === 'text');
    if (!textBlock) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Sin respuesta de texto' }) };
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
