exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { url } = JSON.parse(event.body);
    if (!url) return { statusCode: 400, body: JSON.stringify({ error: 'URL inválida' }) };

    // ── MODO FICHA PROPIA (JSONBin) ──────────────────────────────
    if (url.includes('rosario-fichas') || url.includes('jsonbin')) {
      const params = new URL(url).searchParams;
      const binId = params.get('id');
      if (!binId) return { statusCode: 400, body: JSON.stringify({ error: 'ID de ficha no encontrado' }) };

      const JSONBIN_KEY = '$2a$10$fkPEWzfTALriuCYyeBvuvO0go4Uc13O/HWwhVaOAIohPjwCov7LQ.';
      const res = await fetch('https://api.jsonbin.io/v3/b/' + binId + '/latest', {
        headers: { 'X-Master-Key': JSONBIN_KEY, 'X-Bin-Meta': 'false' }
      });

      if (!res.ok) return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo leer la ficha' }) };

      const d = await res.json();
      const f = d.features || {};

      let dorm = 0;
      if (f.dormitorios) dorm = parseInt(f.dormitorios) || 0;

      let valor = null;
      if (d.precio) {
        const match = d.precio.replace(/\s/g, '').match(/[\d.]+/);
        if (match) valor = match[0];
      }

      const desc = (d.descripcion || '').toLowerCase();
      const caract = (d.caracteristicas || []).join(' ').toLowerCase();
      const patio = (desc.includes('patio') || desc.includes('terraza') || desc.includes('jardin') ||
                     caract.includes('patio') || caract.includes('terraza')) ? 'Si' : 'No';

      const m2c = parseInt(f.supCubierta) || null;
      const m2t = parseInt(f.supTotal) || m2c;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir: d.direccion || d.titulo || null, dorm, m2c, m2t, patio, ubic: 'Frente', valor })
      };
    }

    // ── MODO ZONAPROP ────────────────────────────────────────────
    if (url.includes('zonaprop')) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 400,
          system: 'Extraés datos de ZonaProp Argentina a partir de la URL. Respondé SOLO JSON: {"dir":"calle numero","dorm":0,"m2c":null,"m2t":null,"patio":"No","ubic":"Frente","valor":null}',
          messages: [{ role: 'user', content: 'Extraé los datos de esta URL: ' + url }]
        })
      });
      const data = await response.json();
      const textBlock = data.content && data.content.find(b => b.type === 'text');
      if (!textBlock) return { statusCode: 500, body: JSON.stringify({ error: 'Sin respuesta' }) };
      const jsonMatch = textBlock.text.trim().match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { statusCode: 500, body: JSON.stringify({ error: 'No se encontró JSON' }) };
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: jsonMatch[0] };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Usá un link de rosario-fichas.netlify.app o zonaprop.com.ar' }) };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
