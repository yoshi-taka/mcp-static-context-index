import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  output: "static",
  site: "https://mcpindex.veritycost.com",
  integrations: [sitemap()],
  server: {
    port: 3001,
  },
});
