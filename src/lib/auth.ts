import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseSecret } from "./supabase";

export const SESSION_COOKIE = "sbs_admin";

// The session token is derived from the admin password, so changing ADMIN_PASSWORD signs everyone out.
export function sessionToken() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return createHmac("sha256", password + (supabaseSecret() ?? ""))
    .update("soft-baked-stories-admin")
    .digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function isAdmin() {
  const token = sessionToken();
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  return !!token && !!cookie && safeEqual(cookie, token);
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
