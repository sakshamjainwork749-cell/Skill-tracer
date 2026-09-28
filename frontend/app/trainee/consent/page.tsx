import type { Metadata } from "next";
import { RoleGuard } from "@/components/layout/AccessControl";
import { ConsentPage } from "@/components/trainee/ConsentPage";

export const metadata: Metadata = {
  title: "Privacy & Consent",
  description: "Manage how your SkillTrace outcome data is used and verified.",
};

export default function TraineeConsentPage() {
  return (
    <>
      <RoleGuard role="trainee" />
      <ConsentPage />
    </>
  );
}
