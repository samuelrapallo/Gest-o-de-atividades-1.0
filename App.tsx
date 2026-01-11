
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
  UserCircleIcon,
  ArrowPathIcon
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

// Codificação Unicode Segura para URL (Suporta acentos e emojis)
const encodeData = (data: any): string => {
  try {
    const jsonStr = JSON.stringify(data);
    // btoa(unescape(encodeURIComponent(str))) é o padrão ouro para Base64 UTF-8 em navegadores
    return btoa(unescape(encodeURIComponent(jsonStr)));
  } catch (e) {
    console.error("Erro ao codificar:", e);
    return "";
  }
};

const decodeData = (hash: string): any => {
  try {
    const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
    if (!cleanHash || cleanHash.length < 5) return null;
    
    // decodeURIComponent(escape(atob(str))) para reverter a codificação segura
    const decodedStr = decodeURIComponent(escape(atob(cleanHash)));
    const parsed = JSON.parse(decodedStr);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    console.warn("URL não contém dados válidos ou está incompleta.");
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadedFromUrl, setIsLoadedFromUrl] = useState(false);
  const [history, setHistory] = useState<Task[][]>([]);
  const [filter, setFilter] = useState('');
  const [selectedPerformer, setSelectedPerformer] = useState('Todos');
  const [activeModal, setActiveModal] = useState<{ taskId: string, type: TaskStatus } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // Inicialização e monitoramento de mudanças na URL
  useEffect(() => {
    const initData = () => {
      const fromHash = decodeData(window.location.hash);
      if (fromHash) {
        setTasks(fromHash);
        setIsLoadedFromUrl(true);
        setNotification({ message: 'Planilha sincronizada via link!', type: 'success' });
      } else {
        const saved = localStorage.getItem('executive_tasks');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) setTasks(parsed);
          } catch (e) {
            console.error("Erro ao ler localStorage");
          }
        }
      }
    };

    initData();
    window.addEventListener('hashchange', initData);
    return () => window.removeEventListener('hashchange', initData);
  }, []);

  // Sincronizar estado local com a URL e Storage automaticamente
  useEffect(() => {
    if (tasks.length > 0) {
      try {
        localStorage.setItem('executive_tasks', JSON.stringify(tasks));
        const hash = encodeData(tasks);
        // Limite de segurança para URLs de navegadores (aprox 14kb de hash)
        if (hash && hash.length < 14000) {
          window.history.replaceState(null, "", `#${hash}`);
        }
      } catch (e) {
        console.error("Erro na sincronização automática");
      }
    }
  }, [tasks]);

  const saveToHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-10), [...tasks]]);
  }, [tasks]);

  const handleGoogleLogin = () => {
    setNotification({ message: 'Validando credenciais...', type: 'success' });
    setTimeout(() => {
      setIsAdmin(true);
      setShowLogin(false);
      setNotification({ message: 'Acesso Administrativo Liberado', type: 'success' });
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
          setNotification({ message: `${newTasks.length} tarefas carregadas!`, type: 'success' });
        } else {
          setNotification({ message: 'Formato CSV inválido.', type: 'error' });
        }
      } catch (err) {
        setNotification({ message: 'Erro ao processar o arquivo.', type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const generateShareLink = () => {
    try {
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(() => {
        setNotification({ message: 'Link atualizado com dados copiado!', type: 'success' });
      });
    } catch (e) {
      setNotification({ message: 'Erro ao copiar link.', type: 'error' });
    }
  };

  const exportReport = () => {
    if (tasks.length === 0) return;
    try {
      let html = `<html><head><meta charset="UTF-8"><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f4f4}</style></head><body>
        <h2>Relatório Executivo - ${new Date().toLocaleDateString()}</h2>
        <table><thead><tr><th>Status</th><th>Atividade</th><th>Ordem</th><th>Data</th><th>Executante</th><th>Obs</th></tr></thead>
        <tbody>${tasks.map(t => `<tr><td>${t.status}</td><td>${t.activity}</td><td>${t.orderNumber}</td><td>${t.date}</td><td>${t.performer}</td><td>${t.observations}</td></tr>`).join('')}</tbody>
      </table></body></html>`;
      const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_diario_${new Date().getTime()}.xls`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setNotification({ message: 'Erro ao exportar Excel.', type: 'error' });
    }
  };

  const clearSheet = () => {
    if (!isAdmin) return;
    if (window.confirm('Isso apagará todos os dados atuais. Continuar?')) {
      setTasks([]);
      localStorage.removeItem('executive_tasks');
      window.history.replaceState(null, "", window.location.pathname);
      setNotification({ message: 'Sistema limpo.', type: 'success' });
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
    { name: 'Pendentes', value: stats.pending, color: '#3B82F6' },
    { name: 'Concluídas', value: stats.completed, color: '#10B981' },
    { name: 'Reprogramadas', value: stats.rescheduled, color: '#F59E0B' }
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
    <div className="min-h-screen bg-[#F8FAFC] pb-20 font-sans">
      {notification && (
        <div className="fixed top-6 right-6 z-[100] flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl bg-white border border-gray-100 text-gray-800 animate-in slide-in-from-top-4 duration-300">
          <div className={`p-2 rounded-full ${notification.type === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
            {notification.type === 'success' ? <CheckCircleIcon className="h-5 w-5 text-green-600" /> : <ExclamationCircleIcon className="h-5 w-5 text-red-600" />}
          </div>
          <span className="font-bold text-sm tracking-tight">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 p-1 hover:bg-gray-100 rounded-lg transition-colors"><XMarkIcon className="h-4 w-4 text-gray-400" /></button>
        </div>
      )}

      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-100">
              <ClipboardDocumentListIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                Gestor Executivo
                {isLoadedFromUrl && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full border border-green-200 uppercase font-black">Sync Link</span>}
              </h1>
              {isAdmin && <span className="text-[10px] text-indigo-600 font-black uppercase tracking-[0.2em] block mt-0.5">Painel Administrativo</span>}
            </div>
          </div>
          <div className="flex gap-3 items-center">
            {tasks.length > 0 && (
              <button onClick={exportReport} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm">
                <ArrowDownTrayIcon className="h-4 w-4" /> Excel
              </button>
            )}
            
            {isAdmin ? (
              <div className="flex gap-2">
                <button onClick={generateShareLink} className="px-6 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100">
                  <ShareIcon className="h-4 w-4" /> Compartilhar Link
                </button>
                <button onClick={clearSheet} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-2 border border-red-100">
                  <TrashIcon className="h-4 w-4" /> Limpar
                </button>
                <div className="w-px h-8 bg-gray-100 mx-1"></div>
                <button onClick={() => setIsAdmin(false)} className="text-gray-400 hover:text-indigo-600 transition-colors"><UserCircleIcon className="h-10 w-10" /></button>
              </div>
            ) : (
              <button onClick={() => setShowLogin(true)} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm">
                <LockClosedIcon className="h-4 w-4 text-gray-400" /> Admin
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {tasks.length > 0 ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[{l: 'Geral', v: stats.total, c: 'gray'}, {l: 'Pendentes', v: stats.pending, c: 'blue'}, {l: 'Concluídas', v: stats.completed, c: 'green'}, {l: 'Atrasadas', v: stats.rescheduled, c: 'orange'}].map(s => (
                <div key={s.l} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">{s.l}</div>
                    <div className="text-3xl font-black text-gray-900 tracking-tighter">{s.v}</div>
                  </div>
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${s.c === 'blue' ? 'bg-blue-50 text-blue-500' : s.c === 'green' ? 'bg-green-50 text-green-500' : s.c === 'orange' ? 'bg-orange-50 text-orange-500' : 'bg-gray-50 text-gray-500'}`}>
                    <ChartBarIcon className="h-6 w-6" />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-8 flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-6">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Distribuição de Status</h3>
                  <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-tighter">{stats.completionRate}% Concluído</div>
                </div>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} dataKey="value" isAnimationActive={false}>
                        {chartData.map((e, i) => <Cell key={i} fill={e.color} strokeWidth={0} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-6 mt-4">
                  {chartData.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{background: d.color}}></div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-8">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8">Performance Individual (%)</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performerChartData} layout="vertical" stackOffset="expand" isAnimationActive={false}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 10, fontWeight: 800}} width={100} />
                      <Tooltip />
                      <Bar dataKey="Concluídas" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Pendentes" stackId="a" fill="#3B82F6" />
                      <Bar dataKey="Reprogramadas" stackId="a" fill="#F59E0B" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="space-y-6 pt-4">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:max-w-md">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-300 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input type="text" placeholder="Pesquisar atividades..." className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-[1.2rem] text-sm focus:ring-4 focus:ring-indigo-50/50 outline-none transition-all shadow-sm" value={filter} onChange={e => setFilter(e.target.value)} />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <FunnelIcon className="h-4 w-4 text-gray-400" />
                  <select className="flex-1 sm:w-48 bg-white border border-gray-200 rounded-[1.2rem] px-5 py-3.5 text-sm font-bold text-gray-700 outline-none shadow-sm cursor-pointer" value={selectedPerformer} onChange={e => setSelectedPerformer(e.target.value)}>
                    {performersList.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/30 text-gray-400 text-[10px] uppercase font-black tracking-[0.15em] border-b border-gray-100">
                        <th className="px-8 py-6">Status</th>
                        <th className="px-8 py-6">Atividade</th>
                        <th className="px-8 py-6">Nº Ordem</th>
                        <th className="px-8 py-6">Data</th>
                        <th className="px-8 py-6">Executante</th>
                        <th className="px-8 py-6 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredTasks.map(task => (
                        <tr key={task.id} className="group hover:bg-gray-50/30 transition-all duration-200">
                          <td className="px-8 py-5">
                            <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-tighter border ${task.status === TaskStatus.COMPLETED ? 'bg-green-50 text-green-600 border-green-100' : task.status === TaskStatus.RESCHEDULED ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{task.status}</span>
                          </td>
                          <td className="px-8 py-5">
                            <div className="text-sm font-bold text-gray-800 leading-tight group-hover:text-indigo-600 transition-colors">{task.activity}</div>
                            {task.observations && <div className="text-[10px] text-gray-400 italic mt-1.5 font-medium bg-gray-50 px-2 py-1 rounded-lg inline-block">Obs: {task.observations}</div>}
                          </td>
                          <td className="px-8 py-5 text-gray-400 text-sm font-mono tracking-tighter">#{task.orderNumber}</td>
                          <td className="px-8 py-5 text-gray-500 text-sm">{task.date}</td>
                          <td className="px-8 py-5 text-gray-600 text-sm font-black uppercase tracking-tight">{task.performer}</td>
                          <td className="px-8 py-5 text-right">
                            {task.status === TaskStatus.PENDING ? (
                              <div className="flex justify-end gap-3">
                                <button onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.COMPLETED })} className="px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter shadow-md shadow-green-100 hover:bg-green-700 active:scale-95 transition-all">Concluir</button>
                                <button onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.RESCHEDULED })} className="px-4 py-2 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter shadow-md shadow-orange-100 hover:bg-orange-600 active:scale-95 transition-all">Reprogramar</button>
                              </div>
                            ) : (
                              <button onClick={() => resetTask(task.id)} className="px-6 py-2 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-indigo-100 shadow-sm hover:border-indigo-600 hover:bg-indigo-600 hover:text-white active:scale-95 transition-all flex items-center gap-2 ml-auto">
                                <ArrowPathIcon className="h-3 w-3" /> Refazer
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
          <div className="flex flex-col items-center justify-center py-40 bg-white rounded-[4rem] border-2 border-dashed border-gray-100 shadow-inner">
            <div className="bg-indigo-50 p-10 rounded-[2.5rem] mb-10 shadow-xl shadow-indigo-100/50">
              <ClipboardDocumentListIcon className="h-24 w-24 text-indigo-200" />
            </div>
            <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter">Sistema Vazio</h2>
            <p className="text-gray-400 mb-12 text-center max-w-sm font-bold uppercase text-xs tracking-widest leading-relaxed">
              {isAdmin ? 'Acesse o modo administrador e importe sua planilha CSV diária para iniciar.' : 'Aguarde o compartilhamento do link com a planilha atualizada.'}
            </p>
            {isAdmin ? (
              <label className="bg-indigo-600 text-white px-16 py-6 rounded-[2rem] font-black text-xl cursor-pointer shadow-2xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-4">
                <PlusIcon className="h-8 w-8" /> Importar Atividades
                <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
              </label>
            ) : (
              <button onClick={() => setShowLogin(true)} className="bg-white border-2 border-gray-100 px-14 py-5 rounded-[2rem] font-black text-gray-700 shadow-2xl active:scale-95 transition-all flex items-center gap-3">
                <LockClosedIcon className="h-6 w-6 text-gray-300" /> Área do Gestor
              </button>
            )}
          </div>
        )}
      </main>

      {showLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
            <h3 className="text-3xl font-black text-gray-900 mb-3 tracking-tighter">Login Admin</h3>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-10">Controle Total</p>
            <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-4 bg-white border-2 border-gray-100 py-5 rounded-[1.5rem] font-black text-gray-700 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all shadow-xl active:scale-95">
              <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="h-7 w-7" alt="G" /> Google Workspace
            </button>
            <button onClick={() => setShowLogin(false)} className="mt-8 text-[10px] text-gray-300 font-black uppercase tracking-widest hover:text-red-500 transition-colors">Voltar</button>
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
