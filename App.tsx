
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

// Utilitário para exportar Excel com cores via HTML Table Blob
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
      bgColor = '#c6efce'; // Verde claro para Excel
      textColor = '#006100';
    } else if (t.status === TaskStatus.RESCHEDULED) {
      bgColor = '#ffeb9c'; // Laranja/Amarelo claro para Excel
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
  
  const blob = new Blob(['\ufeff', table.outerHTML], { 
    type: 'application/vnd.ms-excel' 
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Relatorio_Atividades_${new Date().toISOString().split('T')[0]}.xls`;
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
        setNotification({ message: 'Sincronizado com a nuvem!', type: 'success' });
      } catch (err) {
        setNotification({ message: 'Erro no processamento do arquivo.', type: 'error' });
      } finally {
        setSyncing(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDeleteSpreadsheet = async () => {
    if (!isAdmin) return;
    if (!confirm("Tem certeza que deseja apagar toda a planilha? Esta ação não pode ser desfeita.")) return;
    
    setSyncing(true);
    try {
      await api.deleteAllTasks();
      setTasks([]);
      setNotification({ message: 'Dados apagados com sucesso!', type: 'success' });
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
      setNotification({ message: 'Status atualizado!', type: 'success' });
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
      setNotification({ message: 'Atividade reiniciada.', type: 'success' });
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

  const generateShareLink = () => {
    const url = window.location.href.split('#')[0];
    navigator.clipboard.writeText(url).then(() => {
      setNotification({ message: 'Link copiado! Todos verão os dados em tempo real.', type: 'success' });
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Acessando Banco de Dados...</p>
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
          <button onClick={() => setNotification(null)} className="text-gray-300 hover:text-gray-500"><XMarkIcon className="h-4 w-4" /></button>
        </div>
      )}

      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-100"><ClipboardDocumentListIcon className="h-6 w-6 text-white" /></div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-black tracking-tight leading-none mb-1">Gestor Executivo</h1>
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-green-500 uppercase tracking-wider">
                {syncing ? <CloudArrowUpIcon className="h-3 w-3 animate-bounce" /> : <CloudIcon className="h-3 w-3" />}
                {syncing ? 'Sincronizando...' : 'Live Cloud Connect'}
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 items-center">
            {isAdmin ? (
              <div className="flex gap-2">
                <button 
                  onClick={handleDeleteSpreadsheet}
                  title="Apagar todos os dados"
                  className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
                <button 
                  onClick={() => exportTasksToExcel(tasks)}
                  className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-100"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" /> Exportar
                </button>
                <button 
                  onClick={generateShareLink}
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-100"
                >
                  <ShareIcon className="h-4 w-4" /> Link
                </button>
                <button onClick={() => setIsAdmin(false)} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold">
                  Sair
                </button>
              </div>
            ) : (
              <button onClick={() => setShowLogin(true)} className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50">
                Acesso Gestor
              </button>
            )}
            <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-black border border-indigo-100 text-xs shadow-inner">
              {currentUser ? currentUser[0].toUpperCase() : <UserCircleIcon className="h-6 w-6" />}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {tasks.length > 0 ? (
          <div className="space-y-10">
            {/* Top KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Total', val: stats.total, color: 'text-gray-500', bg: 'bg-white' },
                { label: 'Pendentes', val: stats.pending, color: 'text-blue-500', bg: 'bg-white' },
                { label: 'Concluídas', val: stats.completed, color: 'text-green-500', bg: 'bg-white' },
                { label: 'Reprogramadas', val: stats.rescheduled, color: 'text-orange-500', bg: 'bg-white' }
              ].map(card => (
                <div key={card.label} className={`${card.bg} p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col transition-transform hover:scale-[1.02]`}>
                   <div className="text-3xl font-black text-gray-900 mb-1">{card.val}</div>
                   <div className={`text-[9px] font-black uppercase tracking-widest ${card.color}`}>{card.label}</div>
                </div>
              ))}
            </div>

            {/* Dashboard Visual */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8 lg:p-12 flex flex-col lg:flex-row items-center gap-16">
                <div className="w-full lg:w-1/2 h-[380px] relative">
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-4xl font-black text-gray-900">{stats.rate}%</span>
                     <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Concluído</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={chartData} cx="50%" cy="50%" innerRadius={100} outerRadius={160} paddingAngle={4} dataKey="value" strokeWidth={0}
                        labelLine={false} label={({percent}) => `${(percent * 100).toFixed(0)}%`}
                      >
                        {chartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full lg:w-1/2 flex flex-col gap-4">
                   <h3 className="text-xl font-black mb-4 tracking-tight flex items-center gap-2">
                     <ArrowTrendingUpIcon className="h-6 w-6 text-indigo-600" /> 
                     Performance do Dia
                   </h3>
                   {[
                     { label: 'Concluídas', val: stats.completed, color: 'bg-green-500', bg: 'bg-green-50/50', text: 'text-green-700' },
                     { label: 'Pendentes', val: stats.pending, color: 'bg-blue-500', bg: 'bg-blue-50/50', text: 'text-blue-700' },
                     { label: 'Reprogramadas', val: stats.rescheduled, color: 'bg-orange-500', bg: 'bg-orange-50/50', text: 'text-orange-700' }
                   ].map(l => (
                     <div key={l.label} className={`${l.bg} rounded-2xl px-8 py-6 flex items-center justify-between transition-all hover:translate-x-1`}>
                        <div className="flex items-center gap-4 font-bold text-gray-700">
                          <div className={`h-3 w-3 rounded-full ${l.color}`}></div>
                          {l.label}
                        </div>
                        <span className={`text-3xl font-black ${l.text}`}>{l.val}</span>
                     </div>
                   ))}
                </div>
            </div>

            {/* Filtros e Tabela */}
            <div className="space-y-6">
               <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="relative flex-1 w-full">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-300 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" placeholder="Pesquisar atividade ou executante..." 
                      className="w-full pl-12 pr-6 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm outline-none focus:ring-4 focus:ring-indigo-50/50 transition-all font-medium"
                      value={filter} onChange={e => setFilter(e.target.value)}
                    />
                  </div>
                  <select 
                    className="w-full sm:w-64 px-6 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm font-bold text-sm outline-none cursor-pointer"
                    value={selectedPerformer} onChange={e => setSelectedPerformer(e.target.value)}
                  >
                    <option value="Todos">Executantes: Todos</option>
                    {Array.from(new Set(tasks.map(t => t.performer))).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
               </div>

               <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
                  <table className="w-full text-left min-w-[800px]">
                    <thead>
                      <tr className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                        <th className="px-8 py-6">Status & Atividade</th>
                        <th className="px-8 py-6">Executante</th>
                        <th className="px-8 py-6 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredTasks.map(task => (
                        <tr key={task.id} className="group hover:bg-gray-50/30 transition-colors">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3 mb-2">
                               <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter shadow-sm ${
                                 task.status === TaskStatus.COMPLETED ? 'bg-green-100 text-green-700 border border-green-200' :
                                 task.status === TaskStatus.RESCHEDULED ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                               }`}>{task.status}</span>
                               <div className="text-sm font-bold text-gray-800 tracking-tight">{task.activity}</div>
                            </div>
                            {task.observations && (
                              <div className="text-[11px] text-gray-400 italic bg-gray-50/80 p-2 rounded-lg inline-block font-medium">
                                "{task.observations}" {task.updatedBy && <span className="text-indigo-400 font-bold ml-1">• {task.updatedBy}</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-gray-400 uppercase tracking-tighter">{task.performer}</span>
                              <span className="text-[10px] text-gray-300 font-medium">Ref: {task.orderNumber}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                             {task.status === TaskStatus.PENDING ? (
                               <div className="flex justify-end gap-3">
                                 <button onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.COMPLETED })} className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-green-700 active:scale-95 transition-all shadow-md">Concluir</button>
                                 <button onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.RESCHEDULED })} className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-orange-600 active:scale-95 transition-all shadow-md">Reprogramar</button>
                               </div>
                             ) : (
                               <button onClick={() => resetTask(task.id)} className="px-5 py-2.5 bg-white text-indigo-600 border-2 border-indigo-50 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:border-indigo-600 transition-all active:scale-95 ml-auto shadow-sm">
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
             <div className="bg-indigo-50 p-12 rounded-[3.5rem] mb-10 shadow-inner animate-pulse"><ClipboardDocumentListIcon className="h-24 w-24 text-indigo-200" /></div>
             <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter">Pronto para começar?</h2>
             <p className="text-gray-400 font-medium mb-12">Importe sua planilha diária para gerenciar as atividades.</p>
             {isAdmin ? (
               <label className="bg-indigo-600 text-white px-16 py-6 rounded-[2.5rem] font-black text-xl cursor-pointer shadow-2xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-4">
                 <PlusIcon className="h-7 w-7" /> Importar CSV Diário
                 <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
               </label>
             ) : (
               <button onClick={() => setShowLogin(true)} className="bg-white border-2 border-gray-100 px-14 py-6 rounded-[2.5rem] font-black text-gray-700 shadow-xl hover:bg-gray-50 transition-all">Área do Administrador</button>
             )}
          </div>
        )}
      </main>

      {showLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-12 text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
             <h3 className="text-2xl font-black mb-1 tracking-tight text-gray-900">Acesso Restrito</h3>
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-10">Somente para Gestores</p>
             <button onClick={() => {setIsAdmin(true); setShowLogin(false); setCurrentUser('Admin'); localStorage.setItem('user_name', 'Admin');}} className="w-full flex items-center justify-center gap-4 bg-white border-2 border-gray-100 py-5 rounded-[1.5rem] font-black text-gray-700 hover:border-indigo-200 transition-all active:scale-95 shadow-xl">
               <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="h-7 w-7" alt="G" /> Google Workspace
             </button>
             <button onClick={() => setShowLogin(false)} className="mt-8 text-[11px] text-gray-300 font-black uppercase tracking-widest hover:text-red-500 transition-colors">Cancelar</button>
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
