import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

export interface DashboardResponse {
  dashboard: {
    totalPatients: number;
    activePatients: number;
    responseRate: number;
    recentAlerts: { id: number; severity: string; created_at: string; record_id: number }[];
    recentPatients: { id: number; nome: string; email: string }[];
    upcomingAppointments: number;
    todayRecords: number;
  };
  patientData?: {
    professionals: { id: number; nome: string; especialidade?: string | null; codigo?: string | null; is_medico: boolean }[];
    recentRecords: { id: number; data: string; mood: number; sleep: number; energy: number; medication_adherence: number }[];
    linkRequests: { id: number; status: string; created_at: string }[];
  };
}

export const fetchDashboard = async (role: string) => {
  const response = await apiClient.get<DashboardResponse>("/dashboard", { params: { role } });
  return response.data;
};

export const fetchHealth = async () => {
  const response = await apiClient.get<{ status: string }>("/health");
  return response.data;
};
