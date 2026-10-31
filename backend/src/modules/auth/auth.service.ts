import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getApps, initializeApp } from "firebase-admin/app";
import type { User } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

type ProfileUpdate = { phone?: string; name?: string; city?: string; address?: string; language?: string };
type PublicUser = Pick<User, "id" | "phone" | "email" | "name" | "city" | "address" | "language" | "role">;
type SessionResult = { accessToken: string; expiresInSeconds: number; user: PublicUser };

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async requestOtp(phone: string) {
    const normalized = phone.replace(/\s+/g, "");
    if (!/^\+?[0-9]{9,15}$/.test(normalized)) throw new BadRequestException("Invalid phone number");
    const code = process.env.APP_ENV === "production" ? undefined : "123456";
    const actual = code ?? String(Math.floor(100000 + Math.random() * 900000));
    await this.prisma.otpChallenge.updateMany({ where: { phone: normalized, consumedAt: null }, data: { consumedAt: new Date() } });
    await this.prisma.otpChallenge.create({ data: { phone: normalized, codeHash: hash(actual), expiresAt: new Date(Date.now() + 5 * 60 * 1000) } });
    return { accepted: true, expiresInSeconds: 300, devCode: process.env.APP_ENV === "production" ? undefined : actual };
  }

  async validateSession(raw: string) {
    const session = await this.prisma.session.findFirst({ where: { tokenHash: hash(raw), expiresAt: { gt: new Date() } }, include: { user: true } });
    if (!session) throw new UnauthorizedException("Invalid or expired session");
    return this.toPublicUser(session.user);
  }

  async getProfile(token: string) {
    return this.validateSession(token);
  }

  async authenticateFirebase(idToken: string): Promise<SessionResult> {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) {
      throw new ServiceUnavailableException("Firebase authentication is not configured on the server");
    }

    const app = getApps().find((item) => item.options.projectId === projectId) ?? initializeApp({ projectId });
    let decoded;
    try {
      decoded = await getAuth(app).verifyIdToken(idToken);
    } catch {
      throw new UnauthorizedException("Invalid or expired Firebase token");
    }

    const email = decoded.email?.trim().toLowerCase();
    if (!email) {
      throw new UnauthorizedException("A Firebase account with an email address is required");
    }

    const byUid = await this.prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
    if (byUid && byUid.email !== email) {
      const emailOwner = await this.prisma.user.findUnique({ where: { email } });
      if (emailOwner && emailOwner.id !== byUid.id) {
        throw new ConflictException("This email is already linked to another account");
      }
      const user = await this.prisma.user.update({
        where: { id: byUid.id },
        data: { email, passwordHash: null }
      });
      return this.createSession(user);
    }

    const byEmail = byUid ?? await this.prisma.user.findUnique({ where: { email } });
    if (byEmail?.firebaseUid && byEmail.firebaseUid !== decoded.uid) {
      throw new ConflictException("This email is already linked to another Firebase account");
    }

    const user = byEmail
      ? await this.prisma.user.update({
        where: { id: byEmail.id },
        data: { email, firebaseUid: decoded.uid, passwordHash: null }
      })
      : await this.prisma.user.create({
        data: {
          email,
          firebaseUid: decoded.uid,
          name: typeof decoded.name === "string" ? decoded.name : null
        }
      });
    return this.createSession(user);
  }

  async generatePasswordResetLink(email: string): Promise<string> {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) throw new ServiceUnavailableException("Firebase authentication is not configured on the server");
    const app = getApps().find((item) => item.options.projectId === projectId) ?? initializeApp({ projectId });
    try {
      return await getAuth(app).generatePasswordResetLink(email.trim().toLowerCase());
    } catch {
      throw new BadRequestException("Не удалось создать ссылку сброса. Проверьте, что email продавца зарегистрирован в Firebase.");
    }
  }

  async updateProfile(token: string, update: ProfileUpdate) {
    const user = await this.validateSession(token);
    return this.prisma.user.update({ where: { id: user.id }, data: update });
  }

  private async createSession(user: User): Promise<SessionResult> {
    const raw = randomBytes(32).toString("hex");
    await this.prisma.session.create({ data: { userId: user.id, tokenHash: hash(raw), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
    return { accessToken: raw, expiresInSeconds: 30 * 24 * 60 * 60, user: this.toPublicUser(user) };
  }

  private toPublicUser(user: User): PublicUser {
    const { id, phone, email, name, city, address, language, role } = user;
    return { id, phone, email, name, city, address, language, role };
  }

  async verifyOtp(phone: string, code: string) {
    const normalized = phone.replace(/\s+/g, "");
    const challenge = await this.prisma.otpChallenge.findFirst({ where: { phone: normalized, consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
    if (!challenge || challenge.attempts >= 5 || hash(code) !== challenge.codeHash) {
      if (challenge) await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException("Invalid or expired OTP");
    }
    const user = await this.prisma.user.upsert({ where: { phone: normalized }, create: { phone: normalized }, update: {} });
    const raw = randomBytes(32).toString("hex");
    await this.prisma.$transaction([
      this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } }),
      this.prisma.session.create({ data: { userId: user.id, tokenHash: hash(raw), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } })
    ]);
    return { accessToken: raw, expiresInSeconds: 30 * 24 * 60 * 60, user };
  }
}
