"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm, type RegisterFormSubmit } from "@/components/auth/register-form";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { authFetch } from "@/lib/auth-fetch";

interface Props {
  sideImageUrl: string | null;
}

function RegisterPageInner({ sideImageUrl }: Props) {
  const router = useRouter();
  const toast = useToast();

  const handleSubmit = async (data: RegisterFormSubmit) => {
    const res = await authFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        name: `${data.firstName} ${data.lastName}`.trim(),
      }),
    });
    if (res.status === 409) {
      toast.show("That email is already registered.");
      return;
    }
    if (!res.ok) {
      toast.show("We could not create your account. Please try again.");
      return;
    }
    toast.show("Check your email for the verification code.");
    router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
  };

  return (
    <AuthCard
      title="Create account"
      subtitle="Join YNOT London for early access and members-only releases."
      sideImage={sideImageUrl ? { src: sideImageUrl, alt: "YNOT editorial" } : undefined}
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="underline underline-offset-2 hover:text-foreground-primary"
          >
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm onSubmit={handleSubmit} />
    </AuthCard>
  );
}

export function RegisterClient(props: Props) {
  return (
    <ToastProvider>
      <RegisterPageInner {...props} />
    </ToastProvider>
  );
}
