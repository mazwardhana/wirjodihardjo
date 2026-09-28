import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resolveCredentialFlag } from "@/lib/session-flags";
import { z } from "zod";

const credentialsSchema = z.object({
  usernameOrEmail: z.string().min(1),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        usernameOrEmail: { label: "Username atau Email", type: "text" },
        password: { label: "Kata sandi", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const input = parsed.data.usernameOrEmail;
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: input },
              { email: input.toLowerCase() },
            ],
          },
          include: { person: { select: { fullName: true } } },
        });
        if (!user || !user.isActive) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.person.fullName,
          role: user.role,
          mustChangeCredentials: user.mustChangeCredentials,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.mustChangeCredentials = (user as { mustChangeCredentials?: boolean }).mustChangeCredentials;
        return token;
      }
      // JWT menyimpan salinan flag. Onboarding mengubahnya di database,
      // jadi baca ulang agar pengguna tidak terlempar balik ke /onboarding.
      token.mustChangeCredentials = await resolveCredentialFlag(token, (userId) =>
        prisma.user
          .findUnique({ where: { id: userId }, select: { mustChangeCredentials: true } })
          .then((row) => (row ? row.mustChangeCredentials : null)),
      );
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { mustChangeCredentials?: boolean }).mustChangeCredentials = token.mustChangeCredentials as boolean;
      }
      return session;
    },
  },
});

declare module "next-auth" {
  interface User {
    role?: string;
    mustChangeCredentials?: boolean;
  }
  interface Session {
    user: {
      id: string;
      role: string;
      mustChangeCredentials: boolean;
      name?: string | null;
      email?: string | null;
    };
  }
}