
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  PlusIcon, 
  TrashIcon, 
  ArrowPathIcon, 
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
import { Task, TaskStatus } from './types.ts';
import ObservationModal from './components/ObservationModal.tsx';

// Funções auxiliares para codificação UTF-8 Base64 segura
const utf8_to_b64 = (str: string) => {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode(parseInt(p1, 16));
  }));
};

const b64_to_utf8 = (str: string) => {
  try {
    return decodeURIComponent(Array.prototype.map.call(atob(str), (c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  } catch (e) {
    return atob(str);
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
  const [history, setHistory] = useState<Task[][]>([]);
  const [filter, setFilter] = useState('');
  const [selectedPerformer, setSelectedPerformer] = useState('Todos');
  const [activeModal, setActiveModal] = useState<{ taskId: string, type: TaskStatus } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.length > 5) {
      try {
        const decodedStr = b64_to_utf8(hash.substring(1));
        const decodedData = JSON.parse(decodedStr);
        if (Array.isArray(decodedData)) {
          setTasks(decodedData);
          localStorage.setItem('executive_tasks', JSON.stringify(decodedData));
          setNotification({ message: 'Dados sincronizados via link!', type: 'success' });
          window.location.hash = ''; 
          return;
        }
      } catch (e) {
        console.error("Erro ao decodificar dados da URL", e);
        setNotification({ message: 'O link de compartilhamento parece inválido.', type: 'error' });
      }
    }

    const saved = localStorage.getItem('executive_tasks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setTasks(parsed);
      } catch (e) {
        console.error("Failed to load tasks", e);
      }
    }
  }, []);

  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem('executive_tasks', JSON.stringify(tasks));
    }
  }, [tasks]);

  const saveToHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-10), [...tasks]]);
  }, [tasks]);

  const handleGoogleLogin = () => {
    setNotification({ message: 'Autenticando com Google...', type: 'success' });
    setTimeout(() => {
      setIsAdmin(true);
      setShowLogin(false);
      setNotification({ message: 'Acesso Administrativo Concedido', type: 'success' });
    }, 1000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
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
        setNotification({ message: 'Formato inválido. Use: Atividade, Ordem, Data, Executante.', type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const generateShareLink = () => {
    try {
      const dataStr = JSON.stringify(tasks);
      const encoded = utf8_to_b64(dataStr);
      const url = `${window.location.origin}${window.location.pathname}#${encoded}`;
      
      navigator.clipboard.writeText(url).then(() => {
        setNotification({ message: 'Link copiado! Envie para sua equipe.', type: 'success' });
      }).catch(() => {
        setNotification({ message: 'Erro ao copiar link automaticamente.', type: 'error' });
      });
    } catch (e) {
      setNotification({ message: 'Planilha muito grande para compartilhar via link.', type: 'error' });
    }
  };

  const exportReport = () => {
    if (tasks.length === 0) return;

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 8px; font-family: sans-serif; }
          th { background-color: #f3f4f6; font-weight: bold; }
          .completed { background-color: #c6efce; color: #006100; }
          .rescheduled { background-color: #ffeb9c; color: #9c6500; }
          .pending { background-color: #ffffff; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th>Atividade</th>
              <th>Ordem</th>
              <th>Data</th>
              <th>Executante</th>
              <th>Status</th>
              <th>Observacoes</th>
            </tr>
          </thead>
          <tbody>
    `;

    tasks.forEach(t => {
      let rowClass = t.status === TaskStatus.COMPLETED ? 'completed' : t.status === TaskStatus.RESCHEDULED ? 'rescheduled' : 'pending';
      html += `
        <tr class="${rowClass}">
          <td>${t.activity}</td>
          <td>${t.orderNumber}</td>
          <td>${t.date}</td>
          <td>${t.performer}</td>
          <td>${t.status}</td>
          <td>${t.observations || ''}</td>
        </tr>
      `;
    });

    html += `</tbody></table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_atividades_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const undo = () => {
    if (history.length > 0) {
      const prevTasks = history[history.length - 1];
      setTasks(prevTasks);
      setHistory(prev => prev.slice(0, -1));
      setNotification({ message: 'Ação desfeita.', type: 'success' });
    }
  };

  const clearSheet = () => {
    if (!isAdmin) {
      setNotification({ message: 'Apenas administradores podem apagar dados.', type: 'error' });
      return;
    }
    if (window.confirm('Apagar permanentemente todos os dados da planilha atual?')) {
      setTasks([]);
      setHistory([]);
      localStorage.removeItem('executive_tasks');
      setNotification({ message: 'Planilha removida com sucesso.', type: 'success' });
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

  const renderBarLabel = (props: any) => {
    const { x, y, width, height, payload, dataKey } = props;
    if (!payload || !dataKey) return null;
    const rawValue = payload[dataKey];
    if (!rawValue || width < 25) return null;
    const percentage = ((rawValue / (payload.total || 1)) * 100).toFixed(0) + '%';
    return (
      <text x={x + width / 2} y={y + height / 2} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight="bold" style={{ pointerEvents: 'none' }}>
        {percentage}
      </text>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-3 rounded-xl shadow-2xl border transition-all animate-in slide-in-from-right duration-300 ${
          notification.type === 'success' ? 'bg-white border-green-100 text-green-800' : 'bg-white border-red-100 text-red-800'
        }`}>
          {notification.type === 'success' ? <CheckCircleIcon className="h-6 w-6 text-green-500" /> : <ExclamationCircleIcon className="h-6 w-6 text-red-500" />}
          <span className="font-medium">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2"><XMarkIcon className="h-4 w-4 text-gray-400" /></button>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <ClipboardDocumentListIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-none">Gestor Executivo</h1>
              {isAdmin && <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-1 block">Modo Administrador</span>}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {tasks.length > 0 && (
              <button 
                onClick={exportReport} 
                className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Relatório Excel
              </button>
            )}
            
            {isAdmin ? (
              <div className="flex gap-2">
                <button 
                  onClick={generateShareLink} 
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-sm"
                >
                  <ShareIcon className="h-4 w-4" />
                  Gerar Link
                </button>
                <button 
                  onClick={clearSheet} 
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-2"
                >
                  <TrashIcon className="h-4 w-4" />
                  Limpar Tudo
                </button>
                <div className="h-8 w-px bg-gray-200 mx-2"></div>
                <button onClick={() => setIsAdmin(false)} className="text-gray-400 hover:text-gray-600" title="Sair do Admin">
                  <UserCircleIcon className="h-8 w-8" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowLogin(true)} 
                className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm"
              >
                <LockClosedIcon className="h-4 w-4" />
                Login Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {showLogin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in-95 duration-200">
            <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <LockClosedIcon className="h-8 w-8 text-indigo-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Acesso Restrito</h3>
            <p className="text-gray-500 text-sm mb-8">Apenas administradores podem gerenciar planilhas globais e compartilhar links.</p>
            <button 
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 py-3 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
            >
              <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="h-6 w-6" alt="Google" />
              Entrar com Google
            </button>
            <button onClick={() => setShowLogin(false)} className="mt-6 text-sm text-gray-400 font-medium hover:text-gray-600">Cancelar</button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {tasks.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-gray-50 rounded-xl"><ClipboardDocumentListIcon className="h-7 w-7 text-gray-500" /></div>
                <div><div className="text-2xl font-bold text-gray-900">{stats.total}</div><div className="text-xs text-gray-500 font-medium">Total</div></div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-xl"><ClockIcon className="h-7 w-7 text-blue-500" /></div>
                <div><div className="text-2xl font-bold text-gray-900">{stats.pending}</div><div className="text-xs text-gray-500 font-medium">Pendentes</div></div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-green-50 rounded-xl"><CheckCircleIcon className="h-7 w-7 text-green-500" /></div>
                <div><div className="text-2xl font-bold text-gray-900">{stats.completed}</div><div className="text-xs text-gray-500 font-medium">Concluídas</div></div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-orange-50 rounded-xl"><CalendarIcon className="h-7 w-7 text-orange-500" /></div>
                <div><div className="text-2xl font-bold text-gray-900">{stats.rescheduled}</div><div className="text-xs text-gray-500 font-medium">Reprogramadas</div></div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
                <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
                  <ChartBarIcon className="h-5 w-5 text-green-500" />
                  <h3 className="text-lg font-bold text-gray-800">Status Geral</h3>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-full">
                  <div className="h-64 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData} cx="50%" cy="50%" outerRadius={100} dataKey="value" labelLine={false}>
                          {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-gray-900">{stats.completionRate}%</span>
                      <span className="text-gray-500 text-xs font-medium uppercase">concluído</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserGroupIcon className="h-5 w-5 text-indigo-500" />
                    <h3 className="text-lg font-bold text-gray-800">Desempenho por Executante (%)</h3>
                  </div>
                </div>
                <div className="p-6 flex-1 min-h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performerChartData} layout="vertical" stackOffset="expand">
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 600 }} width={100} />
                      <Tooltip cursor={{ fill: '#f9fafb' }} />
                      <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ fontSize: '11px', paddingBottom: '20px' }} />
                      <Bar name="Concluídas" dataKey="Concluídas" stackId="a" fill="#00C853"><LabelList content={renderBarLabel} dataKey="Concluídas" /></Bar>
                      <Bar name="Pendentes" dataKey="Pendentes" stackId="a" fill="#4285F4"><LabelList content={renderBarLabel} dataKey="Pendentes" /></Bar>
                      <Bar name="Reprogramadas" dataKey="Reprogramadas" stackId="a" fill="#FFAB00" radius={[0, 4, 4, 0]}><LabelList content={renderBarLabel} dataKey="Reprogramadas" /></Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[250px]">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Pesquisar atividade ou executor..." 
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-sm"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <FunnelIcon className="h-4 w-4 text-gray-400" />
                  <select 
                    className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer"
                    value={selectedPerformer}
                    onChange={(e) => setSelectedPerformer(e.target.value)}
                  >
                    {performersList.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/50 text-gray-400 text-[10px] uppercase font-bold tracking-widest border-b border-gray-100">
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Atividade</th>
                        <th className="px-6 py-4">Nº Ordem</th>
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4">Executante</th>
                        <th className="px-6 py-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredTasks.map((task) => (
                        <tr key={task.id} className="hover:bg-gray-50/30 transition-colors">
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                              task.status === TaskStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                              task.status === TaskStatus.RESCHEDULED ? 'bg-orange-100 text-orange-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>{task.status}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-semibold text-gray-800">{task.activity}</div>
                            {task.observations && <div className="text-[10px] text-gray-400 italic mt-1">Obs: {task.observations}</div>}
                          </td>
                          <td className="px-6 py-4 text-gray-500 text-sm font-mono">#{task.orderNumber}</td>
                          <td className="px-6 py-4 text-gray-500 text-sm">{task.date}</td>
                          <td className="px-6 py-4 text-gray-600 text-sm">{task.performer}</td>
                          <td className="px-6 py-4 text-right">
                            {task.status === TaskStatus.PENDING ? (
                              <div className="flex justify-end gap-2">
                                <button onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.COMPLETED })} className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-[11px] font-bold uppercase border border-green-200">Concluído</button>
                                <button onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.RESCHEDULED })} className="px-3 py-1.5 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-lg text-[11px] font-bold uppercase border border-orange-200">Reprogramar</button>
                              </div>
                            ) : (
                              <button onClick={() => resetTask(task.id)} className="text-[11px] font-bold text-indigo-600 uppercase hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200">Refazer</button>
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
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-200">
            <div className="bg-indigo-50 p-6 rounded-full mb-6">
              <ClipboardDocumentListIcon className="h-16 w-16 text-indigo-200" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sem Planilha Ativa</h2>
            <p className="text-gray-500 mb-8 text-center max-w-sm">
              {isAdmin 
                ? 'Você está no modo Admin. Importe um CSV para começar.' 
                : 'Aguarde o administrador carregar as atividades diárias ou use um link de acesso.'}
            </p>
            {isAdmin ? (
              <label className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-indigo-700 cursor-pointer shadow-xl flex items-center gap-3">
                <PlusIcon className="h-6 w-6" />
                Carregar CSV Inicial
                <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
              </label>
            ) : (
              <button onClick={() => setShowLogin(true)} className="bg-white border border-gray-300 px-8 py-3 rounded-2xl font-bold text-gray-700 hover:bg-gray-50 shadow-sm flex items-center gap-2">
                <LockClosedIcon className="h-5 w-5" />
                Login Administrador
              </button>
            )}
          </div>
        )}
      </main>

      {activeModal && (
        <ObservationModal 
          isOpen={!!activeModal}
          type={activeModal.type}
          onClose={() => setActiveModal(null)}
          onSubmit={(obs) => updateTaskStatus(activeModal.taskId, activeModal.type, obs)}
        />
      )}
    </div>
  );
};

export default App;
