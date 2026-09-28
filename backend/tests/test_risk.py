from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import EmploymentRecord, Proof, Trainee, TrainingEnrollment, User
from app.models.enums import EmploymentStatus, ProofStatus
from app.services.risk import calculate_risk, confidence_for_outcome


def test_confidence_is_exactly_60_or_95():
    self_report = EmploymentRecord(status=EmploymentStatus.REPORTED)
    proof = Proof(status=ProofStatus.UPLOADED)
    employer_verified = EmploymentRecord(status=EmploymentStatus.VERIFIED)

    assert confidence_for_outcome(self_report) == 60
    assert confidence_for_outcome(self_report, [proof]) == 95
    assert confidence_for_outcome(employer_verified) == 95
    assert confidence_for_outcome(None) == 60


def test_risk_engine_combines_verification_freshness_wage_and_relevance():
    with SessionLocal() as db:
        trainee = db.scalar(
            select(Trainee)
            .join(User, Trainee.user_id == User.id)
            .where(User.email == "trainee@skilltrace.in")
        )
        assert trainee is not None
        enrollment = db.scalar(
            select(TrainingEnrollment).where(
                TrainingEnrollment.trainee_id == trainee.id
            )
        )
        employment = db.scalar(
            select(EmploymentRecord).where(EmploymentRecord.trainee_id == trainee.id)
        )
        risk = calculate_risk(db, trainee, enrollment, employment)
        assert risk["level"] in {"LOW", "MEDIUM", "HIGH"}
        assert 0 <= int(risk["score"]) <= 100
        assert risk["reasons"]
