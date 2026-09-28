import type { DashboardData } from "@/lib/types";

export interface SectorGapSummary {
  sector: string;
  supply: number;
  demand: number;
  gap: number;
  gapPct: number;
  topSkill: string;
  skills: Array<{ skill: string; supply: number; demand: number; gap: number; ratio: number }>;
}

/** Defensive normalizer for skill-gap payloads. Accepts backend
 * (`skill-gaps`), alternate (`skill_gaps`), or nested (`data.sectors`)
 * shapes and always returns an array (empty when unavailable). */
export function getSkillGapSectors(data: unknown): SectorGapSummary[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;
  const container =
    (root["skill-gaps"] as Record<string, unknown> | undefined) ??
    (root["skill_gaps"] as Record<string, unknown> | undefined) ??
    (root["data"] as Record<string, unknown> | undefined);
  const rawSectors =
    (container?.["sectors"] as unknown[] | undefined) ??
    (root["sectors"] as unknown[] | undefined) ??
    [];
  if (!Array.isArray(rawSectors)) return [];
  return rawSectors.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const sector = typeof record.sector === "string" ? record.sector : null;
    const skillsRaw = Array.isArray(record.skills) ? record.skills : [];
    if (!sector) return [];
    const skills = skillsRaw.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const skill = item as Record<string, unknown>;
      if (typeof skill.skill !== "string") return [];
      const supply = Number(skill.supply) || 0;
      const demand = Number(skill.demand) || 0;
      return [{
        skill: skill.skill,
        supply,
        demand,
        gap: Number(skill.gap) || Math.max(0, demand - supply),
        ratio: Math.round((demand / Math.max(supply, 1)) * 100) / 100,
      }];
    });
    const supply = skills.reduce((sum, item) => sum + item.supply, 0);
    const demand = skills.reduce((sum, item) => sum + item.demand, 0);
    const gap = Math.max(0, demand - supply);
    const top = [...skills].sort((a, b) => b.gap - a.gap || b.demand - a.demand)[0];
    return [{
      sector,
      supply,
      demand,
      gap,
      gapPct: demand > 0 ? Math.round((gap / demand) * 100) : 0,
      topSkill: top?.skill ?? "—",
      skills,
    }];
  });
}

export function findDistrictIdByName(data: DashboardData, name: string | null): string | null {
  if (!name) return null;
  const needle = name.trim().toLowerCase();
  const match = data.districts.find(
    (district) => district.name.toLowerCase() === needle || district.id === needle,
  );
  return match?.id ?? null;
}
