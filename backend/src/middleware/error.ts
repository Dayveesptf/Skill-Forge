import { NextFunction, Request, Response } from "express";

export function errorHandler(
  error: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(error);

  if (error?.name === "ZodError") {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.issues
    });
    return;
  }

  if (error?.code === 11000) {
    res.status(409).json({
      success: false,
      message: "A record with one of these unique fields already exists"
    });
    return;
  }

  res.status(error?.statusCode || 500).json({
    success: false,
    message: error?.statusCode ? error.message : "Internal server error"
  });
}
