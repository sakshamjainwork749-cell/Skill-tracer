import type { Metadata } from "next";
import { RoleGuard } from "@/components/layout/AccessControl";
import { EmployerDashboard } from "@/components/employer/EmployerDashboard";

export const metadata: Metadata = {
  title: "Employer Verification Desk",
  description: "Confirm trainee employment outcomes and return structured skill feedback.",
};

export default function EmployerPage() {
  return (
    <>
      <RoleGuard role="employer" />
      <EmployerDashboard />
    </>
  );
}
