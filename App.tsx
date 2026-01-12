
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
  ArrowDownTrayIcon,
  ChartBarIcon,
  ChevronDownIcon,
  ChevronUpIcon
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
  CartesianGrid
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

  // Sincronização robusta
  const syncWithCloud = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setIsSyncing(true);
    try {
      const data = await api.fetchTasks();
      if (data.updatedAt > lastSync || !isSilent) {
        setTasks(data.tasks);
        setLastSync(data.updatedAt);
      }
    } catch (e) {
      console.error("Erro de sincronização:", e);
    } finally {
      setLoading(false);
      setTimeout(() => setIsSyncing(false), 500);
    }
  }, [lastSync]);

  useEffect(() => {
    syncWithCloud();
    api.onExternalChange(() => syncWithCloud(true));
    const interval = setInterval(() => syncWithCloud(true), 3000);
    return () => clearInterval(interval);
  }, [syncWithCloud]);

  const persistChanges = async (newTasks: Task[]) => {
    try {
      setIsSyncing(true);
      const ts = await api.saveTasks(newTasks);
      setTasks(newTasks);
      setLastSync(ts);
    } catch (e) {
      setNotification({ message: "Erro ao salvar alterações.", type: "error" });
    } finally {
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  const updateStatus = async (taskId: string, status: TaskStatus, observations: string) => {
    const newTasks = tasks.map(t => 
      t.id === taskId ? { ...t, status, observations, updatedAt: Date.now() } : t
    );
    await persistChanges(newTasks);
    setActiveModal(null);
    setNotification({ 
      message: status === TaskStatus.COMPLETED ? 'Atividade concluída!' : 'Atividade reprogramada!', 
      type: 'success' 
    });
  };

  const undoStatus = async (taskId: string) => {
    const newTasks = tasks.map(t => 
      t.id === taskId ? { ...t, status: TaskStatus.PENDING, observations: '', updatedAt: Date.now() } : t
    );
    await persistChanges(newTasks);
    setNotification({ message: 'Atividade retornada para pendente.', type: 'success' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
              id: `t-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              activity: parts[0],
              orderNumber: parts[1] || '0',
              date: parts[2] || new Date().toLocaleDateString(),
              performer: parts[3] || 'Executante',
              status: TaskStatus.PENDING,
              observations: ''
            });
          }
        }
        await persistChanges(newTasks);
        setNotification({ message: 'Planilha atualizada no Workspace!', type: 'success' });
      } catch (err) {
        setNotification({ message: 'Erro no arquivo CSV.', type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const exportToExcel = () => {
    if (tasks.length === 0) return;
    const excelHeader = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8"></head>
      <body>
      <table border="1">
        <tr style="background-color: #1e293b; color: #ffffff; font-weight: bold;">
          <th>Atividade</th><th>Ordem</th><th>Data</th><th>Executante</th><th>Status</th><th>Observações</th>
        </tr>`;
    
    const rows = tasks.map(t => {
      let style = 'background-color: #ffffff; color: #000000;';
      if (t.status === TaskStatus.COMPLETED) style = 'background-color: #C6EFCE; color: #006100;';
      if (t.status === TaskStatus.RESCHEDULED) style = 'background-color: #FFEB9C; color: #9C6500;';

      return `<tr style="${style}">
        <td>${t.activity}</td><td>${t.orderNumber}</td><td>${t.date}</td>
        <td>${t.performer}</td><td>${t.status}</td><td>${t.observations}</td>
      </tr>`;
    }).join('');

    const blob = new Blob([excelHeader + rows + '</table></body></html>'], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Relatorio_Workspace_${api.getWsId()}.xls`;
    link.click();
  };

  const performanceData = useMemo(() => {
    const performers = Array.from(new Set(tasks.map(t => t.performer)));
    return performers.map(p => {
      const pTasks = tasks.filter(t => t.performer === p);
      const total = pTasks.length;
      const done = pTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
      const percent = total > 0 ? Math.round((done / total) * 100) : 0;
      return { name: p, porcentagem: percent };
    }).sort((a, b) => b.porcentagem - a.porcentagem);
  }, [tasks]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    const pending = tasks.filter(t => t.status === TaskStatus.PENDING).length;
    const rescheduled = tasks.filter(t => t.status === TaskStatus.RESCHEDULED).length;
    return {
      total, completed, pending, rescheduled,
      rate: total > 0 ? ((completed / total) * 100).toFixed(0) : "0",
      pieData: [
        { name: 'Concluído', value: completed, color: '#10B981' },
        { name: 'Pendente', value: pending, color: '#3B82F6' },
        { name: 'Reprogramado', value: rescheduled, color: '#F59E0B' }
      ].filter(d => d.value > 0)
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const s = filter.toLowerCase();
      const matchSearch = t.activity.toLowerCase().includes(s) || t.performer.toLowerCase().includes(s) || t.orderNumber.toString().includes(s);
      const matchPerf = selectedPerformer === 'Todos' || t.performer === selectedPerformer;
      return matchSearch && matchPerf;
    });
  }, [tasks, filter, selectedPerformer]);

  const performersList = useMemo(() => Array.from(new Set(tasks.map(t => t.performer))), [tasks]);

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-sm font-bold text-indigo-600 animate-pulse uppercase tracking-widest">Sincronizando Workspace...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-4 shadow-sm flex justify-between items-center backdrop-blur-md bg-white/80">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100">
            <ClipboardDocumentListIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-800 uppercase tracking-tighter">Gestor Executivo</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <WifiIcon className={`h-3 w-3 ${isSyncing ? 'text-amber-500 animate-pulse' : 'text-emerald-500'}`} />
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">ID: {api.getWsId()}</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 flex items-center gap-2 hover:bg-emerald-100 transition-all">
            <ArrowDownTrayIcon className="h-4 w-4" /> 
            <span className="hidden sm:inline text-[9px] font-black uppercase">Excel</span>
          </button>
          <button onClick={() => { navigator.clipboard.writeText(api.getWsLink()); setNotification({ message: 'Link copiado!', type: 'success' }); }} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-all">
            <LinkIcon className="h-4 w-4" />
          </button>
          {isAdmin ? (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button onClick={async () => { if(confirm("Limpar workspace?")) { await api.clearCloud(); setTasks([]); } }} className="p-1.5 text-red-500 hover:bg-white rounded-lg transition-all"><TrashIcon className="h-4 w-4"/></button>
              <button onClick={() => setIsAdmin(false)} className="px-3 py-1 bg-white text-slate-800 rounded-lg text-[9px] font-black uppercase shadow-sm">Painel Gestor</button>
            </div>
          ) : (
            <button onClick={() => setShowLogin(true)} className="px-4 py-2 bg-slate-50 text-slate-500 rounded-xl text-[9px] font-black uppercase border border-slate-200 hover:bg-white hover:text-indigo-600 transition-all">Admin</button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* PAINEL LATERAL */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Status Geral</h3>
              <div className="h-56 w-full relative">
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-4xl font-black text-slate-800">{stats.rate}%</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Finalizado</span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.pieData} innerRadius={70} outerRadius={95} paddingAngle={5} dataKey="value" stroke="none">
                      {stats.pieData.map((e, i) => <Cell key={i} fill={e.color} cornerRadius={8} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                <ChartBarIcon className="h-4 w-4" /> Desempenho Executores
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData} layout="vertical" margin={{ left: -20, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide domain={[0, 100]} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="porcentagem" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={16} label={{ position: 'right', fontSize: 10, fontWeight: 900, fill: '#6366f1', formatter: (v: any) => `${v}%` }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* LISTA DE ATIVIDADES */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                <input type="text" placeholder="Filtrar atividade..." className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none text-sm font-semibold focus:ring-4 ring-indigo-500/5 shadow-sm transition-all" value={filter} onChange={e => setFilter(e.target.value)} />
              </div>
              <select className="px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase cursor-pointer text-slate-600 shadow-sm" value={selectedPerformer} onChange={e => setSelectedPerformer(e.target.value)}>
                <option value="Todos">Todos Executantes</option>
                {performersList.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="space-y-3">
              {filteredTasks.length > 0 ? filteredTasks.map(task => {
                const isMinimized = task.status !== TaskStatus.PENDING;

                return (
                  <div key={task.id} className={`bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 group ${isMinimized ? 'opacity-75' : ''}`}>
                    {/* Compact Header for Minimized, Full for Pending */}
                    <div className={`px-8 py-3 flex justify-between items-center border-b border-slate-100 ${isMinimized ? 'bg-slate-50/50' : 'bg-slate-50/20'}`}>
                      <div className="flex items-center gap-3">
                        <HashtagIcon className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{task.orderNumber}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          task.status === TaskStatus.COMPLETED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          task.status === TaskStatus.RESCHEDULED ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-400 border-slate-200'
                        }`}>
                          {task.status}
                        </span>
                      </div>
                    </div>

                    {/* Main Content Area */}
                    <div className={`px-8 transition-all duration-300 ${isMinimized ? 'py-4' : 'py-8'}`}>
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h2 className={`font-black text-slate-800 uppercase tracking-tight transition-all duration-300 ${isMinimized ? 'text-xs mb-2' : 'text-lg mb-4'}`}>
                            {task.activity}
                          </h2>
                          
                          <div className={`flex flex-wrap gap-x-8 gap-y-2 items-center transition-all duration-300 ${isMinimized ? 'opacity-60 scale-95 origin-left' : 'opacity-100'}`}>
                            <div className="flex items-center gap-2 text-slate-500">
                              <CalendarDaysIcon className="h-4 w-4 text-slate-300" />
                              <span className="text-[10px] font-bold">{task.date}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500">
                              <UserGroupIcon className="h-4 w-4 text-slate-300" />
                              <span className="text-[10px] font-black uppercase tracking-tighter truncate max-w-[150px]">{task.performer}</span>
                            </div>
                          </div>

                          {task.observations && (
                            <div className={`mt-3 p-3 bg-slate-50 rounded-xl border-l-4 border-indigo-400 text-[10px] text-slate-600 italic transition-all duration-300 ${isMinimized ? 'line-clamp-1 max-w-md' : ''}`}>
                              "{task.observations}"
                            </div>
                          )}
                        </div>

                        {/* Action for Minimized Card */}
                        {isMinimized && (
                          <button 
                            onClick={() => undoStatus(task.id)}
                            className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm"
                            title="Refazer Atividade"
                          >
                            <ArrowPathIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions only for Pending */}
                    {!isMinimized && (
                      <div className="px-8 pb-8 pt-2">
                        <div className="flex flex-col sm:flex-row gap-4">
                          <button 
                            onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.COMPLETED })} 
                            className="flex-1 py-4 bg-[#0DA66D] text-white rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-3 shadow-lg shadow-emerald-100 hover:brightness-105 active:scale-95 transition-all"
                          >
                            <CheckCircleIcon className="h-5 w-5" /> Concluir
                          </button>
                          <button 
                            onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.RESCHEDULED })} 
                            className="flex-1 py-4 bg-white border-2 border-[#F59E0B] text-[#F59E0B] rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-3 hover:bg-amber-50 active:scale-95 transition-all"
                          >
                            <CalendarDaysIcon className="h-5 w-5" /> Reprogramar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="py-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200 px-8">
                  <CloudArrowUpIcon className="h-16 w-16 text-indigo-200 mx-auto mb-6 opacity-30" />
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">Workspace Vazio</h2>
                  <p className="text-slate-400 text-sm mb-10">Carregue uma planilha CSV para iniciar.</p>
                  {isAdmin && (
                    <label className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase cursor-pointer shadow-xl hover:bg-indigo-700 transition-all inline-flex items-center gap-3">
                      <PlusIcon className="h-5 w-5" /> Importar Dados
                      <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* MODAL GESTOR */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl">
          <div className="bg-white rounded-[4rem] p-16 w-full max-w-sm text-center shadow-2xl">
            <h3 className="text-2xl font-black mb-10 uppercase text-slate-800 tracking-tighter">Login Workspace</h3>
            <button onClick={() => { setIsAdmin(true); setShowLogin(false); }} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[11px] shadow-2xl hover:bg-slate-800 transition-all">Acessar Administração</button>
            <button onClick={() => setShowLogin(false)} className="mt-6 text-[11px] font-black text-slate-400 uppercase">Voltar</button>
          </div>
        </div>
      )}

      {/* MODAIS OBSERVAÇÃO */}
      {activeModal && (
        <ObservationModal 
          isOpen={!!activeModal} 
          type={activeModal.type} 
          onClose={() => setActiveModal(null)} 
          onSubmit={obs => updateStatus(activeModal.taskId, activeModal.type, obs)} 
        />
      )}

      {/* NOTIFICAÇÃO */}
      {notification && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-10 py-5 rounded-[2rem] flex items-center gap-4 shadow-2xl animate-in slide-in-from-bottom-10">
          <CheckCircleIcon className="h-6 w-6 text-emerald-400" />
          <span className="text-[11px] font-black uppercase tracking-widest">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-4 p-1 hover:bg-white/10 rounded-full transition-colors"><XMarkIcon className="h-5 w-5" /></button>
        </div>
      )}
    </div>
  );
};

export default App;
