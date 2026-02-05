import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	server: { port: 4000 },
	build: { outDir: "dist" },
});
