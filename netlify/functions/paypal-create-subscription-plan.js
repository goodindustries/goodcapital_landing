const {
  PAYPAL_API_BASE,
  getAccessToken,
  json,
  methodNotAllowed,
  normalizeAmount,
  parseBody,
} = require('./_paypal');

const MONTHLY_PRODUCT_ID = 'PROD-TGPLANDINGMONTHLY';
const MONTHLY_PRODUCT_REQUEST_ID = 'tgp-landing-monthly-product';

async function ensureMonthlyProduct(accessToken) {
  const response = await fetch(`${PAYPAL_API_BASE}/v1/catalogs/products`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': MONTHLY_PRODUCT_REQUEST_ID,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      id: MONTHLY_PRODUCT_ID,
      name: 'The Good Project Monthly Giving',
      description: 'Monthly giving for The Good Project landing page',
      type: 'SERVICE',
      category: 'CHARITY',
    }),
  });

  const product = await response.json().catch(() => ({}));
  if (response.ok && product.id) return product.id;

  console.warn('PayPal product ensure warning:', {
    status: response.status,
    message: product.message || product.name || 'unknown',
  });

  return MONTHLY_PRODUCT_ID;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  try {
    const body = parseBody(event);
    const amount = normalizeAmount(body.amount);
    if (!amount) return json(400, { error: 'Enter a valid monthly donation amount.' });

    const accessToken = await getAccessToken();
    const productId = await ensureMonthlyProduct(accessToken);
    const requestId = `tgp-monthly-plan-${amount.replace('.', '-')}`;

    const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/plans`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': requestId,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        product_id: productId,
        name: `The Good Project Monthly ${amount}`,
        description: `Monthly gift of $${amount} to The Good Project`,
        billing_cycles: [
          {
            frequency: {
              interval_unit: 'MONTH',
              interval_count: 1,
            },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: {
                value: amount,
                currency_code: 'USD',
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          payment_failure_threshold: 1,
        },
      }),
    });

    const plan = await response.json().catch(() => ({}));
    if (!response.ok || !plan.id) {
      return json(response.status || 502, {
        error: plan.message || 'PayPal could not create the monthly plan.',
      });
    }

    return json(200, {
      planId: plan.id,
      productId,
      amount,
    });
  } catch (error) {
    console.error('PayPal create subscription plan failed:', error);
    return json(500, { error: 'PayPal monthly checkout is temporarily unavailable.' });
  }
};
