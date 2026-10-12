/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  TrendingUp, 
  AlertTriangle, 
  Package, 
  Activity, 
  CheckCircle2, 
  Sparkles, 
  RefreshCw, 
  Clipboard, 
  BrainCircuit, 
  Clock 
} from 'lucide-react';
import { Product, Movement, SystemLog, InventoryItem, User } from '../types';
import { playBeep } from '../utils/audio';

interface DashboardTabProps {
  products: Product[];
  movements: Movement[];
  inventory: InventoryItem[];
  logs: SystemLog[];
  user: User;
  getApiUrl?: (path: string) => string;
}

export default function DashboardTab({ products, movements, inventory, logs, user, getApiUrl }: DashboardTabProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiErrors, setAiErrors] = useState<any[] | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');

  // Calculations
  const totalProductsCount = products.length;
  const lowStockProducts = products.filter((p) => p.stock <= p.minStock);
  const totalMovementsCount = movements.length;
  const pendingSyncMovements = movements.filter((m) => !m.synced).length;
  const pendingSyncInventory = inventory.filter((i) => !i.synced).length;

  // Saídas Diárias Focus
  const saidasMovements = movements.filter((m) => m.type === 'Saída');
  const totalSaidasQty = saidasMovements.reduce((acc, m) => acc + m.quantity, 0);

  // Top products (most moved in last movements)
  const getTopProducts = () => {
    const counts: Record<string, number> = {};
    movements.forEach((m) => {
      counts[m.barcode] = (counts[m.barcode] || 0) + m.quantity;
    });
    return Object.entries(counts)
      .map(([barcode, qty]) => {
        const prod = products.find((p) => p.barcode === barcode);
        return {
          barcode,
          description: prod ? prod.description : `Cód: ${barcode}`,
          quantity: qty,
          category: prod ? prod.category : 'Desconhecido'
        };
      })
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 3);
  };

  const topProducts = getTopProducts();

  // Gemini API Trigger: Smart Report
  const triggerSmartReport = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiReport(null);
    setAiErrors(null);
    setLoadingMsg('Iniciando o cérebro da IA Caninana...');

    const messages = [
      'Vasculhando histórico de movimentações...',
      'Analisando níveis de estoque crítico...',
      'Cruzando padrões de transferência física...',
      'Sintetizando recomendações comerciais de compra...',
      'Finalizando relatório de auto vidros...'
    ];

    let msgIndex = 0;
    const interval = setInterval(() => {
      if (msgIndex < messages.length) {
        setLoadingMsg(messages[msgIndex]);
        msgIndex++;
      }
    }, 1500);

    try {
      const response = await fetch(getApiUrl ? getApiUrl('/api/gemini/smart-report') : '/api/gemini/smart-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products, movements, logs }),
      });

      const data = await response.json();
      if (response.ok) {
        setAiReport(data.report);
        playBeep('success');
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (err: any) {
      console.error(err);
      setAiReport(`### ⚠️ Não foi possível gerar o relatório inteligente\n\nErro do servidor: ${err.message || 'Chave de API inválida ou problemas de conexão'}. Certifique-se de que a GEMINI_API_KEY esteja configurada corretamente em Configurações > Secrets.`);
      playBeep('error');
    } finally {
      clearInterval(interval);
      setAiLoading(false);
    }
  };

  // Gemini API Trigger: Anomaly detection
  const triggerErrorDetection = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiReport(null);
    setAiErrors(null);
    setLoadingMsg('IA rastreando possíveis divergências de digitação...');

    const messages = [
      'Analisando comprimentos e padrões de códigos de barras...',
      'Filtrando volumes de transações suspeitas...',
      'Testando consistências lógicas de estoque negativo...',
      'Estruturando alertas operacionais de segurança...'
    ];

    let msgIndex = 0;
    const interval = setInterval(() => {
      if (msgIndex < messages.length) {
        setLoadingMsg(messages[msgIndex]);
        msgIndex++;
      }
    }, 1200);

    try {
      const response = await fetch(getApiUrl ? getApiUrl('/api/gemini/detect-errors') : '/api/gemini/detect-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          movements, 
          inventory, 
          currentProducts: products 
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setAiErrors(data.alerts || []);
        playBeep('success');
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (err: any) {
      console.error(err);
      setAiErrors([{
        title: 'Falha na Conexão de IA',
        severity: 'high',
        description: `Erro ao chamar IA: ${err.message}. Verifique a GEMINI_API_KEY no painel do AI Studio.`,
        action: 'Configure sua chave secreta ou tente novamente mais tarde.'
      }]);
      playBeep('error');
    } finally {
      clearInterval(interval);
      setAiLoading(false);
    }
  };

  return (
    <div id="dashboard-tab" className="p-4 max-w-lg mx-auto pb-24 space-y-5">
      {/* Dynamic Top Stat Alert */}
      {(pendingSyncMovements > 0 || pendingSyncInventory > 0) && (
        <div id="pending-sync-alert" className="bg-[#2497DE]/5 border border-[#2497DE]/25 p-3.5 rounded-2xl flex items-center justify-between text-xs text-slate-600 shadow-sm">
          <div className="flex items-center gap-2">
            <Activity className="text-[#2497DE] animate-pulse" size={16} />
            <span>Existem <strong>{pendingSyncMovements + pendingSyncInventory}</strong> coletas offline pendentes de sincronização.</span>
          </div>
          <span className="bg-[#2497DE] text-white px-2 py-0.5 rounded-full font-mono text-[10px] font-bold">FILA</span>
        </div>
      )}

      {/* Grid of Cards */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Card 1: Total SKUs */}
        <div id="stat-card-sku" className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
          <div className="flex justify-between items-start text-slate-400 mb-1">
            <span className="text-[9px] font-bold tracking-wider uppercase font-mono">Total SKUs</span>
            <Package size={14} className="text-[#2497DE]" />
          </div>
          <div className="text-xl font-black text-slate-800 font-mono">{totalProductsCount}</div>
          <p className="text-[9px] text-slate-400 mt-0.5">Vidros na base</p>
        </div>

        {/* Card 2: Saídas Realizadas (FOCO PRINCIPAL) */}
        <div id="stat-card-saidas" className="bg-red-50 border border-red-200 p-3 rounded-xl shadow-sm">
          <div className="flex justify-between items-start text-red-500 mb-1">
            <span className="text-[9px] font-bold tracking-wider uppercase font-mono">Saídas</span>
            <TrendingUp size={14} className="text-red-600 rotate-180" />
          </div>
          <div className="text-xl font-black text-red-700 font-mono">-{totalSaidasQty}</div>
          <p className="text-[9px] text-red-600/80 font-bold mt-0.5">{saidasMovements.length} baixas</p>
        </div>

        {/* Card 3: Low Stock */}
        <div id="stat-card-low-stock" className={`border p-3 rounded-xl transition shadow-sm ${lowStockProducts.length > 0 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white border-slate-200'}`}>
          <div className="flex justify-between items-start text-slate-400 mb-1">
            <span className="text-[9px] font-bold tracking-wider uppercase font-mono">Estoque Baixo</span>
            <AlertTriangle size={14} className={lowStockProducts.length > 0 ? 'text-amber-500 animate-bounce' : 'text-slate-300'} />
          </div>
          <div className={`text-xl font-black font-mono ${lowStockProducts.length > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {lowStockProducts.length}
          </div>
          <p className="text-[9px] text-slate-400 mt-0.5">Reposição</p>
        </div>
      </div>

      {/* HISTÓRICO RECENTE DE SAÍDAS DIÁRIAS */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-600"></span>
            <h4 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">
              Últimas Saídas Diárias
            </h4>
          </div>
          <span className="text-[10px] font-mono text-slate-400 font-bold">{saidasMovements.length} registradas</span>
        </div>

        {saidasMovements.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">Nenhuma saída de peça registrada nesta sessão ainda.</p>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {saidasMovements.slice(-5).reverse().map((mov) => {
              const prod = products.find((p) => p.barcode === mov.barcode);
              return (
                <div key={mov.id} className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {prod ? prod.description : `Cód: ${mov.barcode}`}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                      <span>Cód: <strong>{mov.barcode}</strong></span>
                      <span>•</span>
                      <span className="text-red-600 font-bold">Destino: {mov.destination || 'Oficina'}</span>
                      {mov.orderNumber && <span>• OS: {mov.orderNumber}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="bg-red-100 text-red-700 font-bold font-mono text-xs px-2 py-0.5 rounded-lg">
                      -{mov.quantity} un
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Real-time stock audit list if low stock items exist */}
      {lowStockProducts.length > 0 && (
        <div id="low-stock-panel" className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-amber-600 font-bold text-xs uppercase tracking-wider font-mono mb-2.5">
            <AlertTriangle size={14} />
            <span>ALERTA: Reposição Urgente</span>
          </div>
          <div className="space-y-2">
            {lowStockProducts.slice(0, 3).map((p) => (
              <div key={p.barcode} className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg flex justify-between items-center">
                <div className="truncate pr-2">
                  <div className="text-xs font-semibold text-slate-800 truncate">{p.description}</div>
                  <div className="text-[10px] text-slate-400 font-mono">Cód: {p.barcode}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-red-600 font-mono">{p.stock} un</div>
                  <div className="text-[9px] text-slate-400">mín: {p.minStock}</div>
                </div>
              </div>
            ))}
            {lowStockProducts.length > 3 && (
              <div className="text-center text-[10px] text-slate-400 mt-1">
                E mais {lowStockProducts.length - 3} itens em estado crítico...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Scanned / Active Products */}
      <div id="top-products-panel" className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase font-mono mb-3 flex items-center gap-1.5">
          <TrendingUp size={14} className="text-[#2497DE]" />
          Mais Movimentados (Giro)
        </h3>
        {topProducts.length === 0 ? (
          <div className="text-center py-4 text-xs text-slate-400 font-mono">Nenhuma movimentação registrada ainda.</div>
        ) : (
          <div className="space-y-2.5">
            {topProducts.map((p, idx) => (
              <div key={p.barcode} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-[#2497DE]/10 text-[#2497DE] flex items-center justify-center font-mono font-bold text-xs shrink-0">
                  {idx + 1}
                </div>
                <div className="truncate flex-1">
                  <div className="text-xs text-slate-800 font-semibold truncate">{p.description}</div>
                  <span className="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded-md font-mono">{p.category}</span>
                </div>
                <div className="text-xs font-bold text-slate-800 font-mono shrink-0">
                  {p.quantity} un
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* INTELIGÊNCIA ARTIFICIAL: CANINANA AI PANEL */}
      <div id="ai-insights-panel" className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden border-l-4 border-l-[#2497DE]">
        {/* AI Gradient indicator */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-radial from-[#2497DE]/5 to-transparent pointer-events-none"></div>
        
        <div className="flex items-center justify-between mb-3 relative">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#2497DE]/10 flex items-center justify-center">
              <Sparkles className="text-[#2497DE] animate-pulse" size={14} />
            </div>
            <div>
              <h3 className="text-xs font-bold tracking-wider text-slate-800 uppercase font-mono">Inteligência Artificial</h3>
              <p className="text-[9px] text-[#2497DE] font-bold tracking-widest font-mono uppercase">CANINANA AI ASSISTANT</p>
            </div>
          </div>
          <BrainCircuit className="text-slate-300" size={18} />
        </div>

        <p className="text-xs text-slate-500 leading-relaxed mb-4">
          Utilize o Gemini para cruzar as leituras de inventário físico com o estoque teórico, gerar sugestões de reposição ou validar erros de digitação.
        </p>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            id="ai-generate-report-btn"
            onClick={triggerSmartReport}
            disabled={aiLoading}
            className="bg-[#2497DE] hover:bg-[#1d7ebc] text-white text-[10px] font-bold py-2.5 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 uppercase tracking-wider font-mono shadow-sm active:scale-98"
          >
            <Clipboard size={12} />
            RELATÓRIO DE GIRO
          </button>
          <button
            id="ai-detect-errors-btn"
            onClick={triggerErrorDetection}
            disabled={aiLoading}
            className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-[10px] font-bold py-2.5 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 uppercase tracking-wider font-mono shadow-sm active:scale-98"
          >
            <RefreshCw size={12} className={aiLoading ? 'animate-spin' : ''} />
            DETECTAR ERROS
          </button>
        </div>

        {/* AI Output Area */}
        {aiLoading && (
          <div id="ai-loading-box" className="mt-4 bg-slate-50 border border-slate-150 rounded-xl p-4 text-center animate-pulse">
            <div className="inline-block relative w-8 h-8 mb-2">
              <div className="absolute top-0 left-0 w-full h-full border-4 border-[#2497DE]/15 rounded-full"></div>
              <div className="absolute top-0 left-0 w-full h-full border-4 border-t-[#2497DE] rounded-full animate-spin"></div>
            </div>
            <div className="text-xs font-semibold text-slate-800 font-mono">{loadingMsg}</div>
            <div className="text-[10px] text-slate-400 mt-1">Isso pode levar de 2 a 5 segundos...</div>
          </div>
        )}

        {/* 1. Report Output */}
        {!aiLoading && aiReport && (
          <div id="ai-report-output" className="mt-4 bg-slate-50 border border-slate-150 rounded-xl p-4 text-xs text-slate-600 leading-relaxed space-y-3 font-sans max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
              <span className="font-bold font-mono text-[10px] text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 size={12} />
                Relatório Gerado com Sucesso
              </span>
              <button 
                onClick={() => setAiReport(null)} 
                className="text-slate-400 hover:text-slate-700 font-mono text-[9px] uppercase cursor-pointer"
              >
                Fechar
              </button>
            </div>
            <div className="whitespace-pre-wrap font-sans text-xs text-slate-700 leading-relaxed">
              {aiReport}
            </div>
          </div>
        )}

        {/* 2. Operational Errors Alert List */}
        {!aiLoading && aiErrors && (
          <div id="ai-errors-output" className="mt-4 bg-slate-50 border border-slate-150 rounded-xl p-4 text-xs space-y-3 max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
              <span className="font-bold font-mono text-[10px] text-amber-600 uppercase tracking-wider">
                Auditoria de Consistência Realizada ({aiErrors.length} Alertas)
              </span>
              <button 
                onClick={() => setAiErrors(null)} 
                className="text-slate-400 hover:text-slate-700 font-mono text-[9px] uppercase cursor-pointer"
              >
                Fechar
              </button>
            </div>
            {aiErrors.length === 0 ? (
              <div className="text-center py-4 text-slate-400 font-mono text-[11px]">
                🎉 Nenhum erro ou comportamento anômalo detectado! Operação em perfeitas condições.
              </div>
            ) : (
              <div className="space-y-3">
                {aiErrors.map((err, idx) => (
                  <div key={idx} className="border-l-2 border-amber-500 pl-3 py-1 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                      <span className={`w-1.5 h-1.5 rounded-full ${err.severity === 'high' ? 'bg-red-500 animate-ping' : err.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-400'}`}></span>
                      {err.title}
                    </div>
                    <div className="text-slate-500 text-[11px] leading-normal">{err.description}</div>
                    <div className="text-slate-700 text-[10px] leading-normal bg-[#2497DE]/5 p-2 rounded-lg border border-[#2497DE]/10 font-mono">
                      💡 Ação recomendada: {err.action}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SYSTEM AUDIT ACTIVITY LOGS */}
      <div id="system-logs-panel" className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase font-mono mb-3 flex items-center gap-1.5">
          <Clock size={14} className="text-slate-400" />
          Logs Recentes do Coletor
        </h3>
        <div className="space-y-2 font-mono text-[10px]">
          {logs.slice().reverse().slice(0, 4).map((log) => (
            <div key={log.id} className="flex items-start gap-2 border-b border-slate-100 pb-2 last:border-none">
              <span className="text-slate-400">[{log.timestamp.split('T')[1]?.substring(0, 5) || '13:47'}]</span>
              <span className="text-[#2497DE] shrink-0 font-bold">@{log.user}:</span>
              <span className="text-slate-600 flex-1 break-all">{log.message}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-center py-4 text-slate-400">Nenhum log disponível.</div>
          )}
        </div>
      </div>
    </div>
  );
}
