
import { Task, TaskStatus } from './types';

// Simulador de Banco de Dados (Pronto para substituir por Supabase/Firebase)
const STORAGE_KEY = 'cloud_tasks_mock';

export const api = {
  // Busca todas as tarefas do "servidor"
  async fetchTasks(): Promise<Task[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const data = localStorage.getItem(STORAGE_KEY);
        resolve(data ? JSON.parse(data) : []);
      }, 800); // Simula latência de rede
    });
  },

  // Salva ou atualiza uma tarefa no "banco de dados"
  async saveTasks(tasks: Task[]): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        resolve();
      }, 500);
    });
  },

  // Atualiza apenas uma tarefa (Patch)
  async updateTask(id: string, updates: Partial<Task>): Promise<Task[]> {
    const tasks = await this.fetchTasks();
    const newTasks = tasks.map(t => 
      t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
    );
    await this.saveTasks(newTasks);
    return newTasks;
  },

  // Remove todos os dados
  async deleteAllTasks(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        localStorage.removeItem(STORAGE_KEY);
        resolve();
      }, 400);
    });
  }
};
