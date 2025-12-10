from datetime import datetime, timedelta
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    nome = Column(String, nullable=False)
    role = Column(String, default="paciente")
    created_at = Column(DateTime, default=datetime.utcnow)

    profile = relationship("Profile", back_populates="user", uselist=False)


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    telefone = Column(String, nullable=True)
    especialidade = Column(String, nullable=True)
    crp_crm = Column(String, nullable=True)
    codigo = Column(String, nullable=True)
    is_medico = Column(Boolean, default=False)

    user = relationship("User", back_populates="profile")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    records = relationship("DailyRecord", back_populates="patient")
    professionals = relationship("PatientProfessional", back_populates="patient")


class Professional(Base):
    __tablename__ = "professionals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    patients = relationship("PatientProfessional", back_populates="professional")


class PatientProfessional(Base):
    __tablename__ = "patient_professionals"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    professional_id = Column(Integer, ForeignKey("professionals.id"))
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="professionals")
    professional = relationship("Professional", back_populates="patients")


class DailyRecord(Base):
    __tablename__ = "daily_records"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    data = Column(Date, default=datetime.utcnow)
    mood = Column(Integer, default=5)
    sleep = Column(Integer, default=7)
    energy = Column(Integer, default=6)
    medication_adherence = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="records")


class ClinicalAlert(Base):
    __tablename__ = "clinical_alerts"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("daily_records.id"))
    profissional_id = Column(Integer, ForeignKey("professionals.id"))
    severity = Column(String, default="medium")
    created_at = Column(DateTime, default=datetime.utcnow)

    record = relationship("DailyRecord")
    professional = relationship("Professional")


class LinkRequest(Base):
    __tablename__ = "link_requests"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    professional_id = Column(Integer, ForeignKey("professionals.id"))
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient")
    professional = relationship("Professional")


def seed_database(session):
    """Create a handful of records so the frontend has something to render."""
    if session.query(User).first():
        return

    from passlib.context import CryptContext

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    # Professionals
    prof_user = User(
        email="dra.ana@example.com",
        hashed_password=pwd_context.hash("password"),
        nome="Dra. Ana Silva",
        role="profissional",
    )
    prof_profile = Profile(
        user=prof_user,
        especialidade="psiquiatria",
        crp_crm="12345",
        codigo="PROF-ANA",
        is_medico=True,
    )
    professional = Professional(user=prof_user)

    # Patients
    patient_user = User(
        email="joao@example.com",
        hashed_password=pwd_context.hash("password"),
        nome="João Santos",
        role="paciente",
    )
    patient_profile = Profile(user=patient_user, codigo="PAC-JS")
    patient = Patient(user=patient_user)

    link = PatientProfessional(patient=patient, professional=professional, status="active")

    # Daily records
    today = datetime.utcnow().date()
    records = [
        DailyRecord(patient=patient, data=today - timedelta(days=i), mood=7 - i % 3, sleep=7, energy=6)
        for i in range(3)
    ]

    alerts = [
        ClinicalAlert(record=records[0], profissional_id=1, severity="high"),
        ClinicalAlert(record=records[1], profissional_id=1, severity="medium"),
    ]

    session.add_all([
        prof_user,
        prof_profile,
        professional,
        patient_user,
        patient_profile,
        patient,
        link,
        *records,
        *alerts,
        LinkRequest(patient=patient, professional=professional, status="pending"),
    ])
    session.commit()
