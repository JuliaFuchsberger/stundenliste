const https = require('https');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  // Empfänger der Stundenlisten – in Netlify als Environment Variable änderbar
  const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL || 'julia.fuchsberger@chaka2.com';
  // Verifizierter Absender bei SendGrid
  const FROM_EMAIL = process.env.FROM_EMAIL || 'julia.fuchsberger@chaka2.com';

  if (!SENDGRID_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'SENDGRID_API_KEY nicht konfiguriert' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ungültiges JSON' }) };
  }

  const { pdfBase64, filename, subject, senderName, monthYear, totalHours } = body;

  if (!pdfBase64 || !filename || !subject) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Fehlende Parameter' }) };
  }

  const payload = JSON.stringify({
    personalizations: [{ to: [{ email: RECIPIENT_EMAIL }] }],
    from: { email: FROM_EMAIL, name: 'Stundenliste Chaka2' },
    subject: subject,
    content: [{
      type: 'text/html',
      value: `
        <div style="font-family:Arial,sans-serif;max-width:500px;color:#1a1a1a">
          <h2 style="margin-bottom:8px">Stundenliste eingegangen</h2>
          <p style="color:#666;margin-bottom:16px">${monthYear}</p>
          <table style="border-collapse:collapse;width:100%;margin-bottom:20px">
            <tr>
              <td style="padding:8px 12px;background:#f5f5f3;color:#888;font-size:13px">Promotor/in</td>
              <td style="padding:8px 12px;background:#f5f5f3;font-weight:600">${senderName}</td>
            </tr>
            <tr><td colspan="2" style="padding:4px"></td></tr>
            <tr>
              <td style="padding:8px 12px;background:#f5f5f3;color:#888;font-size:13px">Gesamtstunden</td>
              <td style="padding:8px 12px;background:#f5f5f3;font-weight:600">${totalHours}</td>
            </tr>
          </table>
          <p style="font-size:13px;color:#888">Die unterschriebene Stundenliste ist als PDF angehängt.</p>
        </div>
      `
    }],
    attachments: [{
      content: pdfBase64,
      filename: filename,
      type: 'application/pdf',
      disposition: 'attachment'
    }]
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.sendgrid.com',
      path: '/v3/mail/send',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SENDGRID_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: 200, body: JSON.stringify({ ok: true }) });
        } else {
          resolve({ statusCode: res.statusCode, body: JSON.stringify({ error: data }) });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) });
    });

    req.write(payload);
    req.end();
  });
};
