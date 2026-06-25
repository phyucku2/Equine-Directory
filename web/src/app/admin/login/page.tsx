import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { ADMIN_COOKIE, adminKey, isAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "Admin login", robots: "noindex,nofollow" };

async function login(formData: FormData) {
  "use server";
  const key = adminKey();
  const provided = String(formData.get("key") ?? "");
  if (key && provided === key) {
    const store = await cookies();
    store.set(ADMIN_COOKIE, provided, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    redirect("/admin/review");
  }
  redirect("/admin/login?error=1");
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAdmin()) redirect("/admin/review");
  const { error } = await searchParams;
  const disabled = !adminKey();

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-stone-900">Admin login</h1>
      {disabled ? (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Admin is disabled. Set the <code>ADMIN_KEY</code> environment variable to enable the
          moderation console.
        </p>
      ) : (
        <form action={login} className="mt-6 space-y-4">
          <input
            type="password"
            name="key"
            placeholder="Admin key"
            required
            className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {error && <p className="text-sm text-red-600">Incorrect key.</p>}
          <button type="submit" className="w-full rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800">
            Sign in
          </button>
        </form>
      )}
    </div>
  );
}
