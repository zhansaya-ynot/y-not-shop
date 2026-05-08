import { prisma } from "@/server/db/client";
import { RegisterClient } from "./register-client";

export const dynamic = "force-dynamic";

const FALLBACK = "/cms/auth/register.jpg";

export default async function RegisterPage() {
  const policy = await prisma.sitePolicy.findUnique({ where: { id: "singleton" } });
  const sideImageUrl = policy?.authRegisterImage || FALLBACK;
  return <RegisterClient sideImageUrl={sideImageUrl} />;
}
