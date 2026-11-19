import { defineConfig, loadEnv, type Plugin, type Connect } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { createTrafficHandler } from "./server/traffic-api.mjs";

function passengerApi(env: Record<string, string | undefined>): Plugin {
  const handler = createTrafficHandler({ env });
  const install = (server: { middlewares: Connect.Server }) => {
    server.middlewares.use((req, res, next) => {
      const pathname = new URL(req.url || "/", "http://localhost").pathname;
      if (pathname === "/api/traffic-data" || pathname.startsWith("/api/index.php")) {
        void handler(req, res);
      } else next();
    });
  };
  return { name: "passenger-api", configureServer: install, configurePreviewServer: install };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger(), passengerApi({
    ...loadEnv(mode, process.cwd(), "LRT_"), ...process.env,
  })].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
