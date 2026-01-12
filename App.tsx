
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  PlusIcon, 
  TrashIcon, 
  CheckCircleIcon, 
  MagnifyingGlassIcon, 
  ArrowPathIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  CloudArrowUpIcon,
  WifiIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  HashtagIcon,
  LinkIcon,
  ArrowDownTrayIcon
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
    if(confirm("ATENÇÃO: Deseja apagar a planilha globalmente?")) {
      setIsSyncing(true);
      await api.clearCloud();
      setTasks([]);
      setLastSync(Date.now());
      setNotification({ message: 'Planilha apagada com sucesso!', type: 'success' });
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
              date: parts[2] || new Date().toLocaleDateString(),
              performer: parts[3] || 'Executante',
              status: TaskStatus.PENDING,
              observations: ''
            });
          }
        }
        await persistChanges(newTasks);
        setNotification({ message: 'Dados sincronizados para todos!', type: 'success' });
      } catch (err) {
        setNotification({ message: 'Erro no arquivo CSV.', type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const shareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setNotification({ message: 'Link de acesso copiado!', type: 'success' });
  };

  const exportReport = () => {
    if (tasks.length === 0) return;
    const headers = ['Atividade', 'Ordem', 'Data', 'Executante', 'Status', 'Observações'];
    const rows = tasks.map(t => [
      t.activity,
      t.orderNumber,
      t.date,
      t.performer,
      t.status,
      t.observations.replace(/\n/g, ' ')
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Relatorio_Atividades_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      const search = filter.toLowerCase();
      return t.activity.toLowerCase().includes(search) || 
             t.performer.toLowerCase().includes(search) ||
             t.orderNumber.toLowerCase().includes(search);
    }).filter(t => selectedPerformer === 'Todos' || t.performer === selectedPerformer);
  }, [tasks, filter, selectedPerformer]);

  const performersList = useMemo(() => Array.from(new Set(tasks.map(t => t.performer))), [tasks]);

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-sm font-black text-indigo-600 uppercase tracking-widest animate-pulse">Sincronizando...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 md:px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg">
              <ClipboardDocumentListIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none text-slate-800">GESTOR EXECUTIVO</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <WifiIcon className={`h-3 w-3 ${isSyncing ? 'text-amber-500 animate-pulse' : 'text-emerald-500'}`} />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Real-time Sinc</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={exportReport} className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 border border-emerald-100 flex items-center gap-2 transition-all">
              <ArrowDownTrayIcon className="h-5 w-5" />
              <span className="hidden sm:inline text-[10px] font-black uppercase">Relatório</span>
            </button>
            <button onClick={shareLink} className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 border border-slate-200 flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
            </button>
            {isAdmin ? (
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button onClick={clearApp} className="p-2 text-red-500 hover:bg-white rounded-lg transition-all"><TrashIcon className="h-5 w-5" /></button>
                <button onClick={() => setIsAdmin(false)} className="px-3 py-2 bg-white text-slate-700 rounded-lg text-[10px] font-black uppercase">Admin On</button>
              </div>
            ) : (
              <button onClick={() => setShowLogin(true)} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all">Acesso Gestor</button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
        {tasks.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* DASHBOARDS */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Visão de Progresso</h3>
                <div className="h-56 w-full relative mb-4">
                   <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-4xl font-black text-slate-800">{globalStats.rate}%</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Concluído</span>
                   </div>
                   <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={globalStats.chartData} innerRadius={70} outerRadius={95} paddingAngle={5} dataKey="value" stroke="none">
                        {globalStats.chartData.map((entry, index) => <Cell key={index} fill={entry.color} cornerRadius={6} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Rendimento por Executante</h3>
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {performancePerPerformer.map(p => (
                    <div key={p.name} className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-600 uppercase truncate pr-2">{p.name}</span>
                        <span className="text-[10px] font-black text-indigo-600">{p.percent}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-700" style={{ width: `${p.percent}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* LISTA DE CARDS - BASEADO NA IMAGEM */}
            <div className="lg:col-span-8 space-y-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input type="text" placeholder="Buscar na planilha..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-sm font-semibold focus:ring-4 ring-indigo-500/5" value={filter} onChange={e => setFilter(e.target.value)} />
                </div>
                <select className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase cursor-pointer text-slate-600" value={selectedPerformer} onChange={e => setSelectedPerformer(e.target.value)}>
                  <option value="Todos">Todos Executantes</option>
                  {performersList.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="space-y-4">
                {filteredTasks.map(task => (
                  <div key={task.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
                    {/* Header do Card */}
                    <div className="px-6 py-4 flex justify-between items-center border-b border-slate-50">
                      <div className="flex items-center gap-2 text-slate-400">
                        <HashtagIcon className="h-4 w-4" />
                        <span className="text-xs font-black uppercase tracking-widest">{task.orderNumber}</span>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                        task.status === TaskStatus.COMPLETED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        task.status === TaskStatus.RESCHEDULED ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                      }`}>
                        {task.status}
                      </span>
                    </div>

                    {/* Corpo do Card */}
                    <div className="px-6 py-6 space-y-4">
                      <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase leading-snug">
                        {task.activity}
                      </h2>
                      
                      <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-2 text-slate-500">
                          <CalendarDaysIcon className="h-4 w-4" />
                          <span className="text-xs font-bold">{task.date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <UserGroupIcon className="h-4 w-4" />
                          <span className="text-xs font-black uppercase tracking-tighter truncate max-w-[200px]">{task.performer}</span>
                        </div>
                      </div>

                      {task.observations && (
                        <div className="p-3 bg-slate-50 rounded-lg border-l-4 border-indigo-400 italic text-[11px] text-slate-500">
                          "{task.observations}"
                        </div>
                      )}
                    </div>

                    {/* Rodapé de Ações - IGUAL A IMAGEM */}
                    <div className="px-6 pb-6 pt-2">
                      {task.status === TaskStatus.PENDING ? (
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button 
                            onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.COMPLETED })} 
                            className="flex-1 py-3 bg-[#0DA66D] text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 shadow-sm hover:bg-[#0b8e5c] transition-all"
                          >
                            <CheckCircleIcon className="h-4 w-4" /> Concluir
                          </button>
                          <button 
                            onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.RESCHEDULED })} 
                            className="flex-1 py-3 bg-white border border-[#F59E0B] text-[#F59E0B] rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 hover:bg-amber-50 transition-all"
                          >
                            <CalendarDaysIcon className="h-4 w-4" /> Reprogramar
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => undoStatus(task.id)} 
                          className="w-full py-3 bg-slate-100 text-slate-400 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                        >
                          <ArrowPathIcon className="h-4 w-4" /> Refazer Atividade
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-24 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 text-center px-6">
             <div className="bg-indigo-50 p-10 rounded-[3rem] w-32 h-32 mx-auto mb-10 flex items-center justify-center animate-pulse">
                <CloudArrowUpIcon className="h-16 w-16 text-indigo-200" />
             </div>
             <h2 className="text-2xl font-black text-slate-900 mb-4 uppercase tracking-tighter">Aguardando Planilha</h2>
             <p className="text-slate-400 font-medium text-sm mb-10 max-w-sm mx-auto">
               Os campos serão exibidos assim que os dados forem carregados pelo gestor do projeto.
             </p>
             {isAdmin ? (
               <label className="bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-xs cursor-pointer shadow-xl hover:bg-indigo-700 hover:scale-105 inline-flex items-center gap-3 transition-all active:scale-95">
                 <PlusIcon className="h-5 w-5" /> IMPORTAR PLANILHA CSV
                 <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
               </label>
             ) : (
               <button onClick={() => setShowLogin(true)} className="bg-white border-2 border-slate-200 px-10 py-5 rounded-2xl font-black text-slate-700 shadow-sm hover:bg-slate-50 transition-all active:scale-95 text-xs">MODO GESTOR</button>
             )}
          </div>
        )}
      </main>

      {/* NOTIFICAÇÃO */}
      {notification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white rounded-2xl px-6 py-4 flex items-center gap-3 shadow-2xl animate-in slide-in-from-bottom-5">
          <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
          <span className="text-[10px] font-black uppercase">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 p-1 hover:bg-white/10 rounded-full"><XMarkIcon className="h-4 w-4" /></button>
        </div>
      )}

      {/* MODAL LOGIN */}
      {showLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-14 text-center animate-in zoom-in-95">
             <div className="bg-indigo-600 h-14 w-14 rounded-2xl mx-auto mb-6 flex items-center justify-center">
               <ClipboardDocumentListIcon className="h-7 w-7 text-white" />
             </div>
             <h3 className="text-xl font-black mb-8 text-slate-800 uppercase">Acesso Administrativo</h3>
             <button onClick={() => {setIsAdmin(true); setShowLogin(false);}} className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-slate-800 transition-all text-xs">
               ENTRAR COMO GESTOR
             </button>
             <button onClick={() => setShowLogin(false)} className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancelar</button>
          </div>
        </div>
      )}

      {/* MODAL OBSERVAÇÃO */}
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
