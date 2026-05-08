const {
  PAYPAL_API_BASE,
  getAccessToken,
  json,
  methodNotAllowed,
  parseBody,
} = require('./_paypal');

function normalizeSubscriber(subscription) {
  const subscriber = subscription.subscriber || {};
  const name = subscriber.name || {};
  const shipping = subscriber.shipping_address || {};
  const address = shipping.address || {};
  const fullName = [name.given_name, name.surname].filter(Boolean).join(' ');

  return {
    subscriptionId: subscription.id || null,
    planId: subscription.plan_id || null,
    status: subscription.status || null,
    payerId: subscriber.payer_id || null,
    name: fullName || null,
    givenName: name.given_name || null,
    surname: name.surname || null,
    email: subscriber.email_address || null,
    shippingName: shipping.name && shipping.name.full_name ? shipping.name.full_name : null,
    mailingAddress: address.address_line_1 ? {
      line1: address.address_line_1 || null,
      line2: address.address_line_2 || null,
      city: address.admin_area_2 || null,
      state: address.admin_area_1 || null,
      postalCode: address.postal_code || null,
      countryCode: address.country_code || null,
    } : null,
    capturedAt: subscription.status_update_time || subscription.create_time || new Date().toISOString(),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  try {
    const body = parseBody(event);
    const subscriptionID = String(body.subscriptionID || '').trim();
    if (!/^I-[A-Z0-9]+$/i.test(subscriptionID)) {
      return json(400, { error: 'Missing PayPal subscription ID.' });
    }

    const accessToken = await getAccessToken();
    const response = await fetch(
      `${PAYPAL_API_BASE}/v1/billing/subscriptions/${encodeURIComponent(subscriptionID)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    const subscription = await response.json().catch(() => ({}));
    if (!response.ok || !subscription.id) {
      return json(response.status || 502, {
        error: subscription.message || 'PayPal could not load the subscription.',
      });
    }

    const donor = normalizeSubscriber(subscription);
    console.info('PayPal monthly donation captured:', {
      subscriptionId: donor.subscriptionId,
      planId: donor.planId,
      status: donor.status,
      email: donor.email,
      mailingAddressPresent: Boolean(donor.mailingAddress),
    });

    return json(200, {
      id: donor.subscriptionId,
      status: donor.status,
      donor,
    });
  } catch (error) {
    console.error('PayPal capture subscription failed:', error);
    return json(500, { error: 'PayPal monthly checkout is temporarily unavailable.' });
  }
};
