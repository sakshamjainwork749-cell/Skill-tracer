"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, UserRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const inputClass = "mt-2 h-12 w-full rounded-xl border border-navy-200 bg-white px-3.5 text-sm text-navy-900 outline-none transition placeholder:text-navy-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10";

export function ProfilePage() {
  const { token, isDemoSession } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isLive = Boolean(token && !isDemoSession && !token.startsWith("demo-"));

  useEffect(() => {
    if (!isLive) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    api
      .getTraineePassport(token)
      .then((passport) => {
        if (!active) return;
        setFullName(passport.trainee.full_name);
        setPhone(passport.trainee.phone ?? "");
        setDistrict(passport.trainee.district);
        setAddress(passport.trainee.address ?? "");
        setEmail(passport.trainee.email);
        setIdentifier(passport.trainee.internal_identifier);
      })
      .catch(() => {
        if (active) setError("Could not load your profile. Please retry.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, isDemoSession, isLive]);

  const save = async () => {
    if (!fullName.trim() || !district.trim()) {
      setError("Name and district are required.");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.updateProfile(
        {
          full_name: fullName.trim(),
          phone: phone.trim(),
          district: district.trim(),
          address: address.trim(),
        },
        token,
      );
      setMessage("Profile saved. The new details persist after refresh.");
    } catch {
      setError("Could not save your profile. Please retry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      role="trainee"
      title="Profile"
      subtitle="Your personal and contact details"
    >
      <Card className="max-w-3xl p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700">
            <UserRound className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-navy-900">Edit profile</h2>
            <p className="mt-1 text-xs leading-5 text-navy-500">
              Email, role and trainee ID are identity and cannot be changed here.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-xs text-navy-400" role="status">Loading profile…</p>
        ) : !isLive ? (
          <p className="mt-6 rounded-xl bg-soft-slate p-4 text-xs leading-5 text-navy-500">
            Sign in with your trainee account to edit your live profile.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold text-navy-700">Full name</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} disabled={saving} className={inputClass} autoComplete="name" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-navy-700">Phone</span>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} disabled={saving} className={inputClass} autoComplete="tel" placeholder="+91 …" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-navy-700">District</span>
              <input value={district} onChange={(event) => setDistrict(event.target.value)} disabled={saving} className={inputClass} />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-navy-700">Address</span>
              <input value={address} onChange={(event) => setAddress(event.target.value)} disabled={saving} className={inputClass} placeholder="Village / town, taluka" />
            </label>
            <div className="rounded-xl bg-soft-slate p-4 sm:col-span-2">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-navy-400">Identity (read-only)</p>
              <p className="mt-1 text-xs font-bold text-navy-700">{email} · <span className="font-mono">{identifier}</span> · Trainee</p>
            </div>
            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              {message && (
                <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700" role="status">
                  <CheckCircle2 className="size-3.5" /> {message}
                </p>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700" role="alert">{error}</p>
        )}
      </Card>
    </AppShell>
  );
}
