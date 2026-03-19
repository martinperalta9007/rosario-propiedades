exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { url } = JSON.parse(event.body);
    if (!url || !url.includes('zonaprop')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'URL inválida' }) };
    }

    // Leer la página de ZonaProp directamente
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const html = await pageRes.text();
    // Extraer solo el texto relevante del HTML (primeros 8000 caracteres)
    const clean = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                      .replace(/<style[\s\S]*?<\/style>/gi, '')
                      .replace(/<[^>]+>/g, ' ')
                      .replace(/\s+/g, ' ')
                      .slice(0, 8000);

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
        system: 'Extraés datos de propiedades inmobiliarias del texto de una página de ZonaProp Argentina. Respondé SOLO con JSON sin texto adicional: {"dir":"calle numero","dorm":0,"m2c":40,"m2t":45,"patio":"No","ubic":"Frente","valor":"55.000"}. dorm: 0=monoambiente,1-4=dormitorios,"Of."=oficina. patio: "Sí" si menciona patio/terraza/jardín, sino "No". ubic: Frente/Interno/Contrafrente/Dúplex/Casa/Reciclado. valor: solo número con punto como separador de miles. null si no encontrás el dato.',
        messages: [{ role: 'user', content: 'Extraé los datos de esta propiedad:\n' + clean }]
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
