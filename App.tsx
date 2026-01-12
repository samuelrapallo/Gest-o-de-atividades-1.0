
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
      // Sempre atualiza se for o primeiro carregamento ou se a nuvem tiver dados mais novos
      if (updatedAt > lastSync || !isSilent) {
        setTasks(cloudTasks);
        setLastSync(updatedAt);
      }
    } catch (e) {
      console.error("Erro na sincronização:", e);
    } finally {
      setLoading(false);
      setTimeout(() => setIsSyncing(false), 500);
    }
  }, [lastSync]);

  // Efeito de sincronização inicial e canais de atualização
  useEffect(() => {
    syncWithCloud();
    
    // Escuta atualizações de outras abas/instâncias
    api.onExternalChange(() => {
      syncWithCloud(true);
    });

    // Polling agressivo para simular tempo real em diferentes dispositivos
    const interval = setInterval(() => syncWithCloud(true), 3000);
    
    // Sincroniza quando a aba volta a ficar visível
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncWithCloud(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncWithCloud]);

  const persistChanges = async (newTasks: Task[]) => {
    setIsSyncing(true);
    const newTimestamp = await api.saveTasks(newTasks);
    setTasks(newTasks);
    setLastSync(newTimestamp);
    setTimeout(() => setIsSyncing(false), 800);
  };

  const clearApp = async () => {
    if(confirm("Deseja apagar TODOS os dados deste Workspace? Esta ação é irreversível para todos os usuários.")) {
      await api.clearCloud();
      setTasks([]);
      setNotification({ message: 'Workspace reiniciado com sucesso!', type: 'success' });
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
              orderNumber: parts[1] || '0',
              date: parts[2] || new Date().toLocaleDateString(),
              performer: parts[3] || 'Não atribuído',
              status: TaskStatus.PENDING,
              observations: ''
            });
          }
        }
        await persistChanges(newTasks);
        setNotification({ message: 'Planilha importada com sucesso!', type: 'success' });
      } catch (err) {
        setNotification({ message: 'Erro ao processar arquivo.', type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const shareLink = () => {
    const link = api.getWsLink();
    navigator.clipboard.writeText(link).then(() => {
      setNotification({ message: 'Link do Workspace compartilhado copiado!', type: 'success' });
    }).catch(() => {
      alert("Link do Workspace: " + link);
    });
  };

  const exportToExcel = () => {
    if (tasks.length === 0) return;
    
    // Construção de arquivo HTML que o Excel interpreta com cores e estilos
    const excelHeader = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8"></head>
      <body>
      <table border="1">
        <tr style="background-color: #1e293b; color: #ffffff; font-weight: bold;">
          <th>Atividade</th><th>Ordem</th><th>Data</th><th>Executante</th><th>Status</th><th>Observações</th>
        </tr>`;
    
    const rows = tasks.map(t => {
      let bgColor = '#ffffff';
      let textColor = '#1e293b';
      
      if (t.status === TaskStatus.COMPLETED) {
        bgColor = '#dcfce7'; // bg-emerald-100
        textColor = '#065f46'; // text-emerald-800
      } else if (t.status === TaskStatus.RESCHEDULED) {
        bgColor = '#fef3c7'; // bg-amber-100
        textColor = '#92400e'; // text-amber-800
      }

      return `
        <tr style="background-color: ${bgColor}; color: ${textColor};">
          <td>${t.activity}</td>
          <td>${t.orderNumber}</td>
          <td>${t.date}</td>
          <td>${t.performer}</td>
          <td>${t.status}</td>
          <td>${t.observations}</td>
        </tr>`;
    }).join('');

    const excelFooter = `</table></body></html>`;
    const fullContent = excelHeader + rows + excelFooter;
    
    const blob = new Blob([fullContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Relatorio_Executivo_${new Date().toLocaleDateString().replace(/\//g, '-')}.xls`;
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

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const search = filter.toLowerCase();
      return t.activity.toLowerCase().includes(search) || 
             t.performer.toLowerCase().includes(search) ||
             t.orderNumber.toString().toLowerCase().includes(search);
    }).filter(t => selectedPerformer === 'Todos' || t.performer === selectedPerformer);
  }, [tasks, filter, selectedPerformer]);

  const performersList = useMemo(() => Array.from(new Set(tasks.map(t => t.performer))), [tasks]);

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-sm font-black text-indigo-600 uppercase tracking-widest animate-pulse">Sincronizando Workspace...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20 selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 md:px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100">
              <ClipboardDocumentListIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none text-slate-800">GESTOR EXECUTIVO</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <WifiIcon className={`h-3 w-3 ${isSyncing ? 'text-amber-500 animate-pulse' : 'text-emerald-500'}`} />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Live WS: {api.getWsId()}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={exportToExcel} className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 border border-emerald-100 flex items-center gap-2 transition-all">
              <ArrowDownTrayIcon className="h-5 w-5" />
              <span className="hidden sm:inline text-[10px] font-black uppercase">Exportar Excel</span>
            </button>
            <button onClick={shareLink} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 border border-indigo-100 flex items-center gap-2 transition-all" title="Link de Compartilhamento">
              <LinkIcon className="h-5 w-5" />
              <span className="hidden sm:inline text-[10px] font-black uppercase">Link</span>
            </button>
            {isAdmin ? (
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button onClick={clearApp} className="p-2 text-red-500 hover:bg-white rounded-lg transition-all" title="Limpar Workspace"><TrashIcon className="h-5 w-5" /></button>
                <button onClick={() => setIsAdmin(false)} className="px-3 py-2 bg-white text-slate-700 rounded-lg text-[10px] font-black uppercase shadow-sm">Gestor On</button>
              </div>
            ) : (
              <button onClick={() => setShowLogin(true)} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-200">Área Gestor</button>
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
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Métricas Atuais</h3>
                <div className="h-56 w-full relative mb-4">
                   <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-4xl font-black text-slate-800">{globalStats.rate}%</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Sucesso</span>
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
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <p className="text-[9px] font-black text-emerald-600 uppercase">Concluídos</p>
                    <p className="text-xl font-black text-emerald-700">{globalStats.completed}</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100">
                    <p className="text-[9px] font-black text-amber-600 uppercase">Reprogramados</p>
                    <p className="text-xl font-black text-amber-700">{globalStats.rescheduled}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* LISTA DE CARDS - BASEADO NA IMAGEM */}
            <div className="lg:col-span-8 space-y-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input type="text" placeholder="Filtrar por atividade ou pessoa..." className="w-full pl-10 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl outline-none text-sm font-semibold focus:ring-4 ring-indigo-500/5 transition-all shadow-sm" value={filter} onChange={e => setFilter(e.target.value)} />
                </div>
                <select className="px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase cursor-pointer text-slate-600 shadow-sm" value={selectedPerformer} onChange={e => setSelectedPerformer(e.target.value)}>
                  <option value="Todos">Visualização: Todos</option>
                  {performersList.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="space-y-4">
                {filteredTasks.map(task => (
                  <div key={task.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md border-b-4 border-b-slate-100">
                    {/* Header - Ordem e Status */}
                    <div className="px-6 py-4 flex justify-between items-center bg-slate-50/20 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-slate-400">
                        <HashtagIcon className="h-4 w-4" />
                        <span className="text-xs font-black uppercase tracking-widest">{task.orderNumber}</span>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                        task.status === TaskStatus.COMPLETED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        task.status === TaskStatus.RESCHEDULED ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}>
                        {task.status}
                      </span>
                    </div>

                    {/* Corpo */}
                    <div className="px-6 py-6">
                      <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase leading-snug mb-4">
                        {task.activity}
                      </h2>
                      
                      <div className="flex flex-wrap items-center gap-6 mb-4">
                        <div className="flex items-center gap-2 text-slate-500">
                          <CalendarDaysIcon className="h-4 w-4 text-slate-300" />
                          <span className="text-xs font-bold">{task.date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <UserGroupIcon className="h-4 w-4 text-slate-300" />
                          <span className="text-xs font-black uppercase tracking-tighter truncate max-w-[200px]">{task.performer}</span>
                        </div>
                      </div>

                      {task.observations && (
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic text-[11px] text-slate-500 border-l-4 border-l-indigo-400">
                          "{task.observations}"
                        </div>
                      )}
                    </div>

                    {/* Rodapé de Ações */}
                    <div className="px-6 pb-6 pt-2">
                      {task.status === TaskStatus.PENDING ? (
                        <div className="flex flex-col sm:flex-row gap-4">
                          <button 
                            onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.COMPLETED })} 
                            className="flex-1 py-4 bg-[#0DA66D] text-white rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 hover:brightness-105 transition-all active:scale-[0.98]"
                          >
                            <CheckCircleIcon className="h-5 w-5" /> Concluir
                          </button>
                          <button 
                            onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.RESCHEDULED })} 
                            className="flex-1 py-4 bg-white border-2 border-[#F59E0B] text-[#F59E0B] rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-2 hover:bg-amber-50 transition-all active:scale-[0.98]"
                          >
                            <CalendarDaysIcon className="h-5 w-5" /> Reprogramar
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => undoStatus(task.id)} 
                          className="w-full py-3.5 bg-slate-100 text-slate-400 rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-2 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-[0.98]"
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
          <div className="py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 text-center px-6">
             <div className="bg-indigo-50 p-12 rounded-[3rem] w-40 h-40 mx-auto mb-10 flex items-center justify-center animate-pulse">
                <CloudArrowUpIcon className="h-20 w-20 text-indigo-200" />
             </div>
             <h2 className="text-3xl font-black text-slate-900 mb-4 uppercase tracking-tighter">Workspace Vazio</h2>
             <p className="text-slate-400 font-medium text-base mb-12 max-w-sm mx-auto">
               O gestor precisa importar uma planilha para que as atividades apareçam para todos os usuários deste link.
             </p>
             {isAdmin ? (
               <label className="bg-indigo-600 text-white px-12 py-5 rounded-2xl font-black text-sm cursor-pointer shadow-2xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-105 inline-flex items-center gap-4 transition-all active:scale-95 uppercase">
                 <PlusIcon className="h-6 w-6" /> Importar CSV Global
                 <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
               </label>
             ) : (
               <button onClick={() => setShowLogin(true)} className="bg-white border-2 border-slate-200 px-12 py-5 rounded-2xl font-black text-slate-700 shadow-md hover:bg-slate-50 transition-all active:scale-95 text-sm uppercase">Acesso Administrativo</button>
             )}
          </div>
        )}
      </main>

      {/* NOTIFICAÇÃO FLUTUANTE */}
      {notification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white rounded-[1.5rem] px-8 py-5 flex items-center gap-4 shadow-2xl animate-in slide-in-from-bottom-10">
          <CheckCircleIcon className="h-6 w-6 text-emerald-400" />
          <span className="text-[11px] font-black uppercase tracking-tight">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-4 p-1.5 hover:bg-white/10 rounded-full transition-colors"><XMarkIcon className="h-4 w-4" /></button>
        </div>
      )}

      {/* LOGIN GESTOR */}
      {showLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl animate-in fade-in">
          <div className="bg-white rounded-[4rem] shadow-2xl w-full max-w-sm p-16 text-center animate-in zoom-in-95">
             <div className="bg-indigo-600 h-16 w-16 rounded-[1.5rem] mx-auto mb-8 flex items-center justify-center shadow-xl shadow-indigo-100">
               <ClipboardDocumentListIcon className="h-8 w-8 text-white" />
             </div>
             <h3 className="text-2xl font-black mb-10 text-slate-800 uppercase tracking-tighter">Área do Gestor</h3>
             <button onClick={() => {setIsAdmin(true); setShowLogin(false);}} className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-5 rounded-[2rem] font-black hover:bg-slate-800 transition-all text-[11px] uppercase shadow-2xl active:scale-95">
               Autenticar Workspace
             </button>
             <button onClick={() => setShowLogin(false)} className="mt-8 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">Voltar</button>
          </div>
        </div>
      )}

      {/* MODAL DE OBSERVAÇÃO */}
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
