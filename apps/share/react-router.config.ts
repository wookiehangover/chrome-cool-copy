import { vercelPreset } from "@vercel/react-router/vite";
import type { Config } from "@react-router/dev/config";

export default {
  // Enable SSR for server-side rendering
  ssr: true,
  presets: [vercelPreset()],
} satisfies Config;
