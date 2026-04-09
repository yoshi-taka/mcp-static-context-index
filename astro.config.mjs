import { defineConfig } from "astro/config";
import partytown from "@astrojs/partytown";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  output: "static",
  site: "https://mcpindex.veritycost.com",
  integrations: [sitemap(), partytown({ config: { forward: ["dataLayer.push"] } })],
  server: {
    port: 3001,
  },
});
