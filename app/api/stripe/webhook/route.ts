import { orderApiCopy } from "@/content/email-copy";
import { commerceConfig, inquiryConfig, siteConfig } from "@/content/site-config";
import {
  formatStripeAddress,
  formatStripeTotal,
  getCheckoutOrderItems,
  getShippingDetails,
  getStripeDashboardOrderUrl,
  markFulfillmentEmailSent,
  retrieveCheckoutSession,
} from "@/lib/stripe";
import { verifyStripeWebhookSignature } from "@/lib/stripe-signature.mjs";

type StripeEvent = {
  id?: string;
  type?: string;
  data?: { object?: { id?: string } };
};

type FulfillmentEventType = (typeof commerceConfig.stripeFulfillmentEventTypes)[number];

function isFulfillmentEventType(type: string): type is FulfillmentEventType {
  return commerceConfig.stripeFulfillmentEventTypes.includes(type as FulfillmentEventType);
}

async function sendOrderEmail(apiKey: string, idempotencyKey: string, message: Record<string, unknown>) {
  return fetch(inquiryConfig.resendApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(message),
  });
}

export async function POST(request: Request) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!stripeSecret || !webhookSecret || !resendApiKey) {
    return Response.json({ error: orderApiCopy.notConfigured }, { status: 503 });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const signatureIsValid = await verifyStripeWebhookSignature(
    payload,
    signature,
    webhookSecret,
    commerceConfig.stripeWebhookToleranceSeconds,
  );
  if (!signatureIsValid) return Response.json({ error: orderApiCopy.invalidSignature }, { status: 400 });

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return Response.json({ error: orderApiCopy.invalidEvent }, { status: 400 });
  }

  if (!event.type || !isFulfillmentEventType(event.type)) {
    return Response.json({ received: true });
  }

  const sessionId = event.data?.object?.id;
  if (!sessionId) return Response.json({ error: orderApiCopy.invalidEvent }, { status: 400 });
  const session = await retrieveCheckoutSession(sessionId, stripeSecret);
  if (!session) return Response.json({ error: orderApiCopy.unavailableOrder }, { status: 502 });
  if (session.metadata?.[commerceConfig.checkoutSiteMetadataKey] !== siteConfig.brandName) {
    return Response.json({ received: true });
  }
  if (session.payment_status !== "paid") return Response.json({ received: true });
  if (session.metadata?.[commerceConfig.fulfillmentMetadataKey] === "true") {
    return Response.json({ received: true, fulfilled: true });
  }

  const items = getCheckoutOrderItems(session);
  if (items.length === 0) return Response.json({ error: orderApiCopy.invalidOrder }, { status: 422 });

  const shipping = getShippingDetails(session);
  const customerEmail = session.customer_details?.email?.trim() ?? "";
  const customerName = shipping?.name?.trim() || session.customer_details?.name?.trim() || "Customer";
  const owner = process.env.ORDER_TO ?? process.env.INQUIRY_TO ?? siteConfig.email;
  const sender = process.env.RESEND_FROM ?? inquiryConfig.defaultSender;
  const orderReference = session.id.slice(-10).toUpperCase();
  const data = {
    customerName,
    customerEmail: customerEmail || "Not provided",
    shippingAddress: formatStripeAddress(shipping?.address),
    items,
    total: formatStripeTotal(session),
    orderReference,
    dashboardUrl: getStripeDashboardOrderUrl(session),
  };
  const messages = [
    {
      key: `stripe-order-owner-${session.id}`,
      message: {
        from: sender,
        to: [owner],
        reply_to: customerEmail || owner,
        subject: orderApiCopy.ownerSubject(data),
        html: orderApiCopy.ownerHtml(data),
      },
    },
    ...(customerEmail ? [{
      key: `stripe-order-customer-${session.id}`,
      message: {
        from: sender,
        to: [customerEmail],
        reply_to: owner,
        subject: orderApiCopy.customerSubject(data),
        html: orderApiCopy.customerHtml(data),
      },
    }] : []),
  ];

  const emailResults = await Promise.all(messages.map(({ key, message }) => sendOrderEmail(resendApiKey, key, message)));
  if (emailResults.some((result) => !result.ok)) {
    return Response.json({ error: orderApiCopy.deliveryError }, { status: 502 });
  }
  if (!await markFulfillmentEmailSent(session.id, stripeSecret)) {
    return Response.json({ error: orderApiCopy.updateError }, { status: 502 });
  }
  return Response.json({ received: true, fulfilled: true });
}
