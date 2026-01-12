
import { Task } from './types';

const STORAGE_PREFIX = 'gestor_executivo_v5_';
const SYNC_CHANNEL_NAME = 'gestor_executivo_sync_v5';

const getWorkspaceId = (): string => {
  try {
    const params = new URLSearchParams(window.location.search);
    let ws = params.get('ws');
    if (!ws) {
      ws = Math.random().toString(36).substring(2, 10);
      params.set('ws', ws);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({ ws }, '', newUrl);
    }
    return ws;
  } catch (e) {
    return 'default';
  }
};

const WS_ID = getWorkspaceId();
const STORAGE_KEY = `${STORAGE_PREFIX}${WS_ID}`;

// Canal de comunicação para abas abertas no mesmo navegador
let broadcast: BroadcastChannel | null = null;
try {
  broadcast = new BroadcastChannel(`${SYNC_CHANNEL_NAME}_${WS_ID}`);
} catch (e) {
  console.warn("Ambiente não suporta BroadcastChannel.");
}

export const api = {
  getWsId() { return WS_ID; },
  getWsLink() { return window.location.href; },

  notifyChange() {
    if (broadcast) broadcast.postMessage('update');
  },

  onExternalChange(callback: () => void) {
    if (broadcast) {
      broadcast.onmessage = (event) => {
        if (event.data === 'update') callback();
      };
    }
    // Sincroniza via evento de storage (mesmo domínio)
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) callback();
    });
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
        resolve({ tasks: [], updatedAt: 0 });
      }
    });
  },

  async saveTasks(tasks: Task[]): Promise<number> {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      try {
        const data = JSON.stringify({ tasks, updatedAt: timestamp });
        localStorage.setItem(STORAGE_KEY, data);
        this.notifyChange();
        resolve(timestamp);
      } catch (e) {
        console.error("Erro ao salvar:", e);
        reject(e);
      }
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
