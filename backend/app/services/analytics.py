from __future__ import annotations

import calendar
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from statistics import median
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AuditLog,
    Course,
    EmploymentRecord,
    Followup,
    JobPostingDemand,
    Trainee,
    TrainingEnrollment,
)
from app.models.enums import (
    DemandStatus,
    EmploymentStatus,
    EnrollmentStatus,
    FollowupStatus,
    OutcomeType,
)
from app.schemas.analytics import (
    AttritionReason,
    AttritionResponse,
    DistrictAnalytics,
    DistrictsResponse,
    FunnelResponse,
    FunnelStage,
    Insight,
    InsightsResponse,
    OverviewResponse,
    SectorSkillGap,
    SkillGap,
    SkillGapsResponse,
    TrendPoint,
)
from app.services.risk import calculate_risk

PLACED_OUTCOMES = {
    OutcomeType.EMPLOYED,
    OutcomeType.SELF_EMPLOYED,
    OutcomeType.APPRENTICESHIP,
}
REPORTED_OUTCOMES = PLACED_OUTCOMES | {OutcomeType.SEEKING_JOB}


@dataclass(frozen=True, slots=True)
class AnalyticsFilters:
    start_date: date | None = None
    end_date: date | None = None
    district: str | None = None
    period: str | None = None
    lens: str | None = None


def _today() -> date:
    return datetime.now(UTC).date()


def _day_start(value: date) -> datetime:
    return datetime.combine(value, datetime.min.time(), tzinfo=UTC)


def resolve_date_range(filters: AnalyticsFilters) -> tuple[date | None, date | None]:
    start = filters.start_date
    end = filters.end_date
    if filters.period and start is None:
        match = re.fullmatch(r"(\d+)([dm])", filters.period.casefold())
        if not match:
            raise ValueError("period must use a format such as 30d, 90d, or 12m")
        amount = int(match.group(1))
        unit = match.group(2)
        if amount <= 0:
            raise ValueError("period amount must be positive")
        if unit == "d":
            start = (end or _today()) - timedelta(days=amount - 1)
        else:
            months = amount * 30
            start = (end or _today()) - timedelta(days=months)
    if start and end and start > end:
        raise ValueError("start_date must be on or before end_date")
    return start, end


def _percentage(numerator: int, denominator: int) -> float:
    return round((numerator / denominator * 100) if denominator else 0.0, 2)


def _normalise_skill(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).casefold()


def _month_start(value: date) -> date:
    return value.replace(day=1)


def _month_end(value: date) -> date:
    return value.replace(day=calendar.monthrange(value.year, value.month)[1])


def _add_month(value: date) -> date:
    month_index = value.year * 12 + value.month - 1 + 1
    year, zero_based_month = divmod(month_index, 12)
    month = zero_based_month + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _subtract_month(value: date) -> date:
    month_index = value.year * 12 + value.month - 1 - 1
    year, zero_based_month = divmod(month_index, 12)
    month = zero_based_month + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


class AnalyticsService:
    def __init__(self, db: Session, filters: AnalyticsFilters, province: str) -> None:
        self.db = db
        self.filters = filters
        self.start_date, self.end_date = resolve_date_range(filters)
        self.province = province

    def _completion_query(self):
        query = (
            select(TrainingEnrollment.trainee_id)
            .join(Trainee, TrainingEnrollment.trainee_id == Trainee.id)
            .where(TrainingEnrollment.status == EnrollmentStatus.COMPLETED)
        )
        if self.start_date:
            query = query.where(TrainingEnrollment.completed_at >= self.start_date)
        if self.end_date:
            query = query.where(TrainingEnrollment.completed_at <= self.end_date)
        if self.filters.district:
            query = query.where(Trainee.district == self.filters.district)
        return query

    def _enrolled_trainee_ids(self) -> set[UUID]:
        query = select(TrainingEnrollment.trainee_id).join(
            Trainee, TrainingEnrollment.trainee_id == Trainee.id
        )
        if self.start_date:
            query = query.where(TrainingEnrollment.enrolled_at >= self.start_date)
        if self.end_date:
            query = query.where(TrainingEnrollment.enrolled_at <= self.end_date)
        if self.filters.district:
            query = query.where(Trainee.district == self.filters.district)
        return set(self.db.scalars(query.distinct()).all())

    def trained_trainee_ids(self) -> set[UUID]:
        return set(self.db.scalars(self._completion_query().distinct()).all())

    def _placement_records(
        self,
        trained_ids: set[UUID],
        *,
        placed_only: bool = True,
    ) -> list[EmploymentRecord]:
        if not trained_ids:
            return []
        query = select(EmploymentRecord).where(
            EmploymentRecord.trainee_id.in_(trained_ids)
        )
        wanted = PLACED_OUTCOMES if placed_only else REPORTED_OUTCOMES
        query = query.where(EmploymentRecord.outcome_type.in_(wanted))
        query = query.where(EmploymentRecord.status != EmploymentStatus.REJECTED)
        # Cohort KPIs and retention describe the latest known outcome. Historical
        # records remain in wage_progression and the audit trail, but must not
        # inflate current employment or retention after a new SEEKING_JOB update.
        query = query.where(EmploymentRecord.is_current.is_(True))
        if self.start_date:
            query = query.where(EmploymentRecord.start_date >= self.start_date)
        if self.end_date:
            query = query.where(EmploymentRecord.start_date <= self.end_date)
        return list(
            self.db.scalars(query.order_by(EmploymentRecord.submitted_at.desc())).all()
        )

    @staticmethod
    def _unique_placed(records: list[EmploymentRecord]) -> set[UUID]:
        return {
            record.trainee_id for record in records if record.start_date is not None
        }

    @staticmethod
    def _latest_by_trainee(
        records: list[EmploymentRecord],
    ) -> dict[UUID, EmploymentRecord]:
        latest: dict[UUID, EmploymentRecord] = {}
        for record in records:
            latest.setdefault(record.trainee_id, record)
        return latest

    def _retention_ids(
        self,
        records: list[EmploymentRecord],
        as_of: date,
        retention_days: int = 180,
    ) -> set[UUID]:
        retained: set[UUID] = set()
        for record in records:
            if not record.start_date:
                continue
            if (record.start_date + timedelta(days=retention_days)) > as_of:
                continue
            if (record.is_current and record.ended_at is None) or (
                record.ended_at is not None
                and (record.ended_at - record.start_date).days >= retention_days
            ):
                retained.add(record.trainee_id)
        return retained

    def _wages(self, records: list[EmploymentRecord]) -> list[float]:
        latest = self._latest_by_trainee(records)
        values = [
            float(record.wage_value)
            for record in latest.values()
            if record.wage_value is not None
            and record.outcome_type
            in {OutcomeType.EMPLOYED, OutcomeType.APPRENTICESHIP}
        ]
        return values

    def _trend(
        self,
        trained_ids: set[UUID],
        placement_records: list[EmploymentRecord],
    ) -> list[TrendPoint]:
        today = _today()
        if self.start_date and self.end_date:
            first = _month_start(self.start_date)
            last = _month_start(self.end_date)
        else:
            first = _month_start(today)
            for _ in range(11):
                first = _subtract_month(first)
            last = _month_start(today)

        enrollment_query = (
            select(TrainingEnrollment.completed_at)
            .where(
                TrainingEnrollment.trainee_id.in_(trained_ids),
                TrainingEnrollment.status == EnrollmentStatus.COMPLETED,
            )
            .distinct()
        )
        if self.start_date:
            enrollment_query = enrollment_query.where(
                TrainingEnrollment.completed_at >= self.start_date
            )
        if self.end_date:
            enrollment_query = enrollment_query.where(
                TrainingEnrollment.completed_at <= self.end_date
            )
        training_by_month: Counter[str] = Counter()
        for completed_at in self.db.scalars(enrollment_query):
            if completed_at:
                training_by_month[completed_at.strftime("%Y-%m")] += 1

        placement_by_month: Counter[str] = Counter()
        for record in placement_records:
            if record.start_date:
                placement_by_month[record.start_date.strftime("%Y-%m")] += 1

        latest_placements = self._latest_by_trainee(placement_records).values()
        points: list[TrendPoint] = []
        cursor = first
        while cursor <= last:
            month = cursor.strftime("%Y-%m")
            as_of = _month_end(cursor)
            trained = training_by_month[month]
            placed = placement_by_month[month]
            active_records = [
                record
                for record in latest_placements
                if record.start_date is not None
                and record.start_date <= as_of
                and (record.ended_at is None or record.ended_at >= as_of)
            ]
            eligible_6m = {
                record.trainee_id
                for record in active_records
                if record.start_date is not None
                and record.start_date + timedelta(days=180) <= as_of
            }
            retained_6m = {
                record.trainee_id
                for record in active_records
                if record.start_date is not None
                and record.start_date + timedelta(days=180) <= as_of
            }
            points.append(
                TrendPoint(
                    month=month,
                    trained=trained,
                    placed=placed,
                    employed=len(active_records),
                    eligible_6m=len(eligible_6m),
                    retained_6m=len(retained_6m),
                    placement_rate=_percentage(placed, trained),
                    employed_rate=_percentage(len(active_records), trained),
                    retention_6m_rate=_percentage(
                        len(retained_6m), len(eligible_6m)
                    ),
                )
            )
            cursor = _add_month(cursor).replace(day=1)
        return points

    def overview(self) -> OverviewResponse:
        trained_ids = self.trained_trainee_ids()
        placements = self._placement_records(trained_ids)
        placed_ids = self._unique_placed(placements)
        as_of = self.end_date or _today()
        retained_ids = self._retention_ids(placements, as_of)
        wages = self._wages(placements)
        audit_update = self.db.scalar(select(func.max(AuditLog.created_at)))
        if audit_update is not None and audit_update.tzinfo is None:
            audit_update = audit_update.replace(tzinfo=UTC)
        updated_at = audit_update or datetime.now(UTC)

        return OverviewResponse(
            total_trained=len(trained_ids),
            total_placed=len(placed_ids),
            employed_rate=_percentage(len(placed_ids), len(trained_ids)),
            retention_6m_rate=_percentage(len(retained_ids), len(placed_ids)),
            median_monthly_wage=round(median(wages), 2) if wages else None,
            trend=self._trend(trained_ids, placements),
            province=self.province,
            updated_at=updated_at,
            pending_verification=sum(
                1 for record in placements
                if record.status in {
                    EmploymentStatus.REPORTED,
                    EmploymentStatus.PENDING,
                    EmploymentStatus.NEEDS_CORRECTION,
                }
            ),
            self_employed=len({
                record.trainee_id for record in placements
                if record.outcome_type == OutcomeType.SELF_EMPLOYED
            }),
            training_completed=len(trained_ids),
        )

    def _risk_context(
        self, trained_ids: set[UUID]
    ) -> tuple[dict[UUID, TrainingEnrollment], dict[UUID, EmploymentRecord]]:
        enrollment_map: dict[UUID, TrainingEnrollment] = {}
        if trained_ids:
            enrollments = self.db.scalars(
                select(TrainingEnrollment)
                .where(TrainingEnrollment.trainee_id.in_(trained_ids))
                .order_by(
                    TrainingEnrollment.completed_at.desc().nullslast(),
                    TrainingEnrollment.enrolled_at.desc(),
                )
            )
            for enrollment in enrollments:
                enrollment_map.setdefault(enrollment.trainee_id, enrollment)
        record_query = select(EmploymentRecord).order_by(
            EmploymentRecord.is_current.desc(), EmploymentRecord.submitted_at.desc()
        )
        if trained_ids:
            record_query = record_query.where(
                EmploymentRecord.trainee_id.in_(trained_ids)
            )
        employment_map: dict[UUID, EmploymentRecord] = {}
        for record in self.db.scalars(record_query):
            if record.trainee_id not in employment_map and (
                record.outcome_type in REPORTED_OUTCOMES
            ):
                employment_map[record.trainee_id] = record
        return enrollment_map, employment_map

    def districts(self) -> DistrictsResponse:
        trained_ids = self.trained_trainee_ids()
        if not trained_ids:
            return DistrictsResponse(districts=[])
        trainees = list(
            self.db.scalars(select(Trainee).where(Trainee.id.in_(trained_ids))).all()
        )
        placements = self._placement_records(trained_ids)
        enrollment_map, employment_map = self._risk_context(trained_ids)
        as_of = self.end_date or _today()
        grouped: dict[str, list[Trainee]] = defaultdict(list)
        for trainee in trainees:
            grouped[trainee.district].append(trainee)

        result: list[DistrictAnalytics] = []
        for district, district_trainees in sorted(grouped.items()):
            district_ids = {trainee.id for trainee in district_trainees}
            district_placements = [
                record for record in placements if record.trainee_id in district_ids
            ]
            placed_ids = self._unique_placed(district_placements)
            retained_ids = self._retention_ids(district_placements, as_of)
            wages = self._wages(district_placements)
            pending_statuses = {
                EmploymentStatus.REPORTED,
                EmploymentStatus.PENDING,
                EmploymentStatus.NEEDS_CORRECTION,
            }
            district_pending = sum(
                1 for record in district_placements if record.status in pending_statuses
            )
            due_cutoff = as_of + timedelta(days=30)
            district_followup_due = self.db.scalar(
                select(func.count())
                .select_from(Followup)
                .where(
                    Followup.trainee_id.in_(district_ids),
                    Followup.status == FollowupStatus.SCHEDULED,
                    Followup.scheduled_for <= due_cutoff,
                )
            ) or 0
            self_employed_ids = {
                record.trainee_id
                for record in district_placements
                if record.outcome_type == OutcomeType.SELF_EMPLOYED
            }
            risk_scores: list[int] = []
            risk_drivers: Counter[str] = Counter()
            for trainee in district_trainees:
                risk = calculate_risk(
                    self.db,
                    trainee,
                    enrollment_map.get(trainee.id),
                    employment_map.get(trainee.id),
                )
                risk_scores.append(risk["score"])
                risk_drivers.update(risk["reasons"])
            average_risk = (
                round(sum(risk_scores) / len(risk_scores)) if risk_scores else 0
            )
            if average_risk >= 60:
                risk_level = "HIGH"
            elif average_risk >= 30:
                risk_level = "MEDIUM"
            else:
                risk_level = "LOW"
            latitudes = [
                item.latitude for item in district_trainees if item.latitude is not None
            ]
            longitudes = [
                item.longitude
                for item in district_trainees
                if item.longitude is not None
            ]
            result.append(
                DistrictAnalytics(
                    id=district.casefold().replace(" ", "-"),
                    name=district,
                    trained=len(district_ids),
                    placed=len(placed_ids),
                    employed_rate=_percentage(len(placed_ids), len(district_ids)),
                    self_employment_rate=_percentage(
                        len(self_employed_ids), len(placed_ids)
                    ),
                    retention_6m_rate=_percentage(len(retained_ids), len(placed_ids)),
                    median_wage=round(median(wages), 2) if wages else None,
                    top_risk_drivers=[item[0] for item in risk_drivers.most_common(3)],
                    risk_level=risk_level,
                    lat=round(sum(latitudes) / len(latitudes), 6)
                    if latitudes
                    else None,
                    lng=round(sum(longitudes) / len(longitudes), 6)
                    if longitudes
                    else None,
                    pending_verification=sum(
                        1 for record in district_placements if record.status in pending_statuses
                    ),
                    followup_due=int(district_followup_due),
                )
            )
        return DistrictsResponse(districts=result)

    def funnel(self) -> FunnelResponse:
        enrolled_ids = self._enrolled_trainee_ids()
        trained_ids = self.trained_trainee_ids()
        placement_records = self._placement_records(trained_ids)
        placed = self._unique_placed(placement_records)
        retained = self._retention_ids(
            placement_records, self.end_date or _today(), retention_days=365
        )
        stages = [
            FunnelStage(
                name="Enrolled",
                value=len(enrolled_ids),
                percentage=100.0 if enrolled_ids else 0.0,
            ),
            FunnelStage(
                name="Completed",
                value=len(trained_ids),
                percentage=_percentage(len(trained_ids), len(enrolled_ids)),
            ),
            FunnelStage(
                name="Placed",
                value=len(placed),
                percentage=_percentage(len(placed), len(trained_ids)),
            ),
            FunnelStage(
                name="Retained at 12 months",
                value=len(retained),
                percentage=_percentage(len(retained), len(trained_ids)),
            ),
        ]
        return FunnelResponse(stages=stages)

    def skill_gaps(self) -> SkillGapsResponse:
        trained_ids = self.trained_trainee_ids()
        supply_by_sector: dict[str, dict[UUID, set[str]]] = defaultdict(
            lambda: defaultdict(set)
        )
        if trained_ids:
            rows = self.db.execute(
                select(TrainingEnrollment, Course)
                .join(Course, TrainingEnrollment.course_id == Course.id)
                .where(
                    TrainingEnrollment.trainee_id.in_(trained_ids),
                    TrainingEnrollment.status == EnrollmentStatus.COMPLETED,
                )
            )
            for enrollment, course in rows:
                for skill in course.taught_skills:
                    supply_by_sector[course.sector][enrollment.trainee_id].add(
                        _normalise_skill(skill)
                    )

        demand_query = select(JobPostingDemand).where(
            JobPostingDemand.status == DemandStatus.ACTIVE
        )
        if self.filters.district:
            demand_query = demand_query.where(
                JobPostingDemand.district == self.filters.district
            )
        if self.start_date:
            demand_query = demand_query.where(
                JobPostingDemand.posted_at >= _day_start(self.start_date)
            )
        if self.end_date:
            demand_query = demand_query.where(
                JobPostingDemand.posted_at
                < _day_start(self.end_date + timedelta(days=1))
            )

        demand_by_sector: dict[str, Counter[str]] = defaultdict(Counter)
        canonical_names: dict[tuple[str, str], str] = {}
        for posting in self.db.scalars(demand_query):
            for skill in posting.skills_required:
                normalized = _normalise_skill(skill)
                demand_by_sector[posting.sector][normalized] += posting.headcount
                canonical_names.setdefault((posting.sector, normalized), skill.strip())

        sectors: list[SectorSkillGap] = []
        for sector, demand in demand_by_sector.items():
            supply = supply_by_sector.get(sector, {})
            skill_rows: list[SkillGap] = []
            for normalized_skill, demand_count in demand.items():
                supply_count = sum(
                    1 for skill_set in supply.values() if normalized_skill in skill_set
                )
                gap = max(0, demand_count - supply_count)
                skill_rows.append(
                    SkillGap(
                        skill=canonical_names.get(
                            (sector, normalized_skill), normalized_skill.title()
                        ),
                        supply=supply_count,
                        demand=demand_count,
                        gap=gap,
                        ratio=round(demand_count / max(supply_count, 1), 2),
                    )
                )
            skill_rows.sort(key=lambda item: (-item.gap, -item.demand, item.skill))
            sectors.append(SectorSkillGap(sector=sector, skills=skill_rows))
        sectors.sort(key=lambda item: item.sector)
        return SkillGapsResponse(sectors=sectors)

    def attrition(self) -> AttritionResponse:
        trained_ids = self.trained_trainee_ids()
        if not trained_ids:
            return AttritionResponse(total=0, reasons=[])
        query = select(EmploymentRecord).where(
            EmploymentRecord.trainee_id.in_(trained_ids),
            EmploymentRecord.ended_at.is_not(None),
            EmploymentRecord.status != EmploymentStatus.REJECTED,
        )
        if self.start_date:
            query = query.where(EmploymentRecord.ended_at >= self.start_date)
        if self.end_date:
            query = query.where(EmploymentRecord.ended_at <= self.end_date)
        reasons: Counter[str] = Counter()
        for record in self.db.scalars(query):
            reason = (record.exit_reason or "Not provided").strip() or "Not provided"
            reasons[reason] += 1
        total = sum(reasons.values())
        return AttritionResponse(
            total=total,
            reasons=[
                AttritionReason(
                    reason=reason,
                    count=count,
                    percentage=_percentage(count, total),
                )
                for reason, count in reasons.most_common()
            ],
        )

    def insights(self) -> InsightsResponse:
        overview = self.overview()
        district_data = self.districts().districts
        gaps = self.skill_gaps().sectors
        attrition = self.attrition()
        insights: list[Insight] = []

        if attrition.total >= 3 and attrition.reasons:
            leading_reason = attrition.reasons[0]
            insights.append(
                Insight(
                    id="attrition-drivers",
                    severity="high" if leading_reason.percentage >= 40 else "medium",
                    title=f"Attrition driver: {leading_reason.reason}",
                    summary="Recorded exit reasons identify a leading retention pressure point.",
                    evidence={
                        "total_attrition": attrition.total,
                        "leading_reason": leading_reason.reason,
                        "count": leading_reason.count,
                        "percentage": leading_reason.percentage,
                    },
                    recommendation="Review the leading exit reason with employers and add a targeted retention intervention.",
                    metric=f"{leading_reason.percentage}% of exits",
                )
            )

        if overview.total_trained:
            if overview.employed_rate < 75:
                insights.append(
                    Insight(
                        id="placement-rate",
                        severity="high" if overview.employed_rate < 50 else "medium",
                        title="Placement rate needs intervention",
                        summary="The selected cohort placement rate is below the programme target.",
                        evidence={
                            "trained": overview.total_trained,
                            "placed": overview.total_placed,
                            "rate": overview.employed_rate,
                        },
                        recommendation="Prioritise employer matching and verified outcome follow-up for unplaced trainees.",
                        metric=f"{overview.employed_rate}% placed",
                    )
                )
            if overview.retention_6m_rate < 70:
                insights.append(
                    Insight(
                        id="retention-6m",
                        severity="high"
                        if overview.retention_6m_rate < 50
                        else "medium",
                        title="Six-month retention is below target",
                        summary="A material share of placed trainees have not reached six months of retention.",
                        evidence={
                            "placed": overview.total_placed,
                            "retained_rate": overview.retention_6m_rate,
                        },
                        recommendation="Schedule wage and support check-ins before the six-month retention point.",
                        metric=f"{overview.retention_6m_rate}% retained",
                    )
                )

        ranked_gaps: list[tuple[str, SkillGap]] = []
        for sector_gap in gaps:
            ranked_gaps.extend(
                (sector_gap.sector, skill)
                for skill in sector_gap.skills
                if skill.gap > 0
            )
        for sector, skill in sorted(
            ranked_gaps, key=lambda item: (-item[1].gap, item[0])
        )[:3]:
            insights.append(
                Insight(
                    id=f"skill-gap-{_normalise_skill(sector)}-{_normalise_skill(skill.skill)}",
                    severity="high" if skill.gap >= max(10, skill.supply) else "medium",
                    title=f"Skill supply gap in {sector}",
                    summary=f"Demand for {skill.skill} exceeds the trained supply in the selected cohort.",
                    evidence={
                        "sector": sector,
                        "skill": skill.skill,
                        "supply": skill.supply,
                        "demand": skill.demand,
                        "gap": skill.gap,
                    },
                    recommendation=f"Add or expand {skill.skill} content and employer-linked practical training.",
                    metric=f"{skill.gap} person gap",
                    sector=sector,
                    district=self.filters.district,
                )
            )

        for district in sorted(
            district_data,
            key=lambda item: (
                -{"HIGH": 3, "MEDIUM": 2, "LOW": 1}[item.risk_level],
                item.name,
            ),
        )[:2]:
            if district.risk_level == "LOW":
                continue
            insights.append(
                Insight(
                    id=f"district-risk-{district.id}",
                    severity="high" if district.risk_level == "HIGH" else "medium",
                    title=f"Outcome risk concentrated in {district.name}",
                    summary="Verification, data freshness, wage, or skill-alignment signals require district action.",
                    evidence={
                        "trained": district.trained,
                        "placed": district.placed,
                        "risk_level": district.risk_level,
                        "top_risk_drivers": district.top_risk_drivers,
                    },
                    recommendation="Run a district follow-up camp focused on the leading risk drivers.",
                    metric=district.risk_level.title(),
                    district=district.name,
                )
            )

        trained_ids = self.trained_trainee_ids()
        pending_query = (
            select(func.count(EmploymentRecord.id))
            .join(Trainee, EmploymentRecord.trainee_id == Trainee.id)
            .where(
                EmploymentRecord.trainee_id.in_(trained_ids),
                EmploymentRecord.status.in_(
                    [EmploymentStatus.REPORTED, EmploymentStatus.PENDING]
                ),
            )
        )
        if self.filters.district:
            pending_query = pending_query.where(
                Trainee.district == self.filters.district
            )
        if self.start_date:
            pending_query = pending_query.where(
                EmploymentRecord.submitted_at >= _day_start(self.start_date)
            )
        if self.end_date:
            pending_query = pending_query.where(
                EmploymentRecord.submitted_at
                < _day_start(self.end_date + timedelta(days=1))
            )
        pending_verifications = self.db.scalar(pending_query) or 0
        if pending_verifications:
            insights.append(
                Insight(
                    id="pending-verifications",
                    severity="medium",
                    title="Employer verification backlog",
                    summary="Submitted employment outcomes are waiting for employer confirmation.",
                    evidence={"pending_records": int(pending_verifications)},
                    recommendation="Prioritise high-volume employers and recently submitted records.",
                    metric=f"{pending_verifications} pending",
                )
            )

        return InsightsResponse(insights=insights)
