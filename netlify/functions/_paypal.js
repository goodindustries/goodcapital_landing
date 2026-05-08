const PAYPAL_API_BASE =
  process.env.PAYPAL_API_BASE ||
  (process.env.PAYPAL_ENV === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com');

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function methodNotAllowed() {
  return json(405, { error: 'Method not allowed' });
}

function parseBody(event) {
  if (!event.body) return {};
  return JSON.parse(event.body);
}

function requirePayPalConfig() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing PayPal server configuration.');
  }
}

async function getAccessToken() {
  requirePayPalConfig();

  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || 'Unable to authenticate with PayPal.');
  }

  return data.access_token;
}

function normalizeAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 1 || amount > 100000) return null;
  return (Math.round(amount * 100) / 100).toFixed(2);
}

module.exports = {
  PAYPAL_API_BASE,
  getAccessToken,
  json,
  methodNotAllowed,
  normalizeAmount,
  parseBody,
};
