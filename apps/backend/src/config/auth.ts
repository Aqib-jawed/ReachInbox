import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "default_super_secret_jwt_key_12345";
const TOKEN_EXPIRY = "7d";

export interface UserTokenPayload {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}

export function signUserToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyUserToken(token: string): UserTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserTokenPayload;
  } catch {
    return null;
  }
}
