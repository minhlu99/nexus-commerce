import { check, sleep } from "k6";
import http from "k6/http";
import { Counter, Rate } from "k6/metrics";

// Custom Performance & Integrity Metrics
const successfulOrders = new Counter("successful_orders");
const stockRejections = new Counter("stock_rejections_409");
const deadlocksOrErrors = new Counter("deadlocks_or_errors");
const rate200s = new Rate("rate_successful_checkouts");

export const options = {
  scenarios: {
    flash_sale_spike: {
      executor: "per-vu-iterations",
      vus: 100, // 100 concurrent buyers
      iterations: 1,
      maxDuration: "30s",
    },
  },
  thresholds: {
    deadlocks_or_errors: ["count == 0"], // Must have 0 deadlocks or 500s
    http_req_duration: ["p(95) < 800"], // 95% of checkouts under 800ms
  },
};

const BASE_URL = __ENV.API_URL || "http://localhost:4000";

export function setup() {
  // Query first available product and SKU from catalog
  const res = http.get(`${BASE_URL}/api/products`);
  check(res, { "catalog accessible": (r) => r.status === 200 });

  const products = res.json("data");
  if (!products || products.length === 0) {
    throw new Error("No products found. Please seed database first.");
  }

  const detailRes = http.get(`${BASE_URL}/api/products/${products[0].id}`);
  const detail = detailRes.json("data");

  return {
    storeId: detail.storeId,
    variantId: detail.variants[0].id,
    sku: detail.variants[0].sku,
  };
}

export default function (data) {
  const customerId = `k6_buyer_${__VU}_${__ITER}`;
  const idempotencyKey = `k6-order-${__VU}-${Date.now()}`;

  const payload = JSON.stringify({
    storeId: data.storeId,
    customerId: customerId,
    items: [
      {
        variantId: data.variantId,
        sku: data.sku,
        quantity: 1,
      },
    ],
    shippingAddress: {
      fullName: `K6 Buyer ${__VU}`,
      street: "456 Market St",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      country: "US",
    },
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
  };

  const res = http.post(`${BASE_URL}/api/orders`, payload, params);

  if (res.status === 201) {
    successfulOrders.add(1);
    rate200s.add(1);
  } else if (res.status === 409) {
    stockRejections.add(1);
  } else {
    deadlocksOrErrors.add(1);
  }

  check(res, {
    "is valid response (201 or 409)": (r) => r.status === 201 || r.status === 409,
    "no internal server error (500)": (r) => r.status !== 500,
  });
}
