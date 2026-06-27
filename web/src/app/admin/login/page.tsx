import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { signIn } from "@/auth";
import { isAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "Admin login", robots: "noindex,nofollow" };
export const dynamic = "force-dynamic";

// The legacy ADMIN_KEY cookie login is retired. Admins are an ADMIN_EMAILS
// allow-list resolved in the JWT callback (src/auth.ts), so the login page is
// now a "Sign in with Google" landing. Allow-listed Google accounts land on
// /admin/review; everyone else sees an access notice.
async function signInWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/admin/review" });
}

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin/review");

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-stone-900">Admin login</h1>
      <p className="mt-4 text-sm text-stone-600">
        Moderation is restricted to allow-listed accounts. Sign in with the Google account on the
        admin allow-list to continue.
      </p>
      <form action={signInWithGoogle} className="mt-6">
        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
        >
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
