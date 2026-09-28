from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime
from statistics import median
from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    EmploymentRecord,
    JobPostingDemand,
    Proof,
    Trainee,
    TrainingEnrollment,
)
from app.models.enums import (
    DemandStatus,
    EmploymentStatus,
    OutcomeType,
    ProofStatus,
)


def confidence_for_outcome(
    employment: EmploymentRecord | None,
    proofs: list[Proof] | None = None,
) -> int:
    """Return the prescribed confidence score.

    A self report is exactly 60. Once it has either a retained proof or a
    verified employer record it is exactly 95. There are no intermediate or
    score-weighted confidence values.
    """

    if employment is None:
        return 60
    if employment.status == EmploymentStatus.VERIFIED:
        return 95
    if any(proof.status != ProofStatus.REJECTED for proof in (proofs or [])):
        return 95
    return 60


def _normalised(values: list[str] | None) -> set[str]:
    return {
        value.strip().casefold() for value in (values or []) if value and value.strip()
    }


def calculate_skill_relevance(
    db: Session,
    enrollment: TrainingEnrollment | None,
    employment: EmploymentRecord | None,
) -> int:
    if enrollment is None:
        return 0

    course_skills = _normalised(enrollment.course.taught_skills)
    if not course_skills:
        return 0

    feedback = employment.skill_alignment_feedback if employment else None
    if isinstance(feedback, dict) and feedback.get("overall_alignment") is not None:
        try:
            return max(
                0,
                min(100, round(float(feedback["overall_alignment"]) / 5 * 100)),
            )
        except (TypeError, ValueError):
            pass

    demand_query = select(JobPostingDemand).where(
        JobPostingDemand.sector == enrollment.course.sector,
        JobPostingDemand.status == DemandStatus.ACTIVE,
    )
    if employment and employment.location:
        demand_query = demand_query.where(
            JobPostingDemand.district == employment.location
        )
    elif enrollment.course.district:
        demand_query = demand_query.where(
            JobPostingDemand.district == enrollment.course.district
        )

    demand_skills: Counter[str] = Counter()
    for posting in db.scalars(demand_query):
        demand_skills.update(_normalised(posting.skills_required))

    role_tokens = (
        _normalised((employment.role or "").replace("-", " ").split())
        if employment
        else set()
    )
    role_tokens.update(
        _normalised((employment.role or "").split()) if employment else set()
    )
    direct_matches = len(course_skills & role_tokens)

    if demand_skills:
        total_positions = sum(demand_skills.values())
        matched_positions = sum(
            count for skill, count in demand_skills.items() if skill in course_skills
        )
        relevance = 45 + 45 * matched_positions / total_positions
        relevance += min(direct_matches * 5, 10)
    else:
        relevance = 55 + min(direct_matches * 15, 40)

    return max(0, min(100, round(relevance)))


def _risk_level(score: int) -> str:
    if score >= 60:
        return "HIGH"
    if score >= 30:
        return "MEDIUM"
    return "LOW"


class RiskResult(TypedDict):
    score: int
    level: str
    reasons: list[str]


def calculate_risk(
    db: Session,
    trainee: Trainee,
    enrollment: TrainingEnrollment | None,
    employment: EmploymentRecord | None,
    *,
    now: datetime | None = None,
) -> RiskResult:
    current_time = now or datetime.now(UTC)
    today = current_time.date()
    score = 0
    reasons: list[str] = []

    if employment is None:
        score += 30
        reasons.append("No verified outcome is available")
    elif employment.status == EmploymentStatus.REJECTED:
        score += 45
        reasons.append("Outcome was rejected by the employer")
    elif employment.status == EmploymentStatus.NEEDS_CORRECTION:
        score += 35
        reasons.append("Employer requested outcome corrections")
    elif employment.status != EmploymentStatus.VERIFIED:
        score += 20
        reasons.append("Outcome is awaiting stakeholder verification")

    if employment and employment.outcome_type != OutcomeType.SEEKING_JOB:
        age_days = max(
            0,
            (
                today
                - (employment.submitted_at.date() if employment.submitted_at else today)
            ).days,
        )
        if age_days > 180:
            score += 25
            reasons.append("Outcome information is over six months old")
        elif age_days > 90:
            score += 15
            reasons.append("Outcome information is over three months old")
        elif age_days > 30:
            score += 8
            reasons.append("Outcome information needs a freshness check")
    elif employment and employment.outcome_type == OutcomeType.SEEKING_JOB:
        if employment.ended_at and (today - employment.ended_at).days > 90:
            score += 25
            reasons.append("Job-seeking status has not been refreshed in 90 days")

    if employment and employment.wage_value is not None:
        comparable_wages = db.scalars(
            select(EmploymentRecord.wage_value)
            .join(Trainee, EmploymentRecord.trainee_id == Trainee.id)
            .where(
                Trainee.district == trainee.district,
                EmploymentRecord.id != employment.id,
                EmploymentRecord.wage_value.is_not(None),
                EmploymentRecord.outcome_type.in_(
                    [OutcomeType.EMPLOYED, OutcomeType.APPRENTICESHIP]
                ),
            )
        )
        benchmark = list(comparable_wages)
        if benchmark:
            district_median = float(
                median(float(value) for value in benchmark if value is not None)
            )
            wage = float(employment.wage_value)
            if wage < district_median * 0.8:
                score += 20
                reasons.append("Wage is materially below the district median")
            elif wage < district_median:
                score += 10
                reasons.append("Wage is below the district median")
    elif employment and employment.outcome_type in {
        OutcomeType.EMPLOYED,
        OutcomeType.APPRENTICESHIP,
    }:
        score += 8
        reasons.append("Wage information is missing")

    relevance = calculate_skill_relevance(db, enrollment, employment)
    if relevance < 40:
        score += 30
        reasons.append("Low skill relevance to current sector demand")
    elif relevance < 65:
        score += 18
        reasons.append("Skill alignment needs validation")
    elif relevance < 80:
        score += 8
        reasons.append("Partial skill alignment with current demand")

    score = min(100, score)
    return {
        "score": score,
        "level": _risk_level(score),
        "reasons": reasons or ["No material risk signals detected"],
    }
