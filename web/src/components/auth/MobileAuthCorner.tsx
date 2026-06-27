import { AuthButton } from "@/components/auth/AuthButton";

// Mobile has no top header bar (kept clean / app-like). The Google sign-in lives
// as a floating control in the top-right corner instead.
export function MobileAuthCorner() {
  return (
    <div className="fixed right-3 top-3 z-40 rounded-full bg-white/90 shadow-md backdrop-blur sm:hidden">
      <AuthButton />
    </div>
  );
}
