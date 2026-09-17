import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import type { Request } from "express";

import { env } from "./config/env";
import routes from "./routes";
import { errorHandler } from "./middleware/error";

const app = express();

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
  })
);

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true
  })
);

app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
    }
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb"
  })
);

app.use(cookieParser());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message:
        "Too many requests. Please try again later."
    }
  })
);

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "SkillForge API"
  });
});

app.use("/api", routes);

app.use(errorHandler);

export default app;