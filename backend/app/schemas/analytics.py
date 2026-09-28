from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TrendPoint(BaseModel):
    month: str
    trained: int
    placed: int
    employed: int
    eligible_6m: int
    retained_6m: int
    placement_rate: float
    employed_rate: float
    retention_6m_rate: float


class OverviewResponse(BaseModel):
    total_trained: int
    total_placed: int
    employed_rate: float
    retention_6m_rate: float
    median_monthly_wage: float | None
    trend: list[TrendPoint]
    province: str
    updated_at: datetime
    pending_verification: int = 0
    self_employed: int = 0
    training_completed: int = 0


class DistrictAnalytics(BaseModel):
    id: str
    name: str
    trained: int
    placed: int
    employed_rate: float
    self_employment_rate: float
    retention_6m_rate: float
    median_wage: float | None
    top_risk_drivers: list[str]
    risk_level: str
    lat: float | None
    lng: float | None
    pending_verification: int = 0
    followup_due: int = 0


class DistrictsResponse(BaseModel):
    districts: list[DistrictAnalytics]


class FunnelStage(BaseModel):
    name: str
    value: int
    percentage: float


class FunnelResponse(BaseModel):
    stages: list[FunnelStage]


class SkillGap(BaseModel):
    skill: str
    supply: int
    demand: int
    gap: int
    ratio: float


class SectorSkillGap(BaseModel):
    sector: str
    skills: list[SkillGap]


class SkillGapsResponse(BaseModel):
    sectors: list[SectorSkillGap]


class AttritionReason(BaseModel):
    reason: str
    count: int
    percentage: float


class AttritionResponse(BaseModel):
    total: int
    reasons: list[AttritionReason]


class Insight(BaseModel):
    id: str
    severity: str
    title: str
    summary: str
    evidence: Any
    recommendation: str
    metric: str
    sector: str | None = None
    district: str | None = None


class InsightsResponse(BaseModel):
    insights: list[Insight] = Field(default_factory=list)
