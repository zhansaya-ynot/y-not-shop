"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm, type SignInFormSubmit } from "@/components/auth/sign-in-form";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { authFetch } from "@/lib/auth-fetch";

function SignInPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  // Honour ?next= when set (e.g. middleware pushed the user to /sign-in from
  // a deep link). When absent we route by role: ADMIN/OWNER → /admin so the
  // shop owner doesn't land in the customer cabinet.
  const explicitNext = params.get("next");
  const toast = useToast();

  const handleSubmit = async (data: SignInFormSubmit) => {
    const res = await authFetch("/api/auth/sign-in", {
      method: "POST",
      body: JSON.stringify({ email: data.email, password: data.password }),
    });
    if (res.status === 403) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (body.error === "EMAIL_NOT_VERIFIED") {
        toast.show("Verify your email to continue.");
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
        return;
      }
    }
    if (!res.ok) {
      toast.show("Email or password is incorrect.");
      return;
    }
    const json = (await res.json().catch(() => ({}))) as { role?: string | null };
    const isAdmin = json.role === "ADMIN" || json.role === "OWNER";
    const dest = explicitNext ?? (isAdmin ? "/admin" : "/account");
    toast.show("Welcome back.");
    router.push(dest);
    router.refresh();
  };

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back to YNOT London."
      sideImage={{ src: "/cms/auth/sign-in.jpg", alt: "YNOT editorial" }}
      footer={
        <>
          New to YNOT?{" "}
          <Link
            href="/register"
            className="underline underline-offset-2 hover:text-foreground-primary"
          >
            Create an account
          </Link>
        </>
      }
    >
      <SignInForm onSubmit={handleSubmit} />
    </AuthCard>
  );
}

export default function SignInPage() {
  return (
    <ToastProvider>
      <React.Suspense fallback={null}>
        <SignInPageInner />
      </React.Suspense>
    </ToastProvider>
  );
}
