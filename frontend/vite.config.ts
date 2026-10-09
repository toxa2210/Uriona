import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_URL ? new URL(env.VITE_API_URL).origin : "http://localhost:8000";

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      allowedHosts: ["uriona.uz", "www.uriona.uz"],
      proxy: {
        "/api/v1": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
