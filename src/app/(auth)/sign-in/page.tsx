import { prisma } from "@/server/db/client";
import { SignInClient } from "./sign-in-client";

export const dynamic = "force-dynamic";

const FALLBACK = "/cms/auth/sign-in.jpg";

export default async function SignInPage() {
  const policy = await prisma.sitePolicy.findUnique({ where: { id: "singleton" } });
  const sideImageUrl = policy?.authSignInImage || FALLBACK;
  return <SignInClient sideImageUrl={sideImageUrl} />;
}
