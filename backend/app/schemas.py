from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr


class ProfileBase(BaseModel):
    telefone: Optional[str] = None
    especialidade: Optional[str] = None
    crp_crm: Optional[str] = None
    codigo: Optional[str] = None
    is_medico: bool = False


class Profile(ProfileBase):
    id: int
    class Config:
        from_attributes = True


class UserBase(BaseModel):
    email: EmailStr
    nome: str
    role: str


class User(UserBase):
    id: int
    created_at: datetime
    profile: Optional[Profile]

    class Config:
        from_attributes = True


class DailyRecordBase(BaseModel):
    data: date
    mood: int
    sleep: int
    energy: int
    medication_adherence: float


class DailyRecord(DailyRecordBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DailyRecordCreate(DailyRecordBase):
    pass


class LinkRequest(BaseModel):
    id: int
    status: str
    created_at: datetime
    professional_id: int
    patient_id: int

    class Config:
        from_attributes = True


class ClinicalAlert(BaseModel):
    id: int
    severity: str
    created_at: datetime
    record_id: int

    class Config:
        from_attributes = True


class ProfessionalInfo(BaseModel):
    id: int
    nome: str
    especialidade: Optional[str]
    codigo: Optional[str]
    is_medico: bool


class DashboardData(BaseModel):
    totalPatients: int
    activePatients: int
    responseRate: float
    recentAlerts: List[ClinicalAlert]
    recentPatients: List[User]
    upcomingAppointments: int
    todayRecords: int


class PatientDashboard(BaseModel):
    professionals: List[ProfessionalInfo] = []
    recentRecords: List[DailyRecord] = []
    linkRequests: List[LinkRequest] = []


class DashboardResponse(BaseModel):
    dashboard: DashboardData
    patientData: Optional[PatientDashboard] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SignupRequest(LoginRequest):
    nome: str
    role: str = "paciente"
    especialidade: Optional[str] = None
    crp_crm: Optional[str] = None
