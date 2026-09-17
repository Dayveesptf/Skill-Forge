import app from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { startScheduledReportWorker } from "./modules/infrastructure/automation.worker";

async function startServer() {
  await connectDB();

  app.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
    startScheduledReportWorker();
  });
}

startServer().catch(error => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
