import type { Metadata } from "next";
import { RoleGuard } from "@/components/layout/AccessControl";
import { OutreachDashboard } from "@/components/dashboard/OutreachDashboard";

export const metadata: Metadata = {
  title: "Outreach & Automation",
  description: "Consent-based trainee messaging campaigns and follow-up automations.",
};

export default function OutreachPage() {
  return (
    <>
      <RoleGuard role="admin" />
      <OutreachDashboard />
    </>
  );
}
