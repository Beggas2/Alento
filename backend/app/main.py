from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from . import models, schemas
from .database import Base, SessionLocal, engine

SECRET_KEY = "super-secret-change-me"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


Base.metadata.create_all(bind=engine)

app = FastAPI(title="Alento FastAPI Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


models.seed_database(SessionLocal())


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/auth/signup", response_model=schemas.AuthResponse)
def signup(payload: schemas.SignupRequest, db: Session = Depends(get_db)):
    existing = get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Usuário já existe")

    user = models.User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        nome=payload.nome,
        role=payload.role,
    )
    profile = models.Profile(
        user=user,
        especialidade=payload.especialidade,
        crp_crm=payload.crp_crm,
        codigo=f"AUTO-{payload.role[:3].upper()}-{int(datetime.utcnow().timestamp())}",
        is_medico=payload.role == "profissional",
    )

    db.add_all([user, profile])
    if payload.role == "paciente":
        db.add(models.Patient(user=user))
    else:
        db.add(models.Professional(user=user))
    db.commit()
    db.refresh(user)

    access_token = create_access_token({"sub": str(user.id)})
    return schemas.AuthResponse(access_token=access_token, user=user)


@app.post("/auth/login", response_model=schemas.AuthResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = get_user_by_email(db, form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Credenciais inválidas")

    access_token = create_access_token({"sub": str(user.id)})
    return schemas.AuthResponse(access_token=access_token, user=user)


@app.get("/auth/me", response_model=schemas.User)
def get_profile(current_user: models.User = Depends(get_current_user)):
    return current_user


@app.get("/dashboard", response_model=schemas.DashboardResponse)
def get_dashboard(role: str = "profissional", db: Session = Depends(get_db)):
    total_patients = db.query(models.Patient).count()
    active_patients = db.query(models.PatientProfessional).filter(models.PatientProfessional.status == "active").count()
    response_rate = 92.5

    alerts = db.query(models.ClinicalAlert).order_by(models.ClinicalAlert.created_at.desc()).limit(5).all()
    recent_alerts = [schemas.ClinicalAlert.model_validate(alert) for alert in alerts]

    recent_patients = db.query(models.User).filter(models.User.role == "paciente").order_by(models.User.created_at.desc()).limit(5)

    today_records = db.query(models.DailyRecord).filter(models.DailyRecord.data == datetime.utcnow().date()).count()

    dashboard = schemas.DashboardData(
        totalPatients=total_patients,
        activePatients=active_patients,
        responseRate=response_rate,
        recentAlerts=recent_alerts,
        recentPatients=[schemas.User.model_validate(user) for user in recent_patients],
        upcomingAppointments=3,
        todayRecords=today_records,
    )

    patient_data = None
    if role == "paciente":
        professionals = db.query(models.PatientProfessional).all()
        professional_info = [
            schemas.ProfessionalInfo(
                id=link.professional.id,
                nome=link.professional.user.nome,
                especialidade=link.professional.user.profile.especialidade if link.professional.user.profile else None,
                codigo=link.professional.user.profile.codigo if link.professional.user.profile else None,
                is_medico=bool(link.professional.user.profile.is_medico) if link.professional.user.profile else False,
            )
            for link in professionals
        ]
        recent_records = db.query(models.DailyRecord).order_by(models.DailyRecord.created_at.desc()).limit(5).all()
        link_requests = db.query(models.LinkRequest).order_by(models.LinkRequest.created_at.desc()).limit(5).all()

        patient_data = schemas.PatientDashboard(
            professionals=professional_info,
            recentRecords=[schemas.DailyRecord.model_validate(record) for record in recent_records],
            linkRequests=[schemas.LinkRequest.model_validate(req) for req in link_requests],
        )

    return schemas.DashboardResponse(dashboard=dashboard, patientData=patient_data)


@app.post("/records", response_model=schemas.DailyRecord)
def create_record(
    record: schemas.DailyRecord,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    patient = db.query(models.Patient).filter(models.Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")

    new_record = models.DailyRecord(
        patient=patient,
        data=record.data,
        mood=record.mood,
        sleep=record.sleep,
        energy=record.energy,
        medication_adherence=record.medication_adherence,
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return schemas.DailyRecord.model_validate(new_record)
