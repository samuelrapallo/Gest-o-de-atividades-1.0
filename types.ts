
export enum TaskStatus {
  PENDING = 'Pendente',
  COMPLETED = 'Concluído',
  RESCHEDULED = 'Reprogramado'
}

export interface Task {
  id: string;
  activity: string;
  orderNumber: string;
  performer: string;
  date: string;
  status: TaskStatus;
  observations: string;
  updatedBy?: string;
  updatedAt?: number;
}

export interface DashboardStats {
  name: string;
  value: number;
  color: string;
}
