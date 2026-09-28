from __future__ import annotations

from enum import StrEnum


class UserRole(StrEnum):
    TRAINEE = "TRAINEE"
    EMPLOYER = "EMPLOYER"
    GOVERNMENT_ADMIN = "GOVERNMENT_ADMIN"


class EnrollmentStatus(StrEnum):
    ENROLLED = "ENROLLED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    WITHDRAWN = "WITHDRAWN"


class OutcomeType(StrEnum):
    EMPLOYED = "EMPLOYED"
    SELF_EMPLOYED = "SELF_EMPLOYED"
    APPRENTICESHIP = "APPRENTICESHIP"
    SEEKING_JOB = "SEEKING_JOB"


class EmploymentStatus(StrEnum):
    REPORTED = "REPORTED"
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    NEEDS_CORRECTION = "NEEDS_CORRECTION"
    REJECTED = "REJECTED"


class ProofStatus(StrEnum):
    UPLOADED = "UPLOADED"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class FollowupStatus(StrEnum):
    SCHEDULED = "SCHEDULED"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    RESPONDED = "RESPONDED"
    FAILED = "FAILED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class FollowupChannel(StrEnum):
    EMAIL = "EMAIL"
    WHATSAPP = "WHATSAPP"
    PHONE = "PHONE"


class DemandStatus(StrEnum):
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"


class MessageStatus(StrEnum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    READ = "READ"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class CampaignStatus(StrEnum):
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
