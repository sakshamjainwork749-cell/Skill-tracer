import type { Metadata } from "next";
import { RoleGuard } from "@/components/layout/AccessControl";
import { GovernmentDashboard } from "@/components/dashboard/GovernmentDashboard";

export const metadata: Metadata = {
  title: "Government Outcome Intelligence",
  description: "District-level training, placement, retention, wage and skill-gap intelligence for Maharashtra.",
};

export default function AdminPage() {
  return (
    <>
      <RoleGuard role="admin" />
      <GovernmentDashboard />
    </>
  );
}
