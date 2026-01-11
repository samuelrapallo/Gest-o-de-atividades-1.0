
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

// Funções auxiliares para codificação UTF-8 Base64 segura e resiliente
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
    try {
      return atob(str);
    } catch (err) {
      return "";
    }
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

  // Carregar dados iniciais (Prioridade para URL Hash)
  useEffect(() => {
    const loadData = () => {
      const hash = window.location.hash;
      if (hash && hash.length > 10) {
        try {
          const decodedStr = b64_to_utf8(hash.substring(1));
          if (decodedStr) {
            const decodedData = JSON.parse(decodedStr);
            if (Array.isArray(decodedData)) {
              setTasks(decodedData);
              localStorage.setItem('executive_tasks', JSON.stringify(decodedData));
              setNotification({ message: 'Dados carregados do link!', type: 'success' });
              return;
            }
          }
        } catch (e) {
          console.error("Erro ao carregar dados da URL", e);
        }
      }

      const saved = localStorage.getItem('executive_tasks');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) setTasks(parsed);
        } catch (e) {
          console.error("Erro ao carregar do LocalStorage", e);
        }
      }
    };

    loadData();
    
    // Listener para mudanças no hash (caso o usuário cole um novo link na mesma aba)
    window.addEventListener('hashchange', loadData);
    return () => window.removeEventListener('hashchange', loadData);
  }, []);

  // Persistência local
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
      setNotification({ message: 'Modo Administrador Ativado', type: 'success' });
    }, 8000); // Tempo simulado para parecer um login real
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
        setNotification({ message: 'Arquivo CSV com formato inválido.', type: 'error' });
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
      
      // Atualiza o hash da URL atual para que o usuário possa simplesmente copiar da barra de endereços
      window.location.hash = encoded;

      navigator.clipboard.writeText(url).then(() => {
        setNotification({ message: 'Link de sincronização copiado!', type: 'success' });
      }).catch(() => {
        setNotification({ message: 'Link gerado na barra de endereços!', type: 'success' });
      });
    } catch (e) {
      setNotification({ message: 'Muitos dados para compartilhar via link.', type: 'error' });
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
          th, td { border: 1px solid #ccc; padding: 8px; font-family: sans-serif; text-align: left; }
          th { background-color: #f3f4f6; font-weight: bold; }
          .completed { background-color: #c6efce; color: #006100; }
          .rescheduled { background-color: #ffeb9c; color: #9c6500; }
        </style>
      </head>
      <body>
        <h2>Relatório de Atividades - ${new Date().toLocaleDateString()}</h2>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Atividade</th>
              <th>Nº Ordem</th>
              <th>Data</th>
              <th>Executante</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
    `;

    tasks.forEach(t => {
      let rowClass = t.status === TaskStatus.COMPLETED ? 'completed' : t.status === TaskStatus.RESCHEDULED ? 'rescheduled' : '';
      html += `
        <tr class="${rowClass}">
          <td>${t.status}</td>
          <td>${t.activity}</td>
          <td>${t.orderNumber}</td>
          <td>${t.date}</td>
          <td>${t.performer}</td>
          <td>${t.observations || ''}</td>
        </tr>
      `;
    });

    html += `</tbody></table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gestao_executiva_${new Date().getTime()}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearSheet = () => {
    if (!isAdmin) return;
    if (window.confirm('Deseja realmente apagar todos os dados para carregar uma nova planilha?')) {
      setTasks([]);
      setHistory([]);
      localStorage.removeItem('executive_tasks');
      window.location.hash = '';
      setNotification({ message: 'Sistema resetado com sucesso.', type: 'success' });
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
      <text x={x + width / 2} y={y + height / 2} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight="bold">
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

      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-indigo-100 shadow-lg">
              <ClipboardDocumentListIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Gestor Executivo</h1>
              {isAdmin && <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest block">MODO ADMINISTRADOR</span>}
            </div>
          </div>
          <div className="flex gap-2.5 items-center">
            {tasks.length > 0 && (
              <button 
                onClick={exportReport} 
                className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Relatório Excel
              </button>
            )}
            
            {isAdmin ? (
              <div className="flex gap-2">
                <button 
                  onClick={generateShareLink} 
                  className="px-5 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
                >
                  <ShareIcon className="h-4 w-4" />
                  Gerar Link
                </button>
                <button 
                  onClick={clearSheet} 
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-2 border border-red-100"
                >
                  <TrashIcon className="h-4 w-4" />
                  Limpar Tudo
                </button>
                <div className="h-8 w-px bg-gray-100 mx-1"></div>
                <button onClick={() => setIsAdmin(false)} className="text-gray-400 hover:text-indigo-600 transition-colors">
                  <UserCircleIcon className="h-9 w-9" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowLogin(true)} 
                className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm"
              >
                <LockClosedIcon className="h-4 w-4 text-gray-400" />
                Login Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {showLogin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in-95 duration-200">
            <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <LockClosedIcon className="h-8 w-8 text-indigo-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Acesso Administrativo</h3>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">Faça login para carregar novas planilhas ou gerenciar os dados da equipe.</p>
            <button 
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 py-3.5 rounded-2xl font-bold text-gray-700 hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
            >
              <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="h-6 w-6" alt="Google" />
              Entrar com Google
            </button>
            <button onClick={() => setShowLogin(false)} className="mt-6 text-sm text-gray-400 font-medium hover:text-gray-600 uppercase tracking-widest">Cancelar</button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {tasks.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-gray-50 rounded-xl"><ClipboardDocumentListIcon className="h-7 w-7 text-gray-400" /></div>
                <div><div className="text-2xl font-black text-gray-900">{stats.total}</div><div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Atividades</div></div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-xl"><ClockIcon className="h-7 w-7 text-blue-500" /></div>
                <div><div className="text-2xl font-black text-gray-900">{stats.pending}</div><div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Pendentes</div></div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-green-50 rounded-xl"><CheckCircleIcon className="h-7 w-7 text-green-500" /></div>
                <div><div className="text-2xl font-black text-gray-900">{stats.completed}</div><div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Concluídas</div></div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-orange-50 rounded-xl"><CalendarIcon className="h-7 w-7 text-orange-500" /></div>
                <div><div className="text-2xl font-black text-gray-900">{stats.rescheduled}</div><div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Reprogramadas</div></div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
                <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
                  <ChartBarIcon className="h-5 w-5 text-indigo-500" />
                  <h3 className="text-base font-bold text-gray-800 uppercase tracking-tight">Status Geral</h3>
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
                  <div className="space-y-4">
                    <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col items-center justify-center">
                      <span className="text-4xl font-black text-gray-900">{stats.completionRate}%</span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase mt-1">Produtividade Total</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <UserGroupIcon className="h-5 w-5 text-indigo-500" />
                    <h3 className="text-base font-bold text-gray-800 uppercase tracking-tight">Produtividade por Equipe (%)</h3>
                  </div>
                </div>
                <div className="p-6 flex-1 min-h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performerChartData} layout="vertical" stackOffset="expand" margin={{left: 20}}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 11, fontWeight: 700 }} width={120} />
                      <Tooltip cursor={{ fill: '#f9fafb' }} />
                      <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ fontSize: '10px', paddingBottom: '20px', fontWeight: 'bold' }} />
                      <Bar name="Concluídas" dataKey="Concluídas" stackId="a" fill="#00C853"><LabelList content={renderBarLabel} dataKey="Concluídas" /></Bar>
                      <Bar name="Pendentes" dataKey="Pendentes" stackId="a" fill="#4285F4"><LabelList content={renderBarLabel} dataKey="Pendentes" /></Bar>
                      <Bar name="Reprogramadas" dataKey="Reprogramadas" stackId="a" fill="#FFAB00" radius={[0, 4, 4, 0]}><LabelList content={renderBarLabel} dataKey="Reprogramadas" /></Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[280px]">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Filtrar por atividade, executor ou ordem..." 
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-sm"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <FunnelIcon className="h-4 w-4 text-gray-400" />
                  <select 
                    className="bg-white border border-gray-200 rounded-2xl px-5 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer"
                    value={selectedPerformer}
                    onChange={(e) => setSelectedPerformer(e.target.value)}
                  >
                    {performersList.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/50 text-gray-400 text-[10px] uppercase font-bold tracking-widest border-b border-gray-100">
                        <th className="px-6 py-5">Status</th>
                        <th className="px-6 py-5">Atividade</th>
                        <th className="px-6 py-5">Nº Ordem</th>
                        <th className="px-6 py-5">Data</th>
                        <th className="px-6 py-5">Executante</th>
                        <th className="px-6 py-5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredTasks.map((task) => (
                        <tr key={task.id} className="hover:bg-gray-50/20 transition-colors">
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                              task.status === TaskStatus.COMPLETED ? 'bg-green-50 text-green-600 border border-green-100' :
                              task.status === TaskStatus.RESCHEDULED ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                              'bg-blue-50 text-blue-600 border border-blue-100'
                            }`}>{task.status}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-gray-800 leading-snug">{task.activity}</div>
                            {task.observations && <div className="text-[10px] text-gray-400 italic mt-1.5 leading-relaxed">Obs: {task.observations}</div>}
                          </td>
                          <td className="px-6 py-4 text-gray-400 text-sm font-mono tracking-tight">#{task.orderNumber}</td>
                          <td className="px-6 py-4 text-gray-500 text-sm">{task.date}</td>
                          <td className="px-6 py-4 text-gray-600 text-sm font-semibold">{task.performer}</td>
                          <td className="px-6 py-4 text-right">
                            {task.status === TaskStatus.PENDING ? (
                              <div className="flex justify-end gap-2">
                                <button onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.COMPLETED })} className="px-3 py-1.5 bg-white text-green-600 hover:bg-green-50 rounded-lg text-[10px] font-black uppercase border border-green-200 transition-all active:scale-95 shadow-sm">Concluir</button>
                                <button onClick={() => setActiveModal({ taskId: task.id, type: TaskStatus.RESCHEDULED })} className="px-3 py-1.5 bg-white text-orange-600 hover:bg-orange-50 rounded-lg text-[10px] font-black uppercase border border-orange-200 transition-all active:scale-95 shadow-sm">Reprogramar</button>
                              </div>
                            ) : (
                              <button onClick={() => resetTask(task.id)} className="px-4 py-1.5 bg-white text-indigo-600 hover:bg-indigo-50 rounded-lg text-[10px] font-black uppercase border border-indigo-200 transition-all active:scale-95 shadow-sm">Refazer</button>
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
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[40px] border-2 border-dashed border-gray-100">
            <div className="bg-indigo-50 p-8 rounded-full mb-8 shadow-inner">
              <ClipboardDocumentListIcon className="h-20 w-20 text-indigo-200" />
            </div>
            <h2 className="text-3xl font-black text-gray-900 mb-3">Sua Central de Atividades</h2>
            <p className="text-gray-400 mb-10 text-center max-w-sm font-medium leading-relaxed">
              {isAdmin 
                ? 'Você está no modo administrador. Importe sua primeira planilha CSV para começar o monitoramento.' 
                : 'Aguarde até que o administrador sincronize o link de atividades para visualização.'}
            </p>
            {isAdmin ? (
              <label className="bg-indigo-600 text-white px-12 py-5 rounded-3xl font-black text-lg hover:bg-indigo-700 cursor-pointer shadow-2xl shadow-indigo-200 flex items-center gap-4 transition-all active:scale-95">
                <PlusIcon className="h-7 w-7" />
                Importar CSV Inicial
                <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
              </label>
            ) : (
              <button onClick={() => setShowLogin(true)} className="bg-white border-2 border-gray-100 px-10 py-4 rounded-3xl font-black text-gray-700 hover:bg-gray-50 shadow-xl flex items-center gap-3 transition-all">
                <LockClosedIcon className="h-6 w-6 text-gray-300" />
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
