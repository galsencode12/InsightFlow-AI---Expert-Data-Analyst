
import React, { useState, useRef, useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, ScatterChart, Scatter
} from 'recharts';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import * as pdfjs from 'pdfjs-dist';
import { 
  LayoutDashboard, 
  FileText, 
  Database, 
  MessageSquare, 
  Upload, 
  ChevronRight, 
  TrendingUp, 
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  Download,
  BrainCircuit,
  PieChart as PieChartIcon,
  Search,
  BarChart3
} from 'lucide-react';

// Configuration du worker pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

import { FileType, DataPayload, AnalysisResult, ChatMessage, ChartConfig } from './types';
import { analyzeData, chatWithData } from './services/geminiService';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e'];

export default function App() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'preview'>('dashboard');
  const [dataPayload, setDataPayload] = useState<DataPayload | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map((item: any) => item.str).join(" ") + "\n";
    }
    return fullText;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    try {
      let payload: DataPayload;

      if (extension === 'csv') {
        const text = await file.text();
        const results = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true });
        payload = {
          name: file.name,
          type: 'csv',
          content: results.data,
          headers: results.meta.fields,
          rowCount: results.data.length
        };
      } else if (extension === 'xlsx' || extension === 'xls') {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        payload = {
          name: file.name,
          type: 'excel',
          content: jsonData,
          headers: jsonData.length > 0 ? Object.keys(jsonData[0] as any) : [],
          rowCount: jsonData.length
        };
      } else if (extension === 'pdf') {
        const text = await extractTextFromPdf(file);
        if (!text.trim()) throw new Error("Impossible d'extraire du texte de ce PDF.");
        payload = {
          name: file.name,
          type: 'pdf',
          content: text,
          rowCount: 1
        };
      } else {
        throw new Error("Format de fichier non supporté. Veuillez utiliser CSV, Excel ou PDF.");
      }

      const analysisResult = await analyzeData(payload);
      setDataPayload(payload);
      setAnalysis(analysisResult);
      setActiveTab('dashboard');
      setChatHistory([]);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors du traitement.");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQuery.trim() || !dataPayload) return;

    const userMsg: ChatMessage = { role: 'user', content: currentQuery, timestamp: Date.now() };
    setChatHistory(prev => [...prev, userMsg]);
    setCurrentQuery('');
    
    setIsProcessing(true);
    try {
      const responseText = await chatWithData(dataPayload, chatHistory, currentQuery);
      const aiMsg: ChatMessage = { role: 'assistant', content: responseText, timestamp: Date.now() };
      setChatHistory(prev => [...prev, aiMsg]);
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      setError("Échec de la réponse de l'IA.");
    } finally {
      setIsProcessing(false);
    }
  };

  const prepareChartData = (config: ChartConfig) => {
    if (!dataPayload || dataPayload.type === 'pdf') return [];
    
    const rawContent = dataPayload.content as any[];
    
    // Nettoyage et conversion des données
    return rawContent
      .map(row => {
        const yValue = parseFloat(String(row[config.yAxis]).replace(/[^0-9.-]+/g, ""));
        return {
          ...row,
          [config.xAxis]: row[config.xAxis] || 'N/A',
          [config.yAxis]: isNaN(yValue) ? 0 : yValue
        };
      })
      .filter(row => row[config.yAxis] !== 0) // On évite les valeurs vides pour plus de clarté
      .slice(0, 15); // On limite à 15 points pour la lisibilité
  };

  const renderChart = (chart: ChartConfig, index: number) => {
    const chartData = prepareChartData(chart);
    
    if (chartData.length === 0) {
      return (
        <div key={index} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center h-[400px]">
          <BarChart3 className="text-slate-200 mb-4" size={48} />
          <p className="text-slate-400 text-sm font-medium text-center">Données insuffisantes pour :<br/>{chart.title}</p>
        </div>
      );
    }

    return (
      <div key={index} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[400px] hover:shadow-md transition-shadow">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-800 line-clamp-1">{chart.title}</h3>
          <p className="text-xs text-slate-400 line-clamp-2 mt-1">{chart.description}</p>
        </div>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            {chart.type === 'bar' ? (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey={chart.xAxis} 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
                <Bar dataKey={chart.yAxis} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : chart.type === 'line' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey={chart.xAxis} 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                <Line type="monotone" dataKey={chart.yAxis} stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
              </LineChart>
            ) : chart.type === 'pie' ? (
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey={chart.yAxis}
                  nameKey={chart.xAxis}
                >
                  {chartData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
              </PieChart>
            ) : (
              <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey={chart.xAxis} name={chart.xAxis} stroke="#94a3b8" fontSize={10} />
                <YAxis dataKey={chart.yAxis} name={chart.yAxis} stroke="#94a3b8" fontSize={10} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Points" data={chartData} fill="#3b82f6" />
              </ScatterChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full md:w-72 bg-slate-900 text-white flex flex-col shrink-0 p-6 z-10 border-r border-slate-800">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <BrainCircuit className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">InsightFlow <span className="text-blue-400">AI</span></h1>
        </div>

        <nav className="space-y-2 flex-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Tableau de bord</span>
          </button>
          <button 
            onClick={() => setActiveTab('chat')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'chat' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <MessageSquare size={20} />
            <span className="font-medium">Chat Analyste</span>
          </button>
          <button 
            onClick={() => setActiveTab('preview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'preview' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Database size={20} />
            <span className="font-medium">Exploration brute</span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800">
          <div className="p-4 bg-slate-800/50 rounded-2xl">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3">Statut du Modèle</h4>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-75" />
              </div>
              <span className="text-sm text-slate-300 font-semibold">Gemini 3 Pro Actif</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-50 relative">
        <header className="sticky top-0 bg-white/80 backdrop-blur-md px-8 py-6 flex items-center justify-between border-b border-slate-200 z-20">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {activeTab === 'dashboard' ? 'Intelligence des Données' : activeTab === 'chat' ? 'Analyste Virtuel' : 'Exploration de Données'}
            </h2>
            <p className="text-slate-500 text-sm font-medium">
              {dataPayload ? `Analyse : ${dataPayload.name}` : 'Importez un fichier pour démarrer votre analyse'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold cursor-pointer hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95">
              <Upload size={18} />
              <span>Importer</span>
              <input type="file" className="hidden" accept=".csv, .xlsx, .xls, .pdf" onChange={handleFileUpload} />
            </label>
          </div>
        </header>

        <div className="p-8">
          {error && (
            <div className="mb-8 p-5 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 text-red-700 shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="p-2 bg-red-100 rounded-lg"><AlertCircle size={20} /></div>
              <p className="font-semibold">{error}</p>
            </div>
          )}

          {!dataPayload && !isProcessing && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-2xl mx-auto space-y-8">
              <div className="relative">
                <div className="w-32 h-32 bg-blue-50 text-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-blue-600/5">
                  <FileSpreadsheet size={56} />
                </div>
                <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center text-emerald-500">
                  <BrainCircuit size={24} />
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight">Propulsez vos données</h3>
                <p className="text-slate-500 text-lg leading-relaxed max-w-lg mx-auto">
                  Accédez à une science des données professionnelle. PDF, CSV, Excel : laissez Gemini transformer vos fichiers en décisions stratégiques.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-8">
                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <TrendingUp size={28} />
                  </div>
                  <h4 className="font-bold text-slate-800 mb-2">Analyses IA</h4>
                  <p className="text-sm text-slate-500 font-medium">Détection automatique des tendances.</p>
                </div>
                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <PieChartIcon size={28} />
                  </div>
                  <h4 className="font-bold text-slate-800 mb-2">Graphiques Pro</h4>
                  <p className="text-sm text-slate-500 font-medium">Visualisations intelligentes interactives.</p>
                </div>
                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                  <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <Search size={28} />
                  </div>
                  <h4 className="font-bold text-slate-800 mb-2">Extraction PDF</h4>
                  <p className="text-sm text-slate-500 font-medium">Analyse textuelle avancée des documents.</p>
                </div>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
              <div className="relative">
                <div className="w-24 h-24 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <BrainCircuit size={36} className="text-blue-600 animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Analyse en cours...</h3>
                <p className="text-slate-500 font-medium animate-pulse">Consultation de l'intelligence Gemini pour vos données</p>
              </div>
            </div>
          )}

          {dataPayload && analysis && !isProcessing && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
              {activeTab === 'dashboard' && (
                <div className="space-y-8 pb-12">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-7 rounded-[2rem] shadow-sm border border-slate-100 group hover:shadow-lg transition-all">
                      <div className="flex items-center justify-between mb-5">
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Observations</span>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all"><Database size={20} /></div>
                      </div>
                      <div className="text-4xl font-black text-slate-900">{dataPayload.rowCount?.toLocaleString()}</div>
                      <div className="text-xs font-semibold text-slate-400 mt-2">Lignes analysées</div>
                    </div>
                    <div className="bg-white p-7 rounded-[2rem] shadow-sm border border-slate-100 group hover:shadow-lg transition-all">
                      <div className="flex items-center justify-between mb-5">
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Dimensions</span>
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all"><TrendingUp size={20} /></div>
                      </div>
                      <div className="text-4xl font-black text-slate-900">{dataPayload.headers?.length || (dataPayload.type === 'pdf' ? 1 : 0)}</div>
                      <div className="text-xs font-semibold text-slate-400 mt-2">Variables détectées</div>
                    </div>
                    <div className="bg-white p-7 rounded-[2rem] shadow-sm border border-slate-100 group hover:shadow-lg transition-all">
                      <div className="flex items-center justify-between mb-5">
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Format</span>
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition-all"><FileText size={20} /></div>
                      </div>
                      <div className="text-4xl font-black uppercase text-slate-900">{dataPayload.type}</div>
                      <div className="text-xs font-semibold text-slate-400 mt-2">Source du fichier</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
                      <h3 className="text-2xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                        <BrainCircuit className="text-blue-600" size={28} />
                        Synthèse IA
                      </h3>
                      <div className="prose prose-slate max-w-none text-slate-600 text-lg leading-relaxed">
                        {analysis.overview}
                      </div>
                      {analysis.predictions && (
                        <div className="mt-10 p-8 bg-blue-50/50 rounded-3xl border border-blue-100 relative overflow-hidden group">
                          <h4 className="font-bold text-blue-900 text-xl mb-4 flex items-center gap-2">
                            <TrendingUp size={22} />
                            Perspectives
                          </h4>
                          <p className="text-blue-800/80 leading-relaxed font-medium">
                            {analysis.predictions}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
                      <h3 className="text-2xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                        <MessageSquare className="text-emerald-600" size={28} />
                        Points Stratégiques
                      </h3>
                      <div className="space-y-6">
                        {analysis.keyInsights.map((insight, i) => (
                          <div key={i} className="flex gap-6 p-6 rounded-3xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-500 shrink-0 shadow-sm">
                              {i + 1}
                            </div>
                            <p className="text-slate-600 font-medium leading-relaxed pt-1">
                              {insight}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {dataPayload.type !== 'pdf' && analysis.suggestedCharts.length > 0 && (
                    <div className="pt-8">
                      <h3 className="text-2xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                        <PieChartIcon className="text-blue-600" size={28} />
                        Visualisations Automatisées
                      </h3>
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                        {analysis.suggestedCharts.map((chart, i) => renderChart(chart, i))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'chat' && (
                <div className="flex flex-col h-[75vh] bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                  <div className="p-8 border-b border-slate-100 flex items-center gap-4 bg-white z-10">
                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                      <BrainCircuit size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Expert en Science des Données</h3>
                      <p className="text-sm font-semibold text-slate-400">Interrogez vos données en français</p>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/30">
                    {chatHistory.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-center py-20 space-y-6">
                        <div className="p-6 bg-white shadow-xl shadow-indigo-600/5 text-indigo-500 rounded-3xl animate-bounce">
                          <MessageSquare size={48} />
                        </div>
                        <h4 className="text-2xl font-bold text-slate-900">Posez une question</h4>
                      </div>
                    )}
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                        <div className={`max-w-[80%] p-6 rounded-[2rem] shadow-sm ${
                          msg.role === 'user' 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 rounded-tr-none' 
                          : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                        }`}>
                          <p className="text-base font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  <form onSubmit={handleChatSubmit} className="p-8 bg-white border-t border-slate-100">
                    <div className="relative flex items-center">
                      <input 
                        type="text"
                        value={currentQuery}
                        onChange={(e) => setCurrentQuery(e.target.value)}
                        placeholder="Quelle est votre question sur les données ?"
                        className="w-full pl-8 pr-16 py-5 bg-slate-100 rounded-3xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-slate-700 font-bold border-2 border-transparent focus:border-blue-500/20"
                      />
                      <button 
                        type="submit"
                        disabled={isProcessing || !currentQuery.trim()}
                        className="absolute right-3 p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 disabled:bg-slate-300 transition-all shadow-lg active:scale-90"
                      >
                        {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <ChevronRight size={24} />}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'preview' && (
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95">
                  <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Exploration Brute</h3>
                      <p className="text-sm font-semibold text-slate-400">Affichage partiel des données</p>
                    </div>
                    <button 
                      onClick={() => {
                        const csv = Papa.unparse(dataPayload.content as any[]);
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement("a");
                        link.href = URL.createObjectURL(blob);
                        link.download = `export_${dataPayload.name}.csv`;
                        link.click();
                      }}
                      className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all active:scale-95"
                    >
                      <Download size={18} />
                      Exporter CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    {dataPayload.type === 'pdf' ? (
                      <div className="p-10 font-mono text-sm text-slate-600 leading-[2] bg-slate-50/50">
                        {dataPayload.content}
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-100">
                            {dataPayload.headers?.map((h) => (
                              <th key={h} className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {(dataPayload.content as any[]).slice(0, 50).map((row, i) => (
                            <tr key={i} className="hover:bg-blue-50/50 transition-all">
                              {dataPayload.headers?.map((h) => (
                                <td key={`${i}-${h}`} className="px-8 py-5 text-sm font-bold text-slate-600 truncate max-w-[250px]">
                                  {row[h] === null || row[h] === undefined ? '-' : String(row[h])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
