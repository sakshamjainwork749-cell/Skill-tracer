from __future__ import annotations

import argparse
import hashlib
import random
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy import Engine, select

from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.models import (
    AuditLog,
    Course,
    Employer,
    EmploymentRecord,
    Followup,
    JobPostingDemand,
    Proof,
    Trainee,
    TrainingEnrollment,
    User,
    VerificationRecord,
)
from app.models.enums import (
    DemandStatus,
    EmploymentStatus,
    EnrollmentStatus,
    FollowupStatus,
    OutcomeType,
    ProofStatus,
    UserRole,
)

RANDOM_SEED = 20250308
DEMO_PASSWORD = "Demo@123"
NAMESPACE = NAMESPACE_URL
SYNTHETIC_DATA_VERSION = "2026.1"


def stable_id(kind: str, value: str | int) -> UUID:
    return uuid5(NAMESPACE, f"skilltrace:{kind}:{value}")


def seed_database(target_engine: Engine = engine, *, reset: bool = False) -> bool:
    """Populate deterministic, clearly synthetic demo data. Returns True when inserted.

    The fixture is designed to exercise realistic product journeys without
    representing real people, employers, contact details, or employment facts.
    """

    Base.metadata.create_all(bind=target_engine)
    with SessionLocal(bind=target_engine) as db:
        if reset:
            # Explicit CLI reset; startup never invokes this branch.
            for model in (
                AuditLog,
                VerificationRecord,
                Followup,
                Proof,
                EmploymentRecord,
                JobPostingDemand,
                TrainingEnrollment,
                Course,
                Trainee,
                Employer,
                User,
            ):
                db.query(model).delete()
            db.commit()
        elif db.scalar(select(User.id).limit(1)) is not None:
            return False

        rng = random.Random(RANDOM_SEED)
        today = datetime.now(UTC).date()
        password_hash = hash_password(DEMO_PASSWORD)

        admin_user = User(
            id=stable_id("user", "admin@skilltrace.in"),
            email="admin@skilltrace.in",
            hashed_password=password_hash,
            full_name="Aarav Deshmukh",
            role=UserRole.GOVERNMENT_ADMIN,
            phone="+91 20 5550 0100",
            is_active=True,
        )
        demo_trainee_user = User(
            id=stable_id("user", "trainee@skilltrace.in"),
            email="trainee@skilltrace.in",
            hashed_password=password_hash,
            full_name="Ananya Sharma",
            role=UserRole.TRAINEE,
            phone="+91 98765 12001",
            is_active=True,
        )
        demo_employer_user = User(
            id=stable_id("user", "employer@skilltrace.in"),
            email="employer@skilltrace.in",
            hashed_password=password_hash,
            full_name="Rohan Kulkarni",
            role=UserRole.EMPLOYER,
            phone="+91 98765 22001",
            is_active=True,
        )
        db.add_all([admin_user, demo_trainee_user, demo_employer_user])
        db.flush()

        district_data = {
            "Pune": (18.5204, 73.8567),
            "Nashik": (19.9975, 73.7898),
            "Gadchiroli": (20.2075, 80.0197),
            "Mumbai": (19.0760, 72.8777),
            "Chhatrapati Sambhajinagar": (19.8762, 75.3433),
        }

        course_blueprints = [
            (
                "ST-MFG-101",
                "CNC Manufacturing Technician",
                "Manufacturing",
                " Pune Technical Institute",
                "Pune",
                24,
                [
                    "CNC machining",
                    "quality inspection",
                    "production safety",
                    "read engineering drawings",
                ],
                "NSQF Level 4",
                2025,
            ),
            (
                "ST-MFG-201",
                "Advanced CNC Programming",
                "Manufacturing",
                "Aurangabad Industrial Academy",
                "Chhatrapati Sambhajinagar",
                32,
                [
                    "CNC programming",
                    "CAM software",
                    "quality inspection",
                    "production safety",
                ],
                "NSQF Level 5",
                2025,
            ),
            (
                "ST-HEALTH-101",
                "Community Health Assistant",
                "Healthcare",
                "Nashik Community Health Institute",
                "Nashik",
                36,
                ["patient care", "vital signs", "health records", "infection control"],
                "NSQF Level 4",
                2024,
            ),
            (
                "ST-HEALTH-201",
                "Primary Health Support",
                "Healthcare",
                "Mumbai Public Skills Centre",
                "Mumbai",
                28,
                ["patient care", "vital signs", "health records", "community outreach"],
                "NSQF Level 3",
                2025,
            ),
            (
                "ST-BUILD-101",
                "Mason and Shuttering Specialist",
                "Construction",
                "Gadchiroli Rural Skills Hub",
                "Gadchiroli",
                20,
                ["masonry", "shuttering", "construction safety", "material estimation"],
                "NSQF Level 3",
                2025,
            ),
            (
                "ST-BUILD-201",
                "Site Supervision Technician",
                "Construction",
                "Pune Construction Academy",
                "Pune",
                30,
                [
                    "construction safety",
                    "site supervision",
                    "material estimation",
                    "quality inspection",
                ],
                "NSQF Level 4",
                2025,
            ),
            (
                "ST-AGRI-101",
                "Farm Equipment Mechanic",
                "Agriculture",
                "Nashik Agri Skills Centre",
                "Nashik",
                18,
                [
                    "tractor maintenance",
                    "irrigation systems",
                    "farm safety",
                    "equipment diagnosis",
                ],
                "NSQF Level 3",
                2024,
            ),
            (
                "ST-AGRI-201",
                "Dairy and Agro Enterprise",
                "Agriculture",
                "Chhatrapati Sambhajinagar Agri Institute",
                "Chhatrapati Sambhajinagar",
                22,
                ["dairy management", "farm planning", "market linkage", "farm safety"],
                "NSQF Level 4",
                2025,
            ),
            (
                "ST-IT-101",
                "IT Help Desk Support",
                "Information Technology",
                "Mumbai Digital Skills Academy",
                "Mumbai",
                16,
                [
                    "hardware support",
                    "networking",
                    "troubleshooting",
                    "customer service",
                ],
                "NSQF Level 3",
                2025,
            ),
            (
                "ST-LOG-101",
                "Warehouse and Logistics Executive",
                "Logistics",
                "Pune Logistics Training Centre",
                "Pune",
                18,
                [
                    "warehouse operations",
                    "inventory management",
                    "logistics software",
                    "workplace safety",
                ],
                "NSQF Level 3",
                2025,
            ),
        ]
        courses: list[Course] = []
        for index, blueprint in enumerate(course_blueprints):
            (
                code,
                name,
                sector,
                institution,
                district,
                duration,
                skills,
                level,
                pass_year,
            ) = blueprint
            courses.append(
                Course(
                    id=stable_id("course", code),
                    course_code=code,
                    name=name,
                    sector=sector,
                    description=f"Practical competency-based training in {sector.lower()} with workplace assessment.",
                    institution_name=institution.strip(),
                    district=district,
                    duration_weeks=duration,
                    training_hours=duration * 40,
                    taught_skills=skills,
                    qualification_level=level,
                    pass_year=pass_year,
                    start_date=today - timedelta(days=420 - index * 8),
                    end_date=today - timedelta(days=365 - index * 8),
                    is_active=True,
                )
            )
        db.add_all(courses)

        employer_blueprints = [
            ("Sahyadri Precision Tools Pvt Ltd", "Manufacturing", "Pune", "EMP-MH-001"),
            (
                "Deccan Forge and Engineering Ltd",
                "Manufacturing",
                "Chhatrapati Sambhajinagar",
                "EMP-MH-002",
            ),
            ("Sanjivani Health Services", "Healthcare", "Nashik", "EMP-MH-003"),
            ("Aarogya Care Network", "Healthcare", "Mumbai", "EMP-MH-004"),
            ("BuildStrong Construction", "Construction", "Gadchiroli", "EMP-MH-005"),
            ("Prestige Urban Infra", "Construction", "Pune", "EMP-MH-006"),
            ("GreenHarvest Agri Solutions", "Agriculture", "Nashik", "EMP-MH-007"),
            (
                "Marathwada Dairy Cooperative",
                "Agriculture",
                "Chhatrapati Sambhajinagar",
                "EMP-MH-008",
            ),
            (
                "ConnectOne IT Services",
                "Information Technology",
                "Mumbai",
                "EMP-MH-009",
            ),
            ("QuickRoute Logistics", "Logistics", "Pune", "EMP-MH-010"),
            ("Konkan Logistics Solutions", "Logistics", "Mumbai", "EMP-MH-011"),
            (
                "Vidarbha Industrial Services",
                "Manufacturing",
                "Gadchiroli",
                "EMP-MH-012",
            ),
        ]
        employers: list[Employer] = []
        for index, (organization, sector, district, registration) in enumerate(
            employer_blueprints
        ):
            lat, lng = district_data[district]
            if index == 0:
                user = demo_employer_user
            else:
                user = User(
                    id=stable_id("user", f"employer{index}@skilltrace.in"),
                    email=f"employer{index}@skilltrace.in",
                    hashed_password=password_hash,
                    full_name=f"HR Manager {index + 1}",
                    role=UserRole.EMPLOYER,
                    phone=f"+91 90000 21{index:03d}",
                    is_active=True,
                )
                db.add(user)
            employer = Employer(
                id=stable_id("employer", registration),
                user_id=user.id,
                organization_name=organization,
                organization_type="Private limited"
                if "Ltd" in organization
                else "Registered enterprise",
                registration_number=registration,
                district=district,
                state="Maharashtra",
                address=f"Industrial/business area, {district}, Maharashtra",
                latitude=lat + rng.uniform(-0.08, 0.08),
                longitude=lng + rng.uniform(-0.08, 0.08),
                website=f"https://example.invalid/{index + 1}",
                is_verified=True,
                is_active=True,
            )
            employers.append(employer)
        db.add_all(employers)
        db.flush()

        employers_by_sector: dict[str, list[Employer]] = {}
        for employer in employers:
            sector = next(
                item[1]
                for item in employer_blueprints
                if item[0] == employer.organization_name
            )
            employers_by_sector.setdefault(sector, []).append(employer)

        first_names = [
            "Aarav",
            "Ananya",
            "Vivaan",
            "Saanvi",
            "Aditya",
            "Diya",
            "Arjun",
            "Ishita",
            "Kabir",
            "Meera",
            "Rohan",
            "Sneha",
            "Kiran",
            "Pooja",
            "Nikhil",
            "Aditi",
            "Omkar",
            "Riya",
            "Yash",
            "Kavya",
            "Samar",
            "Neha",
            "Aryan",
            "Shreya",
            "Ved",
            "Prisha",
            "Harsh",
            "Aisha",
            "Dev",
            "Rutu",
            "Manav",
            "Trisha",
        ]
        last_names = [
            "Patil",
            "Sharma",
            "Deshmukh",
            "Kulkarni",
            "Joshi",
            "Pawar",
            "Chavan",
            "Gaikwad",
            "Jadhav",
            "Kadam",
            "Sawant",
            "Salunkhe",
            "Bhosale",
            "Nair",
            "Rane",
            "Shinde",
        ]
        sector_roles = {
            "Manufacturing": [
                "CNC Machine Operator",
                "Production Technician",
                "Quality Inspector",
            ],
            "Healthcare": [
                "Community Health Assistant",
                "Patient Care Technician",
                "Health Records Assistant",
            ],
            "Construction": ["Mason", "Shuttering Worker", "Site Supervisor"],
            "Agriculture": [
                "Farm Equipment Mechanic",
                "Dairy Enterprise Supervisor",
                "Agri Technician",
            ],
            "Information Technology": [
                "IT Help Desk Associate",
                "Desktop Support Technician",
                "Network Support Assistant",
            ],
            "Logistics": [
                "Warehouse Executive",
                "Logistics Coordinator",
                "Inventory Assistant",
            ],
        }
        wage_bases = {
            "Manufacturing": 24500,
            "Healthcare": 19000,
            "Construction": 18000,
            "Agriculture": 16500,
            "Information Technology": 23000,
            "Logistics": 20000,
        }
        exit_reasons = [
            "Lower wage than expected",
            "Relocated for family reasons",
            "Seasonal work ended",
            "Better opportunity",
            "Workplace health issue",
            "Training mismatch",
        ]

        forced_statuses = [
            EmploymentStatus.VERIFIED,
            EmploymentStatus.REPORTED,
            EmploymentStatus.NEEDS_CORRECTION,
            EmploymentStatus.VERIFIED,
            EmploymentStatus.REPORTED,
            EmploymentStatus.PENDING,
        ]

        for index in range(64):
            district = list(district_data)[index % len(district_data)]
            lat, lng = district_data[district]
            if index < 6:
                course = courses[index]
            else:
                district_courses = [
                    item for item in courses if item.district == district
                ]
                course = district_courses[
                    (index + rng.randint(0, 1)) % len(district_courses)
                ]

            user = (
                demo_trainee_user
                if index == 0
                else User(
                    id=stable_id("user", f"trainee-{index}"),
                    # Non-deliverable identifiers ensure synthetic accounts can
                    # never become accidental email or WhatsApp recipients.
                    email=f"synthetic-trainee-{index}@example.invalid",
                    hashed_password=password_hash,
                    full_name=f"{first_names[index % len(first_names)]} {last_names[(index * 3) % len(last_names)]}",
                    role=UserRole.TRAINEE,
                    phone=f"DEMO-NOT-DELIVERABLE-{index:03d}",
                    is_active=True,
                )
            )
            if index != 0:
                db.add(user)
            db.flush()
            trainee = Trainee(
                id=stable_id("trainee", index),
                user_id=user.id,
                internal_identifier=f"MH-SK-2025-{index + 1:04d}",
                district=district,
                state="Maharashtra",
                address=f"Sector {index % 18 + 1}, {district}, Maharashtra",
                latitude=lat + rng.uniform(-0.12, 0.12),
                longitude=lng + rng.uniform(-0.12, 0.12),
                date_of_birth=date(
                    today.year - rng.randint(20, 38),
                    rng.randint(1, 12),
                    rng.randint(1, 28),
                ),
                gender=rng.choice(["Female", "Male", "Other"]),
                preferred_language=rng.choice(["Marathi", "Hindi", "English"]),
                consent_given=True,
                consent_given_at=datetime.now(UTC) - timedelta(days=400),
                consent_version="2025.1",
                data_processing_allowed=True,
                employer_verification_consent=True,
                followup_consent=(index % 4 != 3),
                email_followup_consent=(index % 3 != 2),
                whatsapp_followup_consent=(index % 3 != 0),
            )
            db.add(trainee)
            db.flush()

            completed = index >= 6 or rng.random() > 0.15
            completed_days_ago = rng.randint(35, 360)
            enrolled_days_ago = completed_days_ago + course.duration_weeks * 7
            enrollment = TrainingEnrollment(
                id=stable_id("enrollment", index),
                trainee_id=trainee.id,
                course_id=course.id,
                enrollment_code=f"ENR-2025-{index + 1:05d}",
                status=EnrollmentStatus.COMPLETED
                if completed
                else EnrollmentStatus.IN_PROGRESS,
                enrolled_at=today - timedelta(days=enrolled_days_ago),
                started_at=today - timedelta(days=enrolled_days_ago - 2),
                completed_at=today - timedelta(days=completed_days_ago)
                if completed
                else None,
                final_score=round(rng.uniform(58, 96), 1) if completed else None,
                certificate_number=f"MH-SKTC-{2025}-{index + 1:05d}"
                if completed
                else None,
                is_verified=completed,
            )
            db.add(enrollment)
            db.flush()

            if index < 6:
                outcome_type = OutcomeType.EMPLOYED
                status = forced_statuses[index]
            else:
                roll = rng.random()
                if roll < 0.09:
                    continue
                elif roll < 0.20:
                    outcome_type = OutcomeType.SEEKING_JOB
                elif roll < 0.34:
                    outcome_type = OutcomeType.SELF_EMPLOYED
                elif roll < 0.45:
                    outcome_type = OutcomeType.APPRENTICESHIP
                else:
                    outcome_type = OutcomeType.EMPLOYED
                status = rng.choices(
                    list(EmploymentStatus),
                    weights=[47, 10, 24, 12, 7],
                    k=1,
                )[0]

            start_days_ago = rng.randint(20, 720)
            if outcome_type == OutcomeType.SEEKING_JOB:
                start_date = today - timedelta(days=start_days_ago)
                ended_at = start_date
                is_current = False
            else:
                start_date = today - timedelta(days=start_days_ago)
                ended_at = None
                is_current = True
                if start_days_ago > 100 and rng.random() < 0.13:
                    ended_at = start_date + timedelta(
                        days=rng.randint(35, min(500, start_days_ago - 10))
                    )
                    is_current = False

            role = rng.choice(sector_roles[course.sector])
            base_wage = wage_bases[course.sector]
            wage = Decimal(base_wage + rng.randrange(-2500, 8500, 250))
            company = None
            matched_employer: Employer | None = None
            if outcome_type in {OutcomeType.EMPLOYED, OutcomeType.APPRENTICESHIP}:
                sector_employers = employers_by_sector[course.sector]
                matched_employer = sector_employers[index % len(sector_employers)]
                company = matched_employer.organization_name
            elif outcome_type == OutcomeType.SELF_EMPLOYED:
                company = f"{first_names[index % len(first_names)]} {'Enterprises' if index % 2 else 'Works'}"

            employment = EmploymentRecord(
                id=stable_id("employment", index),
                trainee_id=trainee.id,
                employer_id=matched_employer.id if matched_employer else None,
                outcome_type=outcome_type,
                status=status,
                role=role,
                company_name=company,
                start_date=start_date,
                ended_at=ended_at,
                is_current=is_current,
                wage_value=wage
                if outcome_type in {OutcomeType.EMPLOYED, OutcomeType.APPRENTICESHIP}
                else None,
                wage_band=(
                    "₹15k–₹20k"
                    if wage < 20000
                    else "₹20k–₹30k"
                    if wage < 30000
                    else "₹30k+"
                ),
                location=(
                    matched_employer.district if matched_employer else trainee.district
                ),
                business_type=(
                    rng.choice(
                        [
                            "Retail services",
                            "Food enterprise",
                            "Repair services",
                            "Digital services",
                        ]
                    )
                    if outcome_type == OutcomeType.SELF_EMPLOYED
                    else None
                ),
                monthly_revenue=(
                    Decimal(rng.randrange(25000, 180000, 5000))
                    if outcome_type == OutcomeType.SELF_EMPLOYED
                    else None
                ),
                employees_created=(
                    rng.randint(1, 8)
                    if outcome_type == OutcomeType.SELF_EMPLOYED
                    else None
                ),
                exit_reason=(
                    rng.choice(exit_reasons) if ended_at and not is_current else None
                ),
                submitted_at=datetime.now(UTC)
                - timedelta(days=max(0, start_days_ago - rng.randint(1, 10))),
                employer_confirmed_at=(
                    datetime.now(UTC) - timedelta(days=max(0, start_days_ago - 20))
                    if status
                    in {EmploymentStatus.VERIFIED, EmploymentStatus.NEEDS_CORRECTION}
                    else None
                ),
                employer_verified_by_id=(
                    (matched_employer.user_id if matched_employer else admin_user.id)
                    if status
                    in {EmploymentStatus.VERIFIED, EmploymentStatus.NEEDS_CORRECTION}
                    else None
                ),
                rating=(
                    rng.randint(3, 5) if status == EmploymentStatus.VERIFIED else None
                ),
                skill_alignment_feedback=(
                    {
                        "overall_alignment": rng.randint(3, 5),
                        "aligned_skills": course.taught_skills[:2],
                        "missing_skills": course.taught_skills[2:3],
                        "additional_comments": "Practical performance is consistent with the course.",
                    }
                    if status == EmploymentStatus.VERIFIED
                    else None
                ),
                correction_notes=(
                    "Please confirm the exact start date and wage."
                    if status == EmploymentStatus.NEEDS_CORRECTION
                    else None
                ),
            )
            db.add(employment)
            db.flush()

            has_proof = (
                outcome_type == OutcomeType.SELF_EMPLOYED
                or status
                in {EmploymentStatus.VERIFIED, EmploymentStatus.NEEDS_CORRECTION}
                or index % 9 == 0
            )
            if has_proof:
                proof = Proof(
                    id=stable_id("proof", index),
                    trainee_id=trainee.id,
                    employment_id=employment.id,
                    original_filename=f"outcome-proof-{index + 1}.pdf",
                    stored_filename=f"seed-proof-{index + 1}.pdf",
                    storage_path=f"seed/proof-{index + 1}.pdf",
                    mime_type="application/pdf",
                    file_size=rng.randint(120_000, 1_400_000),
                    sha256=hashlib.sha256(f"proof-{index}".encode()).hexdigest(),
                    status=ProofStatus.VERIFIED,
                    description="Offer letter, appointment letter, or enterprise registration evidence",
                    uploaded_at=employment.submitted_at + timedelta(hours=4),
                    verified_at=(
                        employment.employer_confirmed_at
                        if status == EmploymentStatus.VERIFIED
                        else employment.submitted_at + timedelta(days=1)
                    ),
                )
                db.add(proof)

            if status in {EmploymentStatus.VERIFIED, EmploymentStatus.NEEDS_CORRECTION}:
                db.add(
                    VerificationRecord(
                        id=stable_id("verification", index),
                        employment_id=employment.id,
                        verifier_id=matched_employer.user_id
                        if matched_employer
                        else admin_user.id,
                        status=status,
                        rating=employment.rating,
                        skill_alignment_feedback=employment.skill_alignment_feedback,
                        notes=employment.correction_notes,
                        evidence={"source": "synthetic demo verification; not real evidence"},
                        verified_at=employment.employer_confirmed_at,
                    )
                )

            completed_followup_date = min(
                start_date + timedelta(days=45), today - timedelta(days=1)
            )
            completed_followup_at = datetime.combine(
                completed_followup_date, datetime.min.time()
            ) + timedelta(hours=11)
            db.add(
                Followup(
                    id=stable_id("followup-completed", index),
                    trainee_id=trainee.id,
                    employment_id=employment.id,
                    created_by_id=admin_user.id,
                    status=FollowupStatus.COMPLETED,
                    scheduled_for=completed_followup_date,
                    completed_at=completed_followup_at,
                    contact_method=rng.choice(["PHONE", "WHATSAPP"]),
                    contact_outcome=rng.choice(
                        ["Still employed", "Support required", "Wage confirmed"]
                    ),
                    notes="Seed follow-up record",
                    next_followup_date=today + timedelta(days=rng.randint(30, 120)),
                )
            )
            # Retention needs longitudinal evidence, not only one generic
            # check-in. Add completed 3/6/12-month milestones when each date
            # has passed so analytics and demo journeys exercise all stages.
            for milestone, days in (("3-month", 90), ("6-month", 180), ("12-month", 365)):
                milestone_date = start_date + timedelta(days=days)
                if milestone_date > today:
                    continue
                retained_at_milestone = not (
                    ended_at is not None and ended_at <= milestone_date
                )
                db.add(
                    Followup(
                        id=stable_id("followup-retention", f"{index}-{days}"),
                        trainee_id=trainee.id,
                        employment_id=employment.id,
                        created_by_id=admin_user.id,
                        status=FollowupStatus.COMPLETED,
                        scheduled_for=milestone_date,
                        completed_at=datetime.combine(
                            milestone_date, datetime.min.time()
                        ) + timedelta(hours=10),
                        contact_method=(
                            "WHATSAPP" if trainee.whatsapp_followup_consent else "PHONE"
                        ),
                        channel=(
                            "WHATSAPP" if trainee.whatsapp_followup_consent else "PHONE"
                        ),
                        contact_outcome=(
                            "Employment continuing"
                            if retained_at_milestone
                            else "Employment changed before this check-in"
                        ),
                        notes=(
                            f"Synthetic {milestone} retention milestone; "
                            "not a real trainee record."
                        ),
                    )
                )
            next_status = FollowupStatus.SCHEDULED
            next_date = today + timedelta(days=rng.randint(20, 120))
            next_channel: str | None = None
            if index == 0:
                pass  # demo login account keeps an upcoming follow-up
            elif index % 5 == 0:
                next_date = today - timedelta(days=rng.randint(1, 10))  # overdue
            elif index % 5 == 1:
                next_status = FollowupStatus.DELIVERED
                next_date = today - timedelta(days=rng.randint(1, 20))
                next_channel = "WHATSAPP+EMAIL" if index % 2 else "EMAIL"
            elif index % 5 == 2:
                next_status = FollowupStatus.FAILED
                next_date = today - timedelta(days=rng.randint(1, 15))
                next_channel = "WHATSAPP"
            db.add(
                Followup(
                    id=stable_id("followup-next", index),
                    trainee_id=trainee.id,
                    employment_id=employment.id,
                    created_by_id=admin_user.id,
                    status=next_status,
                    scheduled_for=next_date,
                    contact_method="PHONE",
                    channel=next_channel,
                    attempt_count=1 if next_status != FollowupStatus.SCHEDULED else 0,
                    sent_at=(completed_followup_at if next_status
                             != FollowupStatus.SCHEDULED else None),
                    delivered_at=(completed_followup_at if next_status
                                  == FollowupStatus.DELIVERED else None),
                    failed_at=(completed_followup_at if next_status
                               == FollowupStatus.FAILED else None),
                    provider_message_id=(f"seed-{next_channel}-{index}"
                                         if next_channel else None),
                    last_error=("Seeded delivery failure (provider timeout)"
                                if next_status == FollowupStatus.FAILED else None),
                    notes=(
                        "Employer correction pending"
                        if status == EmploymentStatus.NEEDS_CORRECTION
                        else "Routine six-month retention check"
                    ),
                )
            )

            db.add(
                AuditLog(
                    id=stable_id("audit-outcome", index),
                    actor_id=user.id,
                    action="OUTCOME_CREATED",
                    entity_type="employment_record",
                    entity_id=str(employment.id),
                    details={"outcome_type": outcome_type.value, "source": "demo_seed"},
                    created_at=employment.submitted_at,
                )
            )

            if (
                index > 0
                and index % 7 == 0
                and outcome_type == OutcomeType.EMPLOYED
                and is_current
            ):
                previous_end = start_date - timedelta(days=rng.randint(30, 150))
                previous_start = previous_end - timedelta(days=rng.randint(180, 500))
                previous_employer = sector_employers[index % len(sector_employers)]
                db.add(
                    EmploymentRecord(
                        id=stable_id("employment-previous", index),
                        trainee_id=trainee.id,
                        employer_id=previous_employer.id,
                        outcome_type=OutcomeType.EMPLOYED,
                        status=EmploymentStatus.VERIFIED,
                        role=rng.choice(sector_roles[course.sector]),
                        company_name=previous_employer.organization_name,
                        start_date=previous_start,
                        ended_at=previous_end,
                        is_current=False,
                        wage_value=Decimal(base_wage + rng.randrange(-1500, 4500, 250)),
                        wage_band="₹15k–₹25k",
                        location=previous_employer.district,
                        exit_reason=rng.choice(exit_reasons),
                        submitted_at=datetime.combine(
                            previous_start, datetime.min.time()
                        )
                        + timedelta(hours=9),
                        employer_confirmed_at=datetime.combine(
                            previous_start, datetime.min.time()
                        )
                        + timedelta(days=2),
                        employer_verified_by_id=previous_employer.user_id,
                        rating=rng.randint(3, 4),
                    )
                )

        for index, course in enumerate(courses):
            district = [
                course.district,
                list(district_data)[(index + 2) % len(district_data)],
            ][0]
            sector_employers_for_demand = employers_by_sector[course.sector]
            employer = sector_employers_for_demand[
                index % len(sector_employers_for_demand)
            ]
            required_count = 1 + index % min(4, len(course.taught_skills))
            required = [
                course.taught_skills[position] for position in range(required_count)
            ]
            if index % 2:
                required.append("digital documentation")
            db.add(
                JobPostingDemand(
                    id=stable_id("demand", index),
                    employer_id=employer.id,
                    posted_by_id=employer.user_id,
                    title=f"{course.sector} vacancies ({index + 1})",
                    sector=course.sector,
                    description=f"Employer demand for entry-level {course.sector.lower()} talent.",
                    district=district,
                    skills_required=required,
                    headcount=3 + (index * 2) % 11,
                    min_monthly_wage=Decimal(wage_bases[course.sector] - 1000),
                    max_monthly_wage=Decimal(wage_bases[course.sector] + 9000),
                    work_mode="On-site",
                    status=DemandStatus.ACTIVE,
                    posted_at=datetime.now(UTC) - timedelta(days=rng.randint(5, 120)),
                    closes_at=today + timedelta(days=rng.randint(20, 120)),
                )
            )

        db.add(
            AuditLog(
                id=stable_id("audit", "demo-seed"),
                actor_id=admin_user.id,
                action="DEMO_DATA_SEEDED",
                entity_type="system",
                entity_id=RANDOM_SEED,
                details={
                    "trainees": 64,
                    "districts": list(district_data),
                    "courses": len(courses),
                    "employers": len(employers),
                    "seed": RANDOM_SEED,
                    "synthetic_data_version": SYNTHETIC_DATA_VERSION,
                    "notice": "All records are fictional, non-deliverable demo data.",
                },
                created_at=datetime.now(UTC),
            )
        )
        db.commit()
        return True


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed the SkillTrace prototype database"
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing application data before seeding",
    )
    args = parser.parse_args()
    # Importing Base metadata here also makes this script safe on a fresh database.
    _ = Base
    Base.metadata.create_all(bind=engine)
    inserted = seed_database(engine, reset=args.reset)
    print(
        "Demo data seeded."
        if inserted
        else "Database already contains data; nothing changed."
    )


if __name__ == "__main__":
    main()
