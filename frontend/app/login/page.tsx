import type { Metadata } from "next";
import { LoginExperience } from "@/components/auth/LoginExperience";
import type { UserRole } from "@/lib/types";

export const metadata: Metadata = {
  title: "Role Access",
  description: "Enter the SkillTrace trainee, employer or government demonstration workspace.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; returnTo?: string }>;
}) {
  const { role, returnTo } = await searchParams;
  const normalized = role === "government" ? "admin" : role;
  const initialRole: UserRole = normalized === "employer" || normalized === "admin" ? normalized : "trainee";
  const postLoginPath = returnTo?.startsWith("/trainee/update?followup=") ? returnTo : undefined;
  return <LoginExperience initialRole={initialRole} postLoginPath={postLoginPath} />;
}
