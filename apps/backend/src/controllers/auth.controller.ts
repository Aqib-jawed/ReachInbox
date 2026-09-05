import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/db";
import { signUserToken } from "../config/auth";
import { getGoogleAuthUrl, exchangeGoogleCodeForProfile } from "../integrations/google-oauth/google";

export async function handleGoogleLogin(_req: Request, res: Response) {
  const url = getGoogleAuthUrl();
  res.redirect(url);
}

export async function handleGoogleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, error } = req.query;

    if (error) {
      res.status(400).json({
        error: { code: "GOOGLE_AUTH_DENIED", message: String(error) },
      });
      return;
    }

    if (!code) {
      res.status(400).json({
        error: { code: "MISSING_CODE", message: "Authorization code is required" },
      });
      return;
    }

    const profile = await exchangeGoogleCodeForProfile(String(code));

    // Upsert User in database
    const user = await prisma.user.upsert({
      where: { googleId: profile.id },
      update: {
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.picture,
        updatedAt: new Date(),
      },
      create: {
        googleId: profile.id,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.picture,
      },
    });

    // Auto-create a default Ethereal sender for this user if they don't have one
    const existingSender = await prisma.sender.findFirst({
      where: { userId: user.id },
    });

    if (!existingSender) {
      try {
        const nodemailer = await import("nodemailer");
        const testAccount = await nodemailer.createTestAccount();
        await prisma.sender.create({
          data: {
            userId: user.id,
            etherealEmail: testAccount.user,
            etherealPassword: testAccount.pass,
            rateLimitConfig: {
              create: {
                userId: user.id,
                maxPerHour: 50,
                minDelayMs: 2000,
              },
            },
          },
        });
      } catch {
        // non-blocking
      }
    }

    const token = signUserToken({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    });

    // Set secure httpOnly cookie
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const frontendUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}?auth_success=true&token=${token}`);
  } catch (err) {
    next(err);
  }
}

export async function handleDevLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { email = "dev@reachinbox.ai", name = "ReachInbox Developer" } = req.body || {};

    const user = await prisma.user.upsert({
      where: { email },
      update: { name },
      create: {
        googleId: `dev_google_${Date.now()}`,
        email,
        name,
        avatarUrl: "https://avatar.vercel.sh/reachinbox",
      },
      include: {
        senders: {
          include: {
            rateLimitConfig: true,
          },
        },
      },
    });

    // Ensure at least one sender exists
    let sender = user.senders[0];
    if (!sender) {
      const nodemailer = await import("nodemailer");
      const testAccount = await nodemailer.createTestAccount();
      sender = await prisma.sender.create({
        data: {
          userId: user.id,
          etherealEmail: testAccount.user,
          etherealPassword: testAccount.pass,
          rateLimitConfig: {
            create: {
              userId: user.id,
              maxPerHour: 50,
              minDelayMs: 2000,
            },
          },
        },
        include: {
          rateLimitConfig: true,
        },
      });
    }

    const token = signUserToken({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    });

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        sender,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function handleGetCurrentUser(req: Request, res: Response): Promise<void> {
  // @ts-ignore
  const user = req.user;
  if (!user) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
    return;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      senders: {
        include: {
          rateLimitConfig: true,
        },
      },
      slackIntegration: true,
    },
  });

  res.status(200).json({
    success: true,
    user: dbUser,
  });
}

export async function handleLogout(_req: Request, res: Response) {
  res.clearCookie("auth_token");
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
}
