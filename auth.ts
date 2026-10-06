import NextAuth, { type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { authConfig } from "./auth.config";

export type UserRole = "MASTER" | "ADMIN" | "RH" | "GESTOR" | "FUNCIONARIO";
type ExtendedUser = User & { role?: UserRole | null; employeeId?: string | null };

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "Credenciais",
      credentials: {
        email: { label: "E-mail", type: "email", placeholder: "voce@vgon.com.br" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials || typeof credentials.email !== "string" || typeof credentials.password !== "string") {
          return null;
        }
        const email = credentials.email.trim().toLowerCase();
        const user = await prisma.users.findUnique({
          where: { email, deletedAt: null },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
            employeeId: true,
            active: true,
          },
        });
        if (!user || !user.active || !user.passwordHash) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        try {
          await prisma.users.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        } catch {
          // ignore
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          employeeId: user.employeeId,
        } satisfies ExtendedUser;
      },
    }),
  ],
});
