import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { approvedDatasetPlugin } from "./vite.config.ts";

export default defineConfig({
	plugins: [react(), approvedDatasetPlugin()],
	test: {
		environment: "jsdom",
		setupFiles: ["./tests/setup.ts"],
		include: ["tests/**/*.test.{ts,tsx}"],
		testTimeout: 10_000,
		clearMocks: true,
	},
});
