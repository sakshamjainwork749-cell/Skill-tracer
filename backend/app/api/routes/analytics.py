from __future__ import annotations

import csv
import io
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse, Response

from app.api.deps import CurrentAdmin, DbSession
from app.core.config import get_settings
from app.core.responses import success
from app.services.analytics import (
    AnalyticsFilters,
    AnalyticsService,
    resolve_date_range,
)
from app.services.report_pdf import build_report_pdf

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def analytics_filters(
    period: Annotated[
        str | None,
        Query(description="Relative period such as 30d, 90d, or 12m", max_length=16),
    ] = None,
    district: Annotated[str | None, Query(max_length=100)] = None,
    start_date: date | None = None,
    end_date: date | None = None,
    lens: Annotated[
        str | None,
        Query(description="Reporting lens, e.g. outcomes or verification", max_length=32),
    ] = None,
) -> AnalyticsFilters:
    filters = AnalyticsFilters(
        period=period,
        district=district.strip() if district else None,
        start_date=start_date,
        end_date=end_date,
        lens=lens.strip() if lens else None,
    )
    try:
        # Resolve during dependency processing so malformed filters consistently
        # return the standard API error envelope.
        resolve_date_range(filters)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return filters


AnalyticsFilterDependency = Annotated[AnalyticsFilters, Depends(analytics_filters)]


def _service(db: DbSession, filters: AnalyticsFilters) -> AnalyticsService:
    return AnalyticsService(db, filters, get_settings().province)


@router.get("/overview", response_model=None)
def overview(
    db: DbSession,
    current_admin: CurrentAdmin,
    filters: AnalyticsFilterDependency,
):
    return success(_service(db, filters).overview())


@router.get("/districts", response_model=None)
def districts(
    db: DbSession,
    current_admin: CurrentAdmin,
    filters: AnalyticsFilterDependency,
):
    return success(_service(db, filters).districts())


@router.get("/funnel", response_model=None)
def funnel(
    db: DbSession,
    current_admin: CurrentAdmin,
    filters: AnalyticsFilterDependency,
):
    return success(_service(db, filters).funnel())


@router.get("/skill-gaps", response_model=None)
def skill_gaps(
    db: DbSession,
    current_admin: CurrentAdmin,
    filters: AnalyticsFilterDependency,
):
    return success(_service(db, filters).skill_gaps())


@router.get("/attrition", response_model=None)
def attrition(
    db: DbSession,
    current_admin: CurrentAdmin,
    filters: AnalyticsFilterDependency,
):
    return success(_service(db, filters).attrition())


@router.get("/insights", response_model=None)
def insights(
    db: DbSession,
    current_admin: CurrentAdmin,
    filters: AnalyticsFilterDependency,
):
    return success(_service(db, filters).insights())


@router.get("/export", response_model=None)
def export_report(
    db: DbSession,
    current_admin: CurrentAdmin,
    filters: AnalyticsFilterDependency,
):
    """CSV export of district-level aggregates (no trainee PII)."""
    service = _service(db, filters)
    overview = service.overview()
    district_rows = service.districts().districts
    stamp = datetime.now(UTC).date().isoformat()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["# SkillTrace outcome report", stamp])
    writer.writerow(["# filters",
                     f"district={filters.district or 'all'}",
                     f"period={filters.period or 'all'}",
                     f"start_date={filters.start_date or ''}",
                     f"end_date={filters.end_date or ''}",
                     f"lens={filters.lens or 'outcomes'}"])
    writer.writerow(["metric", "value"])
    writer.writerow(["total_trained", overview.total_trained])
    writer.writerow(["total_placed", overview.total_placed])
    writer.writerow(["employed_rate", overview.employed_rate])
    writer.writerow(["retention_6m_rate", overview.retention_6m_rate])
    writer.writerow(["median_monthly_wage", overview.median_monthly_wage])
    writer.writerow(["province", overview.province])
    writer.writerow([])
    writer.writerow(["district", "trained", "placed", "placement_rate",
                     "employed_rate", "retention_6m", "self_employment_rate",
                     "median_wage", "risk_level"])
    for d in district_rows:
        writer.writerow([d.name, d.trained, d.placed, d.employed_rate,
                         d.employed_rate, d.retention_6m_rate,
                         d.self_employment_rate, d.median_wage, d.risk_level])
    return PlainTextResponse(
        "\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition":
                 f"attachment; filename=skilltrace_outcome_report_{stamp}.csv"},
    )


@router.get("/export-pdf", response_model=None)
def export_report_pdf(
    db: DbSession,
    current_admin: CurrentAdmin,
    filters: AnalyticsFilterDependency,
):
    """PDF export of district-level aggregates (no trainee PII)."""
    service = _service(db, filters)
    overview = service.overview()
    district_rows = service.districts().districts
    stamp = datetime.now(UTC).date().isoformat()
    skill_sections: list[str] = []
    for sector in service.skill_gaps().sectors:
        top = max(sector.skills, key=lambda item: (item.gap, item.demand), default=None)
        if top is None:
            continue
        skill_sections.append(
            f"{sector.sector}: top gap {top.skill} "
            f"(supply {top.supply}, demand {top.demand}, gap {top.gap})"
        )
    insight_lines = [
        f"[{insight.severity}] {insight.title} - {insight.metric}"
        for insight in service.insights().insights[:8]
    ]
    pdf = build_report_pdf(
        title="SkillTrace - Maharashtra Outcome Report",
        filters=[f"District: {filters.district or 'All Maharashtra'}",
                 f"Period: {filters.period or 'All time'}",
                 f"Date range: {filters.start_date or '-'} to {filters.end_date or '-'}",
                 f"Reporting lens: {filters.lens or 'outcomes'}"],
        generated_at=f"{stamp} (UTC)",
        summary_rows=[
            ("Trained", str(overview.total_trained)),
            ("Placed", str(overview.total_placed)),
            ("Employed rate (%)", str(overview.employed_rate)),
            ("6M retention rate (%)", str(overview.retention_6m_rate)),
            ("Median monthly wage", str(overview.median_monthly_wage)),
            ("Pending verification", str(overview.pending_verification)),
            ("Self-employed", str(overview.self_employed)),
            ("Province", overview.province),
        ],
        district_rows=[
            [d.name, str(d.trained), str(d.placed), f"{d.employed_rate}%",
             f"{d.retention_6m_rate}%", f"{d.self_employment_rate}%",
             str(d.median_wage), d.risk_level]
            for d in district_rows
        ],
        extra_sections=[
            ("Skill-gap summary", skill_sections or ["No skill-gap data for the selected filters."]),
            ("Risk and insight summary", insight_lines or ["No insights for the selected filters."]),
        ],
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition":
                 f"attachment; filename=skilltrace_outcome_report_{stamp}.pdf"},
    )
