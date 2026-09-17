import mongoose from "mongoose";
import { env } from "./env";

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(env.mongodbUri);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
}
