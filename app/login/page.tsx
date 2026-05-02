"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LoginPage } from "@takaki/go-design-system";
import { Compass } from "lucide-react";

function LoginContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  async function handleGoogleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <LoginPage
      productName="CultureGo"
      productLogo={
        <Compass
          size={24}
          style={{ color: "var(--color-primary)" }}
        />
      }
      tagline="週刊のスローメディア"
      onGoogleSignIn={handleGoogleSignIn}
    />
  );
}

export default function LoginPageRoute() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
