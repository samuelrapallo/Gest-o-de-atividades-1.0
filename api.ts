
import { Task } from './types';

const STORAGE_KEY = 'gestor_executivo_cloud_v2';
const SYNC_CHANNEL = 'gestor_executivo_sync';

// Canal para comunicação instantânea entre abas no mesmo navegador
const broadcast = new BroadcastChannel(SYNC_CHANNEL);

export const api = {
  // Notifica outras abas que os dados mudaram
  notifyChange() {
    broadcast.postMessage('update');
  },

  // Escuta mudanças vindas de outras abas
  onExternalChange(callback: () => void) {
    broadcast.onmessage = (event) => {
      if (event.data === 'update') callback();
    };
  },

  async fetchTasks(): Promise<{tasks: Task[], updatedAt: number}> {
    return new Promise((resolve) => {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return resolve({ tasks: [], updatedAt: 0 });
        const parsed = JSON.parse(data);
        resolve({
          tasks: parsed.tasks || [],
          updatedAt: parsed.updatedAt || 0
        });
      } catch (e) {
        console.error("Erro ao carregar nuvem:", e);
        resolve({ tasks: [], updatedAt: 0 });
      }
    });
  },

  async saveTasks(tasks: Task[]): Promise<number> {
    return new Promise((resolve) => {
      const timestamp = Date.now();
      try {
        const data = JSON.stringify({ tasks, updatedAt: timestamp });
        localStorage.setItem(STORAGE_KEY, data);
        this.notifyChange(); // Sincroniza abas locais
      } catch (e) {
        console.error("Erro ao salvar na nuvem:", e);
      }
      resolve(timestamp);
    });
  },

  async clearCloud(): Promise<void> {
    return new Promise((resolve) => {
      localStorage.removeItem(STORAGE_KEY);
      this.notifyChange();
      resolve();
    });
  }
};
