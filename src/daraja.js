const https = require('https');

function getDarajaBaseUrl() {
  const env = String(process.env.DARAJA_ENV || 'sandbox').toLowerCase();
  if (env === 'production' || env === 'live') return 'https://api.safaricom.co.ke';
  return 'https://sandbox.safaricom.co.ke';
}

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function httpsJsonRequest({ url, method, headers, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          if (!ok) {
            return reject(
              new Error(
                `Daraja HTTP ${res.statusCode}: ${data || res.statusMessage || 'Request failed'}`
              )
            );
          }
          if (!data) return resolve(null);
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse Daraja JSON response: ${e.message}`));
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

let cachedToken = null;
let cachedTokenExpiresAtMs = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAtMs - 30_000) {
    return cachedToken;
  }

  const consumerKey = requiredEnv('DARAJA_CONSUMER_KEY');
  const consumerSecret = requiredEnv('DARAJA_CONSUMER_SECRET');
  const baseUrl = getDarajaBaseUrl();

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const json = await httpsJsonRequest({
    url: `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
  });

  const token = json?.access_token;
  const expiresIn = Number(json?.expires_in || 0);
  if (!token) throw new Error('Daraja OAuth response missing access_token');

  cachedToken = token;
  cachedTokenExpiresAtMs = Date.now() + (Number.isFinite(expiresIn) ? expiresIn * 1000 : 0);
  return token;
}

async function registerC2BUrls({ shortCode, confirmationUrl, validationUrl, responseType = 'Completed' }) {
  const baseUrl = getDarajaBaseUrl();
  const token = await getAccessToken();

  const payload = JSON.stringify({
    ShortCode: String(shortCode),
    ResponseType: responseType,
    ConfirmationURL: confirmationUrl,
    ValidationURL: validationUrl,
  });

  return await httpsJsonRequest({
    url: `${baseUrl}/mpesa/c2b/v1/registerurl`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
    body: payload,
  });
}

module.exports = {
  getDarajaBaseUrl,
  getAccessToken,
  registerC2BUrls,
};
