import { redirect } from "next/navigation";

export default async function SecureFollowupEntry({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const destination = `/trainee/update?followup=${encodeURIComponent(token)}`;
  redirect(`/login?role=trainee&returnTo=${encodeURIComponent(destination)}`);
}
