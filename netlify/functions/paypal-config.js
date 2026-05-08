const { json, methodNotAllowed } = require('./_paypal');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'GET') return methodNotAllowed();

  const clientId = process.env.PAYPAL_CLIENT_ID;
  if (!clientId) {
    return json(500, { error: 'Missing PayPal client configuration.' });
  }

  return json(200, {
    clientId,
    environment: process.env.PAYPAL_ENV === 'sandbox' ? 'sandbox' : 'live',
  });
};
