import "dotenv/config";
import { startServer } from "./startServer";

startServer({ mode: "production" }).catch(console.error);
