
import React, { useState, useMemo, useEffect } from 'react';
import { 
  PlusIcon, 
  TrashIcon, 
  CheckCircleIcon, 
  MagnifyingGlassIcon, 
  ArrowDownTrayIcon, 
  ShareIcon,
  UserCircleIcon,
  ArrowPathIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  CalendarDaysIcon,
  CloudArrowUpIcon,
  CloudIcon,
  HashtagIcon,
  UserGroupIcon
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

const generateUUID = () => crypto.randomUUID?.() || Math.random().toString(36).substring(2, 15);

const exportTasksToExcel = (tasks: Task[]) => {
  const table = document.createElement('table');
  const header = `
    <thead>
      <tr style="background-color: #f3f4f6; font-weight: bold;">
        <th>Atividade</th>
        <th>N. Ordem</th>
        <th>Executante</th>
        <th>Data</th>
        <th>Status</th>
        <th>Observações</th>
      </tr>
    </thead>
  `;
  
  const rows = tasks.map(t => {
    let bgColor = '#ffffff';
    let textColor = '#1f2937';
    if (t.status === TaskStatus.COMPLETED) {
      bgColor = '#c6efce';
      textColor = '#006100';
    } else if (t.status === TaskStatus.RESCHEDULED) {
      bgColor = '#ffeb9c';
      textColor = '#9c5600';
    }
    return `
      <tr style="background-color: ${bgColor}; color: ${textColor};">
        <td>${t.activity}</td>
        <td>${t.orderNumber}</td>
        <td>${t.performer}</td>
        <td>${t.date}</td>
        <td>${t.status}</td>
        <td>${t.observations || ''}</td>
      </tr>
    `;
  }).join('');

  table.innerHTML = header + `<tbody>${rows}</tbody>`;
  const blob = new Blob(['\ufeff', table.outerHTML], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Relatorio_${new Date().toISOString().split('T')[0]}.xls`;
  link.click();
  URL.revokeObjectURL(url);
};

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedPerformer, setSelectedPerformer] = useState('Todos');
  const [activeModal, setActiveModal] = useState<{ taskId: string, type: TaskStatus } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(localStorage.getItem('user_name'));

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await api.fetchTasks();
        setTasks(data);
      } catch (e) {
        setNotification({ message: 'Erro ao conectar ao banco.', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setSyncing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        const newTasks: Task[] = [];
        const delimiter = lines[0].includes(';') ? ';' : ',';

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
              performer,
              date: date || new Date().toLocaleDateString(),
              status: TaskStatus.PENDING,
              observations: ''
            });
          }
        }
        await api.saveTasks(newTasks);
        setTasks(newTasks);
        setNotification({ message: 'Planilha importada com sucesso!', type: 'success' });
      } catch (err) {
        setNotification({ message: 'Erro ao processar arquivo.', type: 'error' });
      } finally {
        setSyncing(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDeleteSpreadsheet = async () => {
    if (!isAdmin) {
      setNotification({ message: 'Ação restrita ao administrador.', type: 'error' });
      return;
    }
    if (!confirm("Tem certeza que deseja APAGAR TODOS os dados? Esta ação é irreversível.")) return;
    
    setSyncing(true);
    try {
      await api.deleteAllTasks();
      setTasks([]);
      setNotification({ message: 'Todos os dados foram removidos.', type: 'success' });
    } catch (e) {
      setNotification({ message: 'Erro ao apagar dados.', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const updateTaskStatus = async (id: string, status: TaskStatus, observations: string) => {
    setSyncing(true);
    try {
      const updatedTasks = await api.updateTask(id, { 
        status, 
        observations, 
        updatedBy: currentUser || 'Colaborador' 
      });
      setTasks(updatedTasks);
      setActiveModal(null);
      setNotification({ message: 'Atividade atualizada e minimizada.', type: 'success' });
    } catch (e) {
      setNotification({ message: 'Falha na sincronização.', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const resetTask = async (id: string) => {
    setSyncing(true);
    try {
      const updatedTasks = await api.updateTask(id, { status: TaskStatus.PENDING, observations: '' });
      setTasks(updatedTasks);
      setNotification({ message: 'Atividade restaurada.', type: 'success' });
    } finally {
      setSyncing(false);
    }
  };

  const performanceIndividual = useMemo(() => {
    const performers = Array.from(new Set(tasks.map(t => t.performer)));
    return performers.map(p => {
      const pTasks = tasks.filter(t => t.performer === p);
      const done = pTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
      const percent = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
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
      rate: total > 0 ? ((completed / total) * 100).toFixed(1) : "0.0"
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const search = filter.toLowerCase();
      return (t.activity.toLowerCase().includes(search) || t.performer.toLowerCase().includes(search) || t.orderNumber.toLowerCase().includes(search)) &&
             (selectedPerformer === 'Todos' || t.performer === selectedPerformer);
    });
  }, [tasks, filter, selectedPerformer]);

  const chartData = [
    { name: 'Concluídas', value: stats.completed, color: '#10B981' },
    { name: 'Pendentes', value: stats.pending, color: '#3B82F6' },
    { name: 'Reprogramadas', value: stats.rescheduled, color: '#F59E0B' }
  ].filter(d => d.value > 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans text-gray-900">
      {notification && (
        <div className="fixed top-6 right-6 z-[100] flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl bg-white border border-gray-100 animate-in slide-in-from-right">
          <CheckCircleIcon className="h-5 w-5 text-green-500" />
          <span className="font-bold text-sm">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-gray-300 hover:text-gray-500"><XMarkIcon className="h-4 w-4" /></button>
        </div>
      )}

      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-100"><ClipboardDocumentListIcon className="h-6 w-6 text-white" /></div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-black tracking-tight leading-none">Gestor Executivo</h1>
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-green-500 uppercase tracking-wider">
                {syncing ? <CloudArrowUpIcon className="h-3 w-3 animate-bounce" /> : <CloudIcon className="h-3 w-3" />}
                {syncing ? 'Sincronizando...' : 'Conexão Ativa'}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 items-center">
            {isAdmin ? (
              <div className="flex gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                <button onClick={handleDeleteSpreadsheet} title="Limpar tudo" className="p-2.5 text-red-500 hover:bg-white rounded-xl transition-all"><TrashIcon className="h-5 w-5" /></button>
                <button onClick={() => exportTasksToExcel(tasks)} className="p-2.5 text-emerald-600 hover:bg-white rounded-xl transition-all"><ArrowDownTrayIcon className="h-5 w-5" /></button>
                <button onClick={() => setIsAdmin(false)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100">Sair Admin</button>
              </div>
            ) : (
              <button onClick={() => setShowLogin(true)} className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50">Admin Login</button>
            )}
            <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-black border border-indigo-100 text-xs shadow-inner">
              {currentUser ? currentUser[0].toUpperCase() : <UserCircleIcon className="h-6 w-6" />}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {tasks.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* DASHBOARDS */}
            <div className="lg:col-span-4 space-y-8">
              <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2"><ArrowTrendingUpIcon className="h-4 w-4" /> Progresso Geral</h3>
                <div className="h-64 w-full relative">
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-black text-gray-800">{stats.rate}%</span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Sucesso</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} innerRadius={70} outerRadius={95} paddingAngle={5} dataKey="value" stroke="none">
                        {chartData.map((e, i) => <Cell key={i} fill={e.color} cornerRadius={6} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2"><ChartBarIcon className="h-4 w-4" /> Desempenho por Pessoa (%)</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceIndividual} layout="vertical" margin={{ left: -20, right: 30 }}>
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

            {/* LISTAGEM DE ATIVIDADES */}
            <div className="lg:col-span-8 space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input 
                    type="text" placeholder="Localizar atividade, ordem ou executante..." 
                    className="w-full pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-medium"
                    value={filter} onChange={e => setFilter(e.target.value)}
                  />
                </div>
                <select 
                  className="px-6 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm font-bold text-xs outline-none cursor-pointer"
                  value={selectedPerformer} onChange={e => setSelectedPerformer(e.target.value)}
                >
                  <option value="Todos">Executantes: Todos</option>
                  {Array.from(new Set(tasks.map(t => t.performer))).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="space-y-4">
                {filteredTasks.map(task => {
                  const isMinimized = task.status !== TaskStatus.PENDING;
                  return (
                    <div key={task.id} className={`bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden transition-all duration-300 ${isMinimized ? 'opacity-80 scale-[0.98]' : 'hover:shadow-md'}`}>
                      {/* Header Compacto */}
                      <div className={`px-8 py-3 flex justify-between items-center border-b border-gray-50 ${isMinimized ? 'bg-gray-50/50' : 'bg-white'}`}>
                        <div className="flex items-center gap-3">
                          <HashtagIcon className="h-3.5 w-3.5 text-gray-300" />
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{task.orderNumber}</span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          task.status === TaskStatus.COMPLETED ? 'bg-green-50 text-green-600 border-green-100' :
                          task.status === TaskStatus.RESCHEDULED ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-400 border-gray-200'
                        }`}>
                          {task.status}
                        </span>
                      </div>

                      {/* Conteúdo Principal */}
                      <div className={`px-8 transition-all duration-300 ${isMinimized ? 'py-4' : 'py-8'}`}>
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h2 className={`font-black text-gray-800 uppercase tracking-tight leading-tight transition-all duration-300 ${isMinimized ? 'text-sm mb-2' : 'text-lg mb-4'}`}>
                              {task.activity}
                            </h2>
                            {!isMinimized ? (
                              <div className="flex flex-wrap gap-8 items-center mb-4">
                                <div className="flex items-center gap-2 text-gray-500">
                                  <CalendarDaysIcon className="h-4 w-4 text-gray-300" />
                                  <span className="text-[10px] font-bold">{task.date}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-500">
                                  <UserGroupIcon className="h-4 w-4 text-gray-300" />
                                  <span className="text-[10px] font-black uppercase tracking-widest truncate max-w-[150px]">{task.performer}</span>
                                </div>
                              </div>
                            ) : (
                               <div className="text-[10px] text-gray-400 font-bold uppercase">{task.performer} • {task.date}</div>
                            )}
                            
                            {task.observations && (
                              <div className={`mt-3 p-3 bg-gray-50 rounded-xl border-l-4 border-indigo-400 text-[10px] text-gray-600 italic leading-relaxed ${isMinimized ? 'line-clamp-1' : ''}`}>
                                "{task.observations}"
                              </div>
                            )}
                          </div>

                          {isMinimized && (
                            <button onClick={() => resetTask(task.id)} className="p-3 bg-white text-gray-400 rounded-2xl border border-gray-100 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm">
                              <ArrowPathIcon className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Ações apenas para Pendentes */}
                      {!isMinimized && (
                        <div className="px-8 pb-8 pt-2">
                          <div className="flex flex-col sm:flex-row gap-4">
                            <button 
                              onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.COMPLETED })} 
                              className="flex-1 py-4 bg-[#0DA66D] text-white rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-3 shadow-lg shadow-emerald-100 hover:brightness-105 active:scale-[0.98] transition-all"
                            >
                              <CheckCircleIcon className="h-5 w-5" /> Concluir
                            </button>
                            <button 
                              onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.RESCHEDULED })} 
                              className="flex-1 py-4 bg-white border-2 border-[#F59E0B] text-[#F59E0B] rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-3 hover:bg-orange-50 active:scale-[0.98] transition-all"
                            >
                              <CalendarDaysIcon className="h-5 w-5" /> Reprogramar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-40 bg-white rounded-[4rem] border-2 border-dashed border-gray-100 px-6 text-center">
             <div className="bg-indigo-50 p-12 rounded-[3.5rem] mb-10 animate-pulse"><CloudArrowUpIcon className="h-24 w-24 text-indigo-200" /></div>
             <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tighter">Workspace Disponível</h2>
             <p className="text-gray-400 font-medium mb-12 max-w-md mx-auto">Adicione uma planilha CSV com as colunas: Atividade, Número da Ordem, Data e Executante.</p>
             {isAdmin ? (
               <label className="bg-indigo-600 text-white px-16 py-6 rounded-[2.5rem] font-black text-sm uppercase cursor-pointer shadow-2xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-4">
                 <PlusIcon className="h-6 w-6" /> Importar Planilha CSV
                 <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
               </label>
             ) : (
               <button onClick={() => setShowLogin(true)} className="bg-white border-2 border-gray-100 px-14 py-6 rounded-[2.5rem] font-black text-gray-700 shadow-xl hover:bg-gray-50 transition-all text-xs uppercase tracking-widest">Entrar como Gestor</button>
             )}
          </div>
        )}
      </main>

      {showLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-xl animate-in fade-in">
          <div className="bg-white rounded-[4rem] shadow-2xl w-full max-w-sm p-16 text-center animate-in zoom-in-95">
             <div className="bg-indigo-600 h-20 w-20 rounded-3xl mx-auto mb-10 flex items-center justify-center shadow-xl shadow-indigo-100">
               <ClipboardDocumentListIcon className="h-10 w-10 text-white" />
             </div>
             <h3 className="text-2xl font-black mb-10 uppercase text-gray-800 tracking-tighter">Acesso Administrador</h3>
             <button onClick={() => {setIsAdmin(true); setShowLogin(false); setCurrentUser('Admin');}} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[11px] shadow-2xl hover:bg-slate-800 active:scale-95 transition-all">
               Entrar no Painel
             </button>
             <button onClick={() => setShowLogin(false)} className="mt-8 text-[11px] text-gray-400 font-black uppercase tracking-widest hover:text-red-500">Cancelar</button>
          </div>
        </div>
      )}

      {activeModal && (
        <ObservationModal isOpen={!!activeModal} type={activeModal.type} onClose={() => setActiveModal(null)} onSubmit={obs => updateTaskStatus(activeModal.taskId, activeModal.type, obs)} />
      )}
    </div>
  );
};

export default App;
