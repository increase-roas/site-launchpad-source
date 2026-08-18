import "dotenv/config";
import { startServer } from "./startServer";
import { setupVite } from "./vite";

startServer({
  mode: "development",
  setupDevelopmentServer: setupVite,
}).catch(console.error);
