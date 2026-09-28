import type { Metadata } from "next";
import { RoleGuard } from "@/components/layout/AccessControl";
import { VerificationPage } from "@/components/employer/VerificationPage";

export const metadata: Metadata = {
  title: "Review Employment Verification",
  description: "Confirm an employment outcome and share structured skill relevance feedback.",
};

export default async function VerifyEmploymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <RoleGuard role="employer" />
      <VerificationPage id={id} />
    </>
  );
}
