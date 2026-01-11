
import React, { useState, useMemo, useEffect } from 'react';
import { 
  PlusIcon, 
  TrashIcon, 
  CheckCircleIcon, 
  MagnifyingGlassIcon, 
  ArrowDownTrayIcon, 
  ShareIcon,
  LockClosedIcon,
  UserCircleIcon,
  ArrowPathIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  ChartPieIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  CalendarDaysIcon,
  CloudArrowUpIcon,
  CloudIcon
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

const generateUUID = () => crypto.randomUUID?.() || Math.random().toString(36).substring(2, 15);

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

  // Carregamento Inicial do Banco de Dados
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
          const [activity, orderNumber, date, performer] = line.split(delimiter).map(s => s.trim().replace(/^"|"$/g, ''));
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
        setNotification({ message: 'Sincronizado com a nuvem!', type: 'success' });
      } catch (err) {
        setNotification({ message: 'Erro no processamento.', type: 'error' });
      } finally {
        setSyncing(false);
      }
    };
    reader.readAsText(file);
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
      setNotification({ message: 'Status atualizado em tempo real!', type: 'success' });
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
    } finally {
      setSyncing(false);
    }
  };

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
      return (t.activity.toLowerCase().includes(search) || t.performer.toLowerCase().includes(search)) &&
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
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Conectando ao Banco...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans text-gray-900">
      {notification && (
        <div className="fixed top-6 right-6 z-[100] flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl bg-white border border-gray-100 animate-in slide-in-from-right duration-300">
          <CheckCircleIcon className="h-5 w-5 text-green-500" />
          <span className="font-bold text-sm">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-gray-300"><XMarkIcon className="h-4 w-4" /></button>
        </div>
      )}

      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-100"><ClipboardDocumentListIcon className="h-6 w-6 text-white" /></div>
            <div>
              <h1 className="text-xl font-black tracking-tight">Gestor Executivo</h1>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-500 uppercase tracking-wider">
                {syncing ? <CloudArrowUpIcon className="h-3 w-3 animate-bounce" /> : <CloudIcon className="h-3 w-3" />}
                {syncing ? 'Sincronizando...' : 'Conectado à Nuvem'}
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {isAdmin ? (
              <button onClick={() => setIsAdmin(false)} className="px-5 py-2.5 bg-gray-50 text-gray-500 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-gray-100">
                Sair do Painel Gestor
              </button>
            ) : (
              <button onClick={() => setShowLogin(true)} className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold">
                Painel do Gestor
              </button>
            )}
            <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold border border-indigo-100">
              {currentUser ? currentUser[0].toUpperCase() : <UserCircleIcon className="h-6 w-6" />}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {tasks.length > 0 ? (
          <div className="space-y-10">
            {/* Top KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Total', val: stats.total, color: 'text-gray-500' },
                { label: 'Pendentes', val: stats.pending, color: 'text-blue-500' },
                { label: 'Concluídas', val: stats.completed, color: 'text-green-500' },
                { label: 'Reprogramadas', val: stats.rescheduled, color: 'text-orange-500' }
              ].map(card => (
                <div key={card.label} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col transition-transform hover:scale-[1.02]">
                   <div className="text-3xl font-black text-gray-900 mb-1">{card.val}</div>
                   <div className={`text-[10px] font-black uppercase tracking-widest ${card.color}`}>{card.label}</div>
                </div>
              ))}
            </div>

            {/* Gráfico conforme Imagem */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-10 flex flex-col lg:flex-row items-center gap-12">
                <div className="w-full lg:w-1/2 h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={chartData} cx="50%" cy="50%" outerRadius={150} dataKey="value" strokeWidth={2} stroke="#fff"
                        labelLine={false} label={({percent}) => `${(percent * 100).toFixed(0)}%`}
                      >
                        {chartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full lg:w-1/2 flex flex-col gap-4">
                   {[
                     { label: 'Concluídas', val: stats.completed, color: 'bg-green-500', bg: 'bg-green-50/50', border: 'border-green-100', text: 'text-green-700' },
                     { label: 'Pendentes', val: stats.pending, color: 'bg-blue-500', bg: 'bg-blue-50/50', border: 'border-blue-100', text: 'text-blue-700' },
                     { label: 'Reprogramadas', val: stats.rescheduled, color: 'bg-orange-500', bg: 'bg-orange-50/50', border: 'border-orange-100', text: 'text-orange-700' }
                   ].map(l => (
                     <div key={l.label} className={`${l.bg} border ${l.border} rounded-xl px-8 py-6 flex items-center justify-between`}>
                        <div className="flex items-center gap-3 font-bold text-gray-700">
                          <div className={`h-3 w-3 rounded-full ${l.color}`}></div>
                          {l.label}
                        </div>
                        <span className={`text-3xl font-black ${l.text}`}>{l.val}</span>
                     </div>
                   ))}
                   <div className="bg-[#F8FAFC] border border-gray-100 rounded-2xl p-10 flex items-baseline gap-4 mt-4">
                      <span className="text-6xl font-black text-gray-900">{stats.rate}%</span>
                      <span className="text-gray-400 font-bold uppercase text-xs">de conclusão total</span>
                   </div>
                </div>
            </div>

            {/* Tabela de Atividades */}
            <div className="space-y-6">
               <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="relative flex-1 w-full">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-300 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" placeholder="Filtrar por nome ou tarefa..." 
                      className="w-full pl-12 pr-6 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm outline-none"
                      value={filter} onChange={e => setFilter(e.target.value)}
                    />
                  </div>
                  <select 
                    className="w-full sm:w-64 px-6 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm font-bold text-sm"
                    value={selectedPerformer} onChange={e => setSelectedPerformer(e.target.value)}
                  >
                    <option value="Todos">Todos Executantes</option>
                    {Array.from(new Set(tasks.map(t => t.performer))).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
               </div>

               <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                        <th className="px-8 py-6">Status / Atividade</th>
                        <th className="px-8 py-6">Executante</th>
                        <th className="px-8 py-6 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredTasks.map(task => (
                        <tr key={task.id} className="group hover:bg-gray-50/30">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3 mb-1.5">
                               <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                                 task.status === TaskStatus.COMPLETED ? 'bg-green-50 text-green-600' :
                                 task.status === TaskStatus.RESCHEDULED ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
                               }`}>{task.status}</span>
                               <div className="text-sm font-bold text-gray-800">{task.activity}</div>
                            </div>
                            {task.observations && (
                              <div className="text-[10px] text-gray-400 italic">
                                "{task.observations}" {task.updatedBy && <span className="text-indigo-400 ml-1">por {task.updatedBy}</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-8 py-6 text-sm font-black text-gray-400 uppercase tracking-tighter">{task.performer}</td>
                          <td className="px-8 py-6 text-right">
                             {task.status === TaskStatus.PENDING ? (
                               <div className="flex justify-end gap-2">
                                 <button onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.COMPLETED })} className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-green-700 transition-all">Concluir</button>
                                 <button onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.RESCHEDULED })} className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-orange-600 transition-all">Reprogramar</button>
                               </div>
                             ) : (
                               <button onClick={() => resetTask(task.id)} className="px-5 py-2.5 bg-white text-indigo-600 border-2 border-indigo-50 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:border-indigo-600 ml-auto">
                                 <ArrowPathIcon className="h-4 w-4" /> Refazer
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
        ) : (
          <div className="flex flex-col items-center justify-center py-40 bg-white rounded-[4rem] border-2 border-dashed border-gray-100">
             <div className="bg-indigo-50 p-10 rounded-[3rem] mb-10"><ClipboardDocumentListIcon className="h-20 w-20 text-indigo-200" /></div>
             <h2 className="text-4xl font-black text-gray-900 mb-10 tracking-tighter">Nenhuma Atividade em Nuvem</h2>
             {isAdmin ? (
               <label className="bg-indigo-600 text-white px-16 py-6 rounded-[2.5rem] font-black text-xl cursor-pointer shadow-2xl hover:bg-indigo-700 transition-all">
                 Fazer Upload da Planilha
                 <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
               </label>
             ) : (
               <button onClick={() => setShowLogin(true)} className="bg-white border-2 border-gray-100 px-14 py-6 rounded-[2.5rem] font-black text-gray-700 shadow-xl">Entrar como Gestor</button>
             )}
          </div>
        )}
      </main>

      {showLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-12 text-center">
             <h3 className="text-2xl font-black mb-10">Acesso Restrito</h3>
             <button onClick={() => {setIsAdmin(true); setShowLogin(false); setCurrentUser('Admin'); localStorage.setItem('user_name', 'Admin');}} className="w-full flex items-center justify-center gap-4 bg-white border-2 border-gray-100 py-5 rounded-[1.5rem] font-black text-gray-700 hover:border-indigo-200 transition-all">
               <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="h-7 w-7" alt="G" /> Login Workspace
             </button>
             <button onClick={() => setShowLogin(false)} className="mt-8 text-[10px] text-gray-300 font-black uppercase tracking-widest">Voltar</button>
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
