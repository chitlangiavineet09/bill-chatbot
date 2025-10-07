import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "./db";
import { UserRole } from "@prisma/client";
import { verifyPassword } from "./auth-helpers";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() }
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await verifyPassword(credentials.password, user.password);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      }
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        // Check if user exists in our database
        const existingUser = await db.user.findUnique({
          where: { email: user.email! }
        });

        if (!existingUser) {
          // Create new user with Google OAuth
          await db.user.create({
            data: {
              email: user.email!,
              password: "", // No password for OAuth users
              role: "User", // Default role for OAuth users
              name: user.name,
            }
          });
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (token) {
        (session.user as any).id = token.sub;
        (session.user as any).role = (token as any).role || "User";
      }
      
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        (token as any).role = (user as any).role || "User";
      }
      
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
