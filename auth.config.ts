import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role?: UserRole | null;
      employeeId?: string | null;
    };
  }
}
declare module "@auth/core/jwt" {
  interface JWT {
    role?: UserRole | null;
    employeeId?: string | null;
  }
}

export const authConfig: NextAuthConfig = {
  providers: [],
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: UserRole | null }).role ?? null;
        token.employeeId = (user as { employeeId?: string | null }).employeeId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.role = (token.role as UserRole | undefined) ?? null;
      session.user.employeeId = (token.employeeId as string | null) ?? null;
      return session;
    },
    async authorized({ auth, request }) {
      const { nextUrl } = request;
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";
      if (isLoginPage) {
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }
      const publicPrefixes = ["/_next", "/favicon", "/api/auth", "/api/agents", "/api/public"];
      if (nextUrl.pathname === "/" || publicPrefixes.some((p) => nextUrl.pathname.startsWith(p))) return true;
      if (!isLoggedIn) return Response.redirect(new URL("/login", nextUrl));
      return true;
    },
  },
};
