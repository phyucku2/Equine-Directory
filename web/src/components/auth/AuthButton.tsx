"use client";

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function AuthButton() {
  const { data, status } = useSession();
  const [open, setOpen] = useState(false);

  if (status === "loading") {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-cream-dark" aria-hidden />;
  }

  if (!data?.user) {
    return (
      <button
        type="button"
        onClick={() => signIn("google")}
        className="inline-flex items-center gap-2 rounded-lg border border-leather/30 bg-white px-2.5 py-1.5 text-sm font-medium text-ink transition hover:border-brass"
      >
        <GoogleIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Sign in</span>
      </button>
    );
  }

  const user = data.user;
  const initial = (user.name ?? user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brass text-sm font-semibold text-white ring-1 ring-leather/20"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          initial
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-leather/15 bg-white p-2 shadow-lg">
            <div className="px-3 py-2">
              {user.name && <p className="truncate text-sm font-semibold text-pine">{user.name}</p>}
              {user.email && <p className="truncate text-xs text-ink/55">{user.email}</p>}
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink transition hover:bg-cream-dark"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
