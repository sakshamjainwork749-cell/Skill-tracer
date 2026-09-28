import type { Metadata } from "next";
import { RoleGuard } from "@/components/layout/AccessControl";
import { EmployerProfilePage } from "@/components/employer/EmployerProfilePage";

export const metadata: Metadata = {
  title: "Employer Profile",
  description: "View and update your SkillTrace employer profile.",
};

export default function EmployerProfileRoute() {
  return (
    <>
      <RoleGuard role="employer" />
      <EmployerProfilePage />
    </>
  );
}
