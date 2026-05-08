const {
  PAYPAL_API_BASE,
  getAccessToken,
  json,
  methodNotAllowed,
  parseBody,
} = require('./_paypal');

function getCompletedCapture(capture) {
  const units = Array.isArray(capture.purchase_units) ? capture.purchase_units : [];
  for (const unit of units) {
    const captures = unit.payments && Array.isArray(unit.payments.captures)
      ? unit.payments.captures
      : [];
    const completed = captures.find((item) => item.status === 'COMPLETED');
    if (completed) return completed;
    if (captures[0]) return captures[0];
  }
  return null;
}

function normalizeDonor(capture) {
  const payer = capture.payer || {};
  const name = payer.name || {};
  const unit = Array.isArray(capture.purchase_units) ? capture.purchase_units[0] || {} : {};
  const shipping = unit.shipping || {};
  const address = shipping.address || {};
  const payment = getCompletedCapture(capture) || {};
  const amount = payment.amount || {};
  const fullName = [name.given_name, name.surname].filter(Boolean).join(' ');

  return {
    orderId: capture.id || null,
    captureId: payment.id || null,
    status: payment.status || capture.status || null,
    payerId: payer.payer_id || null,
    name: fullName || null,
    givenName: name.given_name || null,
    surname: name.surname || null,
    email: payer.email_address || null,
    amount: amount.value || null,
    currency: amount.currency_code || null,
    shippingName: shipping.name && shipping.name.full_name ? shipping.name.full_name : null,
    mailingAddress: address.address_line_1 ? {
      line1: address.address_line_1 || null,
      line2: address.address_line_2 || null,
      city: address.admin_area_2 || null,
      state: address.admin_area_1 || null,
      postalCode: address.postal_code || null,
      countryCode: address.country_code || null,
    } : null,
    capturedAt: payment.create_time || new Date().toISOString(),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  try {
    const body = parseBody(event);
    const orderID = String(body.orderID || '').trim();
    if (!/^[A-Z0-9]+$/.test(orderID)) {
      return json(400, { error: 'Missing PayPal order ID.' });
    }

    const accessToken = await getAccessToken();
    const response = await fetch(
      `${PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const capture = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json(response.status || 502, {
        error: capture.message || 'PayPal could not capture the order.',
      });
    }

    const donor = normalizeDonor(capture);
    console.info('PayPal donation captured:', {
      orderId: donor.orderId,
      captureId: donor.captureId,
      status: donor.status,
      amount: donor.amount,
      currency: donor.currency,
      email: donor.email,
      mailingAddressPresent: Boolean(donor.mailingAddress),
    });

    return json(200, {
      id: donor.captureId || donor.orderId,
      status: donor.status,
      donor,
    });
  } catch (error) {
    console.error('PayPal capture failed:', error);
    return json(500, { error: 'PayPal checkout is temporarily unavailable.' });
  }
};
