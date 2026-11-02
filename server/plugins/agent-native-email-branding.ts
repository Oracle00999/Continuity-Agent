import { defineAppConfig } from "@agent-native/core/server";

export default defineAppConfig({
  agent: {
    engine: "ai-sdk:openai",
    model: "gpt-5-mini",
  },
  app: {
    // This name appears in transactional emails. Change it to your product name.
    name: "Continuity",
    // The source template keeps a renamed app from inheriting first-party email branding.
    sourceTemplate: "chat",
    // Keep the template's authenticated entry explicit after renaming the app.
    homePath: "/overview",
    // Optional: use your own absolute HTTPS logo URL in transactional emails.
    // logoUrl: "https://example.com/logo.png",
  },
});
