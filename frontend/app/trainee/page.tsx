import type { Metadata } from "next";
import { RoleGuard } from "@/components/layout/AccessControl";
import { TraineeDashboard } from "@/components/trainee/TraineeDashboard";

export const metadata: Metadata = {
  title: "Trainee Outcome Passport",
  description: "Track verified skills, employment, wages and learning progress.",
};

export default function TraineePage() {
  return (
    <>
      <RoleGuard role="trainee" />
      <TraineeDashboard />
    </>
  );
}
