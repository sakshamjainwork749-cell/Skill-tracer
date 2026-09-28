from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MessageTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    template_key: str
    channel: str
    body: str
    variables: list[str]
    is_active: bool


class MessageTemplateCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=160)
    template_key: str = Field(min_length=2, max_length=80, pattern=r"^[A-Z0-9_]+$")
    channel: str = Field(default="WHATSAPP", max_length=20)
    body: str = Field(min_length=10, max_length=2000)
    variables: list[str] = Field(default_factory=list, max_length=20)


class AudienceFilter(BaseModel):
    model_config = ConfigDict(extra="forbid")

    district: str | None = None
    course: str | None = None
    employment_status: str | None = None  # employed | unemployed | self_employed | apprenticeship
    followup_due: bool | None = None
    consent_given: bool | None = None  # None = all, True = opted-in only
    search: str | None = None
    trainee_ids: list[str] | None = None  # explicit bulk selection (capped)


class CampaignCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=160)
    template_key: str = Field(min_length=2, max_length=80)
    audience: AudienceFilter = Field(default_factory=AudienceFilter)
    channel: str = Field(default="WHATSAPP", max_length=20)
    scheduled_at: datetime | None = None


class CampaignResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    template_key: str | None = None
    audience_filter: dict | None = None
    channel: str
    status: str
    scheduled_at: datetime | None = None
    created_at: datetime
    queued: int = 0
    sent: int = 0
    delivered: int = 0
    failed: int = 0


class AudiencePreview(BaseModel):
    eligible: int
    consent_available: int
    excluded: int
    sample: list[str] = Field(default_factory=list)


class AutomationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=160)
    trigger_type: str = Field(default="OUTCOME_SUBMITTED", max_length=40)
    delay_days: list[int] = Field(default_factory=lambda: [30, 60, 90], max_length=5)
    template_key: str | None = None
    audience: AudienceFilter = Field(default_factory=AudienceFilter)


class AutomationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=2, max_length=160)
    is_active: bool | None = None
    delay_days: list[int] | None = Field(default=None, max_length=5)


class AutomationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    trigger_type: str
    delay_days: list[int]
    is_active: bool
    enrolled: int = 0
    scheduled: int = 0
    delivered: int = 0
    failed: int = 0
    pending: int = 0


class OutreachAnalytics(BaseModel):
    active_automations: int
    total_automations: int
    enrolled: int
    messages_scheduled: int
    delivered: int
    failed: int
    pending: int
    simulated: int
    next_run: str


class TraineeOutreachRow(BaseModel):
    trainee_id: UUID
    name: str
    district: str
    training: str | None = None
    employment: str | None = None
    company: str | None = None
    next_followup: str | None = None
    whatsapp_consent: bool
    phone_masked: str | None = None
    last_updated: datetime
    status: str


class SendOneRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    trainee_id: UUID
    template_key: str = Field(min_length=2, max_length=80)


class WhatsAppConsentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    consent_given: bool


class WhatsAppNumberUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phone: str = Field(min_length=7, max_length=32)


class WhatsAppHistoryItem(BaseModel):
    id: UUID
    scheduled_for: str
    template: str | None = None
    status: str
    display_status: str
    sent_at: str | None = None
    delivered_at: str | None = None
    response: str | None = None
    responded_at: str | None = None


class WhatsAppStatus(BaseModel):
    consent: bool
    phone_masked: str | None = None
    frequency: str = "30 · 60 · 90 days"
    next_followup: str | None = None
    last_message: str | None = None
    provider: str = "demo"
