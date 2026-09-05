import { Request, Response, NextFunction } from "express";
import { verifyUserToken, UserTokenPayload } from "../config/auth";

declare global {
  namespace Express {
    interface Request {
      user?: UserTokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined;

  // 1. Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  // 2. Check httpOnly Cookie
  if (!token && req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  }

  // 3. Check Query parameter (for SSE EventSource connections)
  if (!token && req.query && typeof req.query.token === "string") {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication token is missing or expired. Please sign in.",
      },
    });
    return;
  }

  const payload = verifyUserToken(token);
  if (!payload) {
    res.status(401).json({
      error: {
        code: "INVALID_TOKEN",
        message: "Authentication token is invalid or expired",
      },
    });
    return;
  }

  req.user = payload;
  next();
}
