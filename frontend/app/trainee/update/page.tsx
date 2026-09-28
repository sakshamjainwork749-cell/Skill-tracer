import type { Metadata } from "next";
import { RoleGuard } from "@/components/layout/AccessControl";
import { OutcomeUpdateWizard } from "@/components/trainee/OutcomeUpdateWizard";

export const metadata: Metadata = {
  title: "Update Employment Status",
  description: "Share a quick, consent-based employment outcome update.",
};

export default async function TraineeUpdatePage({
  searchParams,
}: {
  searchParams: Promise<{ followup?: string }>;
}) {
  const { followup } = await searchParams;
  return (
    <>
      <RoleGuard role="trainee" />
      <OutcomeUpdateWizard followupToken={followup} />
    </>
  );
}
