
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  PlusIcon, 
  TrashIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  MagnifyingGlassIcon, 
  ArrowDownTrayIcon, 
  FunnelIcon, 
  XMarkIcon, 
  ExclamationCircleIcon, 
  ClipboardDocumentListIcon, 
  CalendarIcon, 
  ChartBarIcon, 
  UserGroupIcon,
  ShareIcon,
  LockClosedIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Legend, 
  LabelList 
} from 'recharts';
import { Task, TaskStatus } from './types';
import ObservationModal from './components/ObservationModal';

// Robust Unicode Base64 encoding
const encodeData = (data: any): string => {
  try {
    const jsonStr = JSON.stringify(data);
    const bytes = new TextEncoder().encode(jsonStr);
    const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return btoa(binString);
  } catch (e) {
    console.error("Erro ao codificar dados para URL", e);
    return "";
  }
};

// Robust Unicode Base64 decoding
const decodeData = (hash: string): any => {
  try {
    const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
    if (!cleanHash) return null;
    const binString = atob(cleanHash);
    const bytes = Uint8Array.from(binString, (char) => char.charCodeAt(0));
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Erro ao decodificar dados da URL", e);
    return null;
  }
};

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const fromHash = decodeData(window.location.hash);
      if (Array.isArray(fromHash) && fromHash.length > 0) return fromHash;
      
      const saved = localStorage.getItem('executive_tasks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Erro na inicialização do estado", e);
    }
    return [];
  });

  const [history, setHistory] = useState<Task[][]>([]);
  const [filter, setFilter] = useState('');
  const [selectedPerformer, setSelectedPerformer] = useState('Todos');
  const [activeModal, setActiveModal] = useState<{ taskId: string, type: TaskStatus } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // Sync state to URL and LocalStorage
  useEffect(() => {
    if (tasks.length > 0) {
      try {
        localStorage.setItem('executive_tasks', JSON.stringify(tasks));
        const hash = encodeData(tasks);
        // Browser URL limit is usually around 16KB-32KB for sharing safely
        // We limit to 14,000 chars to be safe with replaceState
        if (hash && hash.length < 14000) {
          window.history.replaceState(null, "", `#${hash}`);
        } else if (hash.length >= 14000) {
          console.warn("Planilha muito grande para sincronizar via URL. Dados salvos localmente.");
        }
      } catch (e) {
        console.error("Erro ao sincronizar dados", e);
      }
    }
  }, [tasks]);

  const saveToHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-10), [...tasks]]);
  }, [tasks]);

  const handleGoogleLogin = () => {
    setNotification({ message: 'Autenticando...', type: 'success' });
    setTimeout(() => {
      setIsAdmin(true);
      setShowLogin(false);
      setNotification({ message: 'Modo Administrador Ativado', type: 'success' });
    }, 1000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        const newTasks: Task[] = [];
        const firstLine = lines[0] || '';
        const delimiter = firstLine.includes(';') ? ';' : ',';

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const parts = line.split(delimiter).map(s => s.trim().replace(/^"|"$/g, ''));
          
          const [activity, orderNumber, date, performer] = parts;
          
          if (activity && performer) {
            newTasks.push({
              id: generateUUID(),
              activity,
              orderNumber: orderNumber || 'N/A',
              performer: performer,
              date: date || new Date().toLocaleDateString(),
              status: TaskStatus.PENDING,
              observations: ''
            });
          }
        }

        if (newTasks.length > 0) {
          saveToHistory();
          setTasks(newTasks);
          setNotification({ message: `${newTasks.length} atividades carregadas!`, type: 'success' });
        } else {
          setNotification({ message: 'Arquivo CSV inválido.', type: 'error' });
        }
      } catch (err) {
        setNotification({ message: 'Erro ao ler arquivo.', type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const generateShareLink = () => {
    const hash = encodeData(tasks);
    if (hash && hash.length > 14000) {
      setNotification({ message: 'Planilha muito grande para compartilhar via link.', type: 'error' });
      return;
    }
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setNotification({ message: 'Link atualizado copiado!', type: 'success' });
    });
  };

  const exportReport = () => {
    if (tasks.length === 0) return;
    try {
      let html = `<html><head><meta charset="UTF-8"></head><body><table>
        <thead><tr><th>Status</th><th>Atividade</th><th>Ordem</th><th>Data</th><th>Executante</th><th>Observações</th></tr></thead>
        <tbody>${tasks.map(t => `<tr><td>${t.status}</td><td>${t.activity}</td><td>${t.orderNumber}</td><td>${t.date}</td><td>${t.performer}</td><td>${t.observations}</td></tr>`).join('')}</tbody>
      </table></body></html>`;
      const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gestao_executiva_${new Date().getTime()}.xls`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setNotification({ message: 'Erro ao exportar relatório.', type: 'error' });
    }
  };

  const clearSheet = () => {
    if (!isAdmin) return;
    if (window.confirm('Apagar todos os dados e resetar o sistema?')) {
      setTasks([]);
      localStorage.removeItem('executive_tasks');
      window.history.replaceState(null, "", window.location.pathname);
      setNotification({ message: 'Sistema resetado.', type: 'success' });
    }
  };

  const updateTaskStatus = (id: string, status: TaskStatus, observations: string) => {
    saveToHistory();
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, status, observations, lastUpdateAt: Date.now() } : t
    ));
    setActiveModal(null);
  };

  const resetTask = (id: string) => {
    saveToHistory();
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, status: TaskStatus.PENDING, observations: '' } : t
    ));
  };

  const stats = useMemo(() => {
    const total = tasks.length;
    const pending = tasks.filter(t => t.status === TaskStatus.PENDING).length;
    const completed = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    const rescheduled = tasks.filter(t => t.status === TaskStatus.RESCHEDULED).length;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : "0.0";
    return { total, pending, completed, rescheduled, completionRate };
  }, [tasks]);

  const chartData = useMemo(() => [
    { name: 'Pendentes', value: stats.pending, color: '#4285F4' },
    { name: 'Concluídas', value: stats.completed, color: '#00C853' },
    { name: 'Reprogramadas', value: stats.rescheduled, color: '#FFAB00' }
  ].filter(d => d.value > 0), [stats]);

  const performerChartData = useMemo(() => {
    const performerMap: Record<string, any> = {};
    tasks.forEach(task => {
      if (!performerMap[task.performer]) {
        performerMap[task.performer] = { name: task.performer, Pendentes: 0, Concluídas: 0, Reprogramadas: 0, total: 0 };
      }
      performerMap[task.performer].total++;
      if (task.status === TaskStatus.PENDING) performerMap[task.performer].Pendentes++;
      if (task.status === TaskStatus.COMPLETED) performerMap[task.performer].Concluídas++;
      if (task.status === TaskStatus.RESCHEDULED) performerMap[task.performer].Reprogramadas++;
    });
    return Object.values(performerMap);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const searchStr = filter.toLowerCase();
      const matchesSearch = t.activity.toLowerCase().includes(searchStr) || 
                           t.orderNumber.toLowerCase().includes(searchStr) ||
                           t.performer.toLowerCase().includes(searchStr);
      const matchesPerformer = selectedPerformer === 'Todos' || t.performer === selectedPerformer;
      return matchesSearch && matchesPerformer;
    });
  }, [tasks, filter, selectedPerformer]);

  const performersList = useMemo(() => {
    return ['Todos', ...Array.from(new Set(tasks.map(t => t.performer)))];
  }, [tasks]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      {notification && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-3 rounded-xl shadow-2xl bg-white border border-gray-100 text-gray-800 animate-in slide-in-from-right duration-300">
          <CheckCircleIcon className="h-5 w-5 text-green-500" />
          <span className="font-semibold text-sm">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2"><XMarkIcon className="h-4 w-4 text-gray-400" /></button>
        </div>
      )}

      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl">
              <ClipboardDocumentListIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">Gestor Executivo</h1>
              {isAdmin && <span className="text-[10px] text-indigo-600 font-black uppercase tracking-widest block">MODO ADMINISTRADOR</span>}
            </div>
          </div>
          <div className="flex gap-2.5 items-center">
            {tasks.length > 0 && (
              <button onClick={exportReport} className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm">
                <ArrowDownTrayIcon className="h-4 w-4" /> Relatório Excel
              </button>
            )}
            
            {isAdmin ? (
              <div className="flex gap-2">
                <button onClick={generateShareLink} className="px-5 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100">
                  <ShareIcon className="h-4 w-4" /> Gerar Link
                </button>
                <button onClick={clearSheet} className="px-4 py-2 rounded-lg text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-2 border border-red-100">
                  <TrashIcon className="h-4 w-4" /> Limpar Tudo
                </button>
                <button onClick={() => setIsAdmin(false)} className="text-gray-400 hover:text-indigo-600 transition-colors ml-2">
                  <UserCircleIcon className="h-9 w-9" />
                </button>
              </div>
            ) : (
              <button onClick={() => setShowLogin(true)} className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm">
                <LockClosedIcon className="h-4 w-4 text-gray-400" /> Login Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {showLogin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center">
            <h3 className="text-2xl font-black text-gray-900 mb-2">Acesso Administrativo</h3>
            <p className="text-gray-400 text-sm mb-8">Faça login para carregar planilhas.</p>
            <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 py-3.5 rounded-2xl font-black text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
              <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="h-6 w-6" alt="G" /> Entrar com Google
            </button>
            <button onClick={() => setShowLogin(false)} className="mt-6 text-xs text-gray-400 font-black uppercase tracking-widest">Cancelar</button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {tasks.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[{label: 'Total', val: stats.total}, {label: 'Pendentes', val: stats.pending}, {label: 'Concluídas', val: stats.completed}, {label: 'Reprogramadas', val: stats.rescheduled}].map(s => (
                <div key={s.label} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                  <div className="text-2xl font-black text-gray-900">{s.val}</div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 min-h-[400px] flex flex-col items-center">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8 self-start">Status Geral (%)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" outerRadius={100} dataKey="value" isAnimationActive={false}>
                      {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-6 text-3xl font-black text-gray-900">{stats.completionRate}% Concluído</div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8 self-start">Produtividade por Equipe (%)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performerChartData} layout="vertical" stackOffset="expand" isAnimationActive={false}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#4b5563', fontSize: 11, fontWeight: 800}} width={100} />
                    <Tooltip />
                    <Bar dataKey="Concluídas" stackId="a" fill="#00C853" />
                    <Bar dataKey="Pendentes" stackId="a" fill="#4285F4" />
                    <Bar dataKey="Reprogramadas" stackId="a" fill="#FFAB00" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[280px]">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-300 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input type="text" placeholder="Filtrar atividades..." className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm" value={filter} onChange={e => setFilter(e.target.value)} />
                </div>
                <select className="bg-white border border-gray-100 rounded-2xl px-5 py-3 text-sm font-bold" value={selectedPerformer} onChange={e => setSelectedPerformer(e.target.value)}>
                  {performersList.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50 text-gray-400 text-[10px] uppercase font-black tracking-widest border-b border-gray-50">
                      <th className="px-6 py-5">Status</th>
                      <th className="px-6 py-5">Atividade</th>
                      <th className="px-6 py-5">Nº Ordem</th>
                      <th className="px-6 py-5">Data</th>
                      <th className="px-6 py-5">Executante</th>
                      <th className="px-6 py-5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredTasks.map(task => (
                      <tr key={task.id} className="hover:bg-gray-50/20 transition-colors">
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter ${task.status === TaskStatus.COMPLETED ? 'bg-green-50 text-green-600' : task.status === TaskStatus.RESCHEDULED ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>{task.status}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-gray-800 leading-tight">{task.activity}</div>
                          {task.observations && <div className="text-[10px] text-gray-400 italic mt-1 font-medium">Obs: {task.observations}</div>}
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-sm font-mono tracking-tight">#{task.orderNumber}</td>
                        <td className="px-6 py-4 text-gray-500 text-sm">{task.date}</td>
                        <td className="px-6 py-4 text-gray-600 text-sm font-bold">{task.performer}</td>
                        <td className="px-6 py-4 text-right">
                          {task.status === TaskStatus.PENDING ? (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.COMPLETED })} className="px-3 py-1.5 bg-white text-green-600 rounded-lg text-[10px] font-black uppercase border border-green-200 shadow-sm active:scale-95">Concluir</button>
                              <button onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.RESCHEDULED })} className="px-3 py-1.5 bg-white text-orange-600 rounded-lg text-[10px] font-black uppercase border border-orange-200 shadow-sm active:scale-95">Reprogramar</button>
                            </div>
                          ) : (
                            <button onClick={() => resetTask(task.id)} className="px-5 py-1.5 bg-white text-indigo-600 rounded-lg text-[10px] font-black uppercase border border-indigo-100 shadow-sm active:scale-95">REFAZER</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[40px] border-2 border-dashed border-gray-100">
            <ClipboardDocumentListIcon className="h-20 w-20 text-indigo-100 mb-8" />
            <h2 className="text-3xl font-black text-gray-900 mb-3 text-center px-4">Sua Central de Atividades</h2>
            <p className="text-gray-400 mb-10 text-center max-w-sm font-medium px-4">
              {isAdmin ? 'Importe um CSV para começar.' : 'Aguarde o link do administrador com as atividades.'}
            </p>
            {isAdmin ? (
              <label className="bg-indigo-600 text-white px-12 py-5 rounded-3xl font-black text-lg cursor-pointer shadow-2xl active:scale-95 transition-all">
                Importar CSV Inicial <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
              </label>
            ) : (
              <button onClick={() => setShowLogin(true)} className="bg-white border-2 border-gray-100 px-10 py-4 rounded-3xl font-black text-gray-700 shadow-xl active:scale-95">Login Admin</button>
            )}
          </div>
        )}
      </main>

      {activeModal && (
        <ObservationModal isOpen={!!activeModal} type={activeModal.type} onClose={() => setActiveModal(null)} onSubmit={obs => updateTaskStatus(activeModal.taskId, activeModal.type, obs)} />
      )}
    </div>
  );
};

export default App;
