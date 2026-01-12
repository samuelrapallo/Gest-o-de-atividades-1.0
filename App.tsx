
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  PlusIcon, 
  TrashIcon, 
  CheckCircleIcon, 
  MagnifyingGlassIcon, 
  ShareIcon,
  ArrowPathIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  CloudArrowUpIcon,
  WifiIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  HashtagIcon
} from '@heroicons/react/24/outline';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip
} from 'recharts';
import { Task, TaskStatus } from './types';
import { api } from './api';
import ObservationModal from './components/ObservationModal';

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lastSync, setLastSync] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedPerformer, setSelectedPerformer] = useState('Todos');
  const [activeModal, setActiveModal] = useState<{ taskId: string, type: TaskStatus } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const syncWithCloud = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setIsSyncing(true);
    try {
      const { tasks: cloudTasks, updatedAt } = await api.fetchTasks();
      if (updatedAt > lastSync || !isSilent) {
        setTasks(cloudTasks);
        setLastSync(updatedAt);
      }
    } catch (e) {
      console.error("Erro na sincronização:", e);
    } finally {
      setLoading(false);
      setTimeout(() => setIsSyncing(false), 1000);
    }
  }, [lastSync]);

  useEffect(() => {
    syncWithCloud();
    api.onExternalChange(() => syncWithCloud(true));
    const interval = setInterval(() => syncWithCloud(true), 5000);
    return () => clearInterval(interval);
  }, [syncWithCloud]);

  const persistChanges = async (newTasks: Task[]) => {
    setIsSyncing(true);
    const newTimestamp = await api.saveTasks(newTasks);
    setTasks(newTasks);
    setLastSync(newTimestamp);
    setTimeout(() => setIsSyncing(false), 800);
  };

  const clearApp = async () => {
    if(confirm("Deseja apagar a planilha global e limpar para todos os usuários conectados?")) {
      setIsSyncing(true);
      await api.clearCloud();
      setTasks([]);
      setLastSync(Date.now());
      setNotification({ message: 'Planilha apagada globalmente!', type: 'success' });
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        const newTasks: Task[] = [];
        const delimiter = lines[0]?.includes(';') ? ';' : ',';

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const parts = line.split(delimiter).map(s => s.trim().replace(/^"|"$/g, ''));
          if (parts[0]) {
            newTasks.push({
              id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              activity: parts[0],
              orderNumber: parts[1] || 'N/A',
              date: parts[2] || new Date().toLocaleDateString(), // Ordem: 0=Ativ, 1=Ordem, 2=Data
              performer: parts[3] || 'Executante', // Ordem: 3=Executante
              status: TaskStatus.PENDING,
              observations: ''
            });
          }
        }
        await persistChanges(newTasks);
        setNotification({ message: 'Nova planilha carregada e sincronizada!', type: 'success' });
      } catch (err) {
        setNotification({ message: 'Erro no arquivo CSV.', type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const updateStatus = async (id: string, status: TaskStatus, obs: string) => {
    const newTasks = tasks.map(t => t.id === id ? { ...t, status, observations: obs } : t);
    await persistChanges(newTasks);
    setActiveModal(null);
  };

  const undoStatus = async (id: string) => {
    const newTasks = tasks.map(t => t.id === id ? { ...t, status: TaskStatus.PENDING, observations: '' } : t);
    await persistChanges(newTasks);
  };

  const globalStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    const pending = tasks.filter(t => t.status === TaskStatus.PENDING).length;
    const rescheduled = tasks.filter(t => t.status === TaskStatus.RESCHEDULED).length;
    return {
      total, completed, pending, rescheduled,
      rate: total > 0 ? ((completed / total) * 100).toFixed(0) : "0",
      chartData: [
        { name: 'Concluído', value: completed, color: '#10B981' },
        { name: 'Pendente', value: pending, color: '#3B82F6' },
        { name: 'Reprogramado', value: rescheduled, color: '#F59E0B' }
      ].filter(d => d.value > 0)
    };
  }, [tasks]);

  const performancePerPerformer = useMemo(() => {
    const performers = Array.from(new Set(tasks.map(t => t.performer)));
    return performers.map(p => {
      const pTasks = tasks.filter(t => t.performer === p);
      const done = pTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
      return {
        name: p,
        total: pTasks.length,
        done,
        percent: pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0
      };
    }).sort((a, b) => b.percent - a.percent);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesSearch = t.activity.toLowerCase().includes(filter.toLowerCase()) || 
                           t.performer.toLowerCase().includes(filter.toLowerCase()) ||
                           t.orderNumber.toLowerCase().includes(filter.toLowerCase());
      const matchesPerformer = selectedPerformer === 'Todos' || t.performer === selectedPerformer;
      return matchesSearch && matchesPerformer;
    });
  }, [tasks, filter, selectedPerformer]);

  const performersList = useMemo(() => Array.from(new Set(tasks.map(t => t.performer))), [tasks]);

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-sm font-black text-indigo-600 uppercase tracking-widest animate-pulse">Sincronizando Dados...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-slate-900 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-100">
              <ClipboardDocumentListIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none text-slate-800">Gestor de Atividades</h1>
              <div className="flex items-center gap-2 mt-1">
                <WifiIcon className={`h-3 w-3 ${isSyncing ? 'text-amber-500 animate-pulse' : 'text-emerald-500'}`} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                  {isSyncing ? 'Atualizando Nuvem...' : 'Dados Sincronizados'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isAdmin ? (
              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button 
                  onClick={clearApp} 
                  className="p-2.5 text-red-500 hover:bg-white hover:shadow-sm rounded-xl transition-all"
                  title="Apagar Planilha Atual"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
                <button onClick={() => setIsAdmin(false)} className="px-5 py-2 bg-white shadow-sm border border-slate-200 text-slate-700 rounded-xl text-xs font-black">Sair do Admin</button>
              </div>
            ) : (
              <button onClick={() => setShowLogin(true)} className="px-6 py-3 bg-indigo-50 text-indigo-600 rounded-2xl text-xs font-black hover:bg-indigo-100 transition-all">Acesso Gestor</button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {tasks.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* SIDEBAR DASHBOARDS */}
            <div className="lg:col-span-4 space-y-8">
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 flex flex-col items-center">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 self-start">Progresso Geral</h3>
                <div className="h-64 w-full relative mb-6">
                   <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-5xl font-black text-slate-800">{globalStats.rate}%</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Conclusão</span>
                   </div>
                   <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={globalStats.chartData} innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value" stroke="none">
                        {globalStats.chartData.map((entry, index) => <Cell key={index} fill={entry.color} cornerRadius={8} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full space-y-3">
                   <div className="flex justify-between items-center text-xs font-bold text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                     <span>Aguardando</span><span className="text-blue-600 font-black">{globalStats.pending}</span>
                   </div>
                   <div className="flex justify-between items-center text-xs font-bold text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                     <span>Reprogramadas</span><span className="text-amber-600 font-black">{globalStats.rescheduled}</span>
                   </div>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8">
                <div className="flex items-center gap-2 mb-6">
                  <UserGroupIcon className="h-5 w-5 text-indigo-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Ranking Performance</h3>
                </div>
                <div className="space-y-6">
                  {performancePerPerformer.map(p => (
                    <div key={p.name} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-slate-700 uppercase tracking-tighter truncate max-w-[150px]">{p.name}</span>
                        <span className="text-xs font-black text-indigo-600">{p.percent}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out" 
                          style={{ width: `${p.percent}%` }}
                        ></div>
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{p.done} concluídas de {p.total}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* LISTA DE TAREFAS */}
            <div className="lg:col-span-8 space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="h-5 w-5 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input 
                    type="text" 
                    placeholder="Filtrar por atividade, ordem, data ou executante..." 
                    className="w-full pl-14 pr-8 py-4.5 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none font-semibold focus:ring-4 ring-indigo-500/5 transition-all" 
                    value={filter} 
                    onChange={e => setFilter(e.target.value)} 
                  />
                </div>
                <select 
                  className="px-6 py-4.5 bg-white border border-slate-200 rounded-2xl shadow-sm font-black text-xs outline-none cursor-pointer text-slate-600"
                  value={selectedPerformer} 
                  onChange={e => setSelectedPerformer(e.target.value)}
                >
                  <option value="Todos">Global</option>
                  {performersList.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
                        <th className="px-8 py-6">Atividade</th>
                        <th className="px-8 py-6">Ordem</th>
                        <th className="px-8 py-6">Data</th>
                        <th className="px-8 py-6">Executante</th>
                        <th className="px-8 py-6 text-right">Controle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTasks.map(task => (
                        <tr key={task.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-7 min-w-[200px]">
                            <div className="flex items-center gap-3 mb-1.5">
                               <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                 task.status === TaskStatus.COMPLETED ? 'bg-emerald-100 text-emerald-700' :
                                 task.status === TaskStatus.RESCHEDULED ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                               }`}>{task.status}</span>
                               <span className="font-bold text-slate-800">{task.activity}</span>
                            </div>
                            {task.observations && <div className="text-[11px] font-medium text-slate-400 italic mt-2 bg-slate-100/50 p-2 rounded-lg border border-slate-100 inline-block">"{task.observations}"</div>}
                          </td>
                          <td className="px-8 py-7">
                            <div className="flex items-center gap-2 text-slate-500">
                               <HashtagIcon className="h-3 w-3 opacity-30" />
                               <span className="text-[11px] font-black uppercase">{task.orderNumber}</span>
                            </div>
                          </td>
                          <td className="px-8 py-7">
                            <div className="flex items-center gap-2 text-slate-500">
                               <CalendarDaysIcon className="h-4 w-4 opacity-30" />
                               <span className="text-xs font-bold">{task.date}</span>
                            </div>
                          </td>
                          <td className="px-8 py-7">
                            <div className="flex items-center gap-2">
                               <div className="h-7 w-7 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-400 uppercase">{task.performer.slice(0,2)}</div>
                               <span className="text-[11px] font-black text-slate-600 uppercase tracking-tighter">{task.performer}</span>
                            </div>
                          </td>
                          <td className="px-8 py-7 text-right">
                            {task.status === TaskStatus.PENDING ? (
                              <div className="flex justify-end gap-2">
                                <button 
                                  onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.COMPLETED })} 
                                  className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-700 shadow-md shadow-emerald-50 transition-all active:scale-95"
                                >
                                  Concluir
                                </button>
                                <button 
                                  onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.RESCHEDULED })} 
                                  className="px-4 py-2.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-amber-600 shadow-md shadow-amber-50 transition-all active:scale-95"
                                >
                                  Adiar
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => undoStatus(task.id)} 
                                className="px-4 py-2.5 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all inline-flex items-center gap-2 border border-slate-100 hover:border-indigo-100"
                              >
                                <ArrowPathIcon className="h-4 w-4" /> Corrigir
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-48 bg-white rounded-[4rem] border-2 border-dashed border-slate-200 text-center px-10">
             <div className="bg-indigo-50 p-12 rounded-[4rem] w-40 h-40 mx-auto mb-12 flex items-center justify-center animate-pulse">
                <CloudArrowUpIcon className="h-20 w-20 text-indigo-200" />
             </div>
             <h2 className="text-4xl font-black text-slate-900 mb-6 tracking-tight">Vazio e Sincronizado</h2>
             <p className="text-slate-400 font-medium text-lg mb-14 max-w-md mx-auto">Importe uma planilha CSV seguindo a ordem: Atividade, Ordem, Data, Executante.</p>
             {isAdmin ? (
               <label className="bg-indigo-600 text-white px-16 py-6 rounded-[2.5rem] font-black text-xl cursor-pointer shadow-2xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-105 inline-flex items-center gap-4 transition-all active:scale-95">
                 <PlusIcon className="h-7 w-7" /> Importar CSV
                 <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
               </label>
             ) : (
               <button onClick={() => setShowLogin(true)} className="bg-white border-2 border-slate-200 px-14 py-6 rounded-[2.5rem] font-black text-slate-700 shadow-xl hover:bg-slate-50 transition-all active:scale-95">Acesso Administrativo</button>
             )}
          </div>
        )}
      </main>

      {notification && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white rounded-[2rem] px-8 py-5 flex items-center gap-4 shadow-2xl animate-in fade-in slide-in-from-bottom-10">
          <CheckCircleIcon className="h-6 w-6 text-emerald-400" />
          <span className="text-sm font-bold tracking-tight">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-4 p-1 hover:bg-white/10 rounded-full"><XMarkIcon className="h-4 w-4" /></button>
        </div>
      )}

      {showLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-xl">
          <div className="bg-white rounded-[4rem] shadow-2xl w-full max-w-sm p-16 text-center animate-in zoom-in-95">
             <div className="bg-indigo-600 h-16 w-16 rounded-[1.5rem] mx-auto mb-8 flex items-center justify-center">
               <ClipboardDocumentListIcon className="h-8 w-8 text-white" />
             </div>
             <h3 className="text-3xl font-black mb-10 tracking-tight text-slate-800">Acesso Gestor</h3>
             <button onClick={() => {setIsAdmin(true); setShowLogin(false);}} className="w-full flex items-center justify-center gap-4 bg-slate-900 text-white py-5 rounded-[2rem] font-black hover:bg-slate-800 transition-all shadow-xl active:scale-95">
               Autenticar Workspace
             </button>
             <button onClick={() => setShowLogin(false)} className="mt-8 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">Voltar</button>
          </div>
        </div>
      )}

      {activeModal && (
        <ObservationModal 
          isOpen={!!activeModal} 
          type={activeModal.type} 
          onClose={() => setActiveModal(null)} 
          onSubmit={obs => updateStatus(activeModal.taskId, activeModal.type, obs)} 
        />
      )}
    </div>
  );
};

export default App;
