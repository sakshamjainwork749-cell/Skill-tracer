import type { Metadata } from "next";
import { RoleGuard } from "@/components/layout/AccessControl";
import { ProfilePage } from "@/components/trainee/ProfilePage";

export const metadata: Metadata = {
  title: "Trainee Profile",
  description: "View and update your SkillTrace profile details.",
};

export default function TraineeProfilePage() {
  return (
    <>
      <RoleGuard role="trainee" />
      <ProfilePage />
    </>
  );
}
