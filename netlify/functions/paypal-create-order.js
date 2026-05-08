const {
  PAYPAL_API_BASE,
  getAccessToken,
  json,
  methodNotAllowed,
  normalizeAmount,
  parseBody,
} = require('./_paypal');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  try {
    const body = parseBody(event);
    const amount = normalizeAmount(body.amount);
    if (!amount) return json(400, { error: 'Enter a valid donation amount.' });

    const accessToken = await getAccessToken();
    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            description: 'The Good Project donation',
            custom_id: 'tgp-landing-donation',
            amount: {
              currency_code: 'USD',
              value: amount,
            },
          },
        ],
        application_context: {
          brand_name: 'TGP Landing',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
        },
      }),
    });

    const order = await response.json().catch(() => ({}));
    if (!response.ok || !order.id) {
      return json(response.status || 502, {
        error: order.message || 'PayPal could not create the order.',
      });
    }

    return json(200, { id: order.id });
  } catch (error) {
    console.error('PayPal create order failed:', error);
    return json(500, { error: 'PayPal checkout is temporarily unavailable.' });
  }
};
