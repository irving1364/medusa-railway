import Medusa from "@medusajs/js-sdk"

/** Admin-side SDK: same origin as the dashboard, session cookie auth. */
export const sdk = new Medusa({
  baseUrl: typeof window !== "undefined" ? window.location.origin : "http://localhost:9000",
  debug: false,
  auth: { type: "session" },
})
