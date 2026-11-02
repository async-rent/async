import { createAsync } from "@async-rent/core";
import { createPayPalAdapter } from "@async-rent/payment";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

// Composes core with the payment providers this Worker's secrets configure.
function composeAsync(env: CloudflareBindings) {
  const db = drizzle(env.DATABASE);
  const paypal = createPayPalAdapter({
    clientId: env.PAYPAL_CLIENT_ID,
    clientSecret: env.PAYPAL_CLIENT_SECRET,
    // Sandbox until a deployment is ready to take real money.
    environment: "sandbox",
  });

  return createAsync({ db, paymentProviders: { paypal } });
}

// Charges every rental whose next week is due. A plan that fails is listed in
// the log and picked up again by a later run; only failing to load the plans
// fails the whole run.
async function runWeeklyBilling(env: CloudflareBindings, scheduledTime: number): Promise<void> {
  const async = composeAsync(env);
  const run = await async.billing.runDueBilling({ now: new Date(scheduledTime).toISOString() });
  if (!run.success) throw new Error(run.error.message, { cause: run.error.cause });

  console.log(JSON.stringify({ event: "weekly_billing", results: run.data.results }));
}

export default {
  fetch: app.fetch,
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runWeeklyBilling(env, controller.scheduledTime));
  },
} satisfies ExportedHandler<CloudflareBindings>;
