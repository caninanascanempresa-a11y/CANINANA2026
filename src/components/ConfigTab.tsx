/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  CloudLightning, 
  Copy, 
  Check, 
  Database, 
  Trash2, 
  Download, 
  Wifi, 
  WifiOff, 
  HelpCircle, 
  Code,
  FileSpreadsheet,
  Camera,
  Upload,
  X,
  Mail,
  User as UserIcon,
  Github
} from 'lucide-react';
import { Product, Movement, InventoryItem, SystemLog, User } from '../types';
import { playBeep } from '../utils/audio';
import { GOOGLE_APPS_SCRIPT_CODE } from '../googleAppsScriptTemplate';

interface ConfigTabProps {
  gasUrl: string;
  setGasUrl: (url: string) => void;
  backendUrl: string;
  setBackendUrl: (url: string) => void;
  isOnline: boolean;
  products: Product[];
  movements: Movement[];
  inventory: InventoryItem[];
  logs: SystemLog[];
  user: User;
  onClearDatabase: () => void;
  onSync: () => Promise<void>;
  onFetchSheets?: () => Promise<boolean | void> | void;
  isSyncing: boolean;
}

export default function ConfigTab({
  gasUrl,
  setGasUrl,
  backendUrl,
  setBackendUrl,
  isOnline,
  products,
  movements,
  inventory,
  logs,
  user,
  onClearDatabase,
  onSync,
  onFetchSheets,
  isSyncing
}: ConfigTabProps) {
  const [activeTab, setActiveTab] = useState<'Produtos' | 'Movimentações' | 'Inventário' | 'Logs'>('Produtos');
  const [copied, setCopied] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [isFetchingSheets, setIsFetchingSheets] = useState(false);

  // GitHub Backup configuration states
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('caninana_github_token') || '');
  const [githubRepo, setGithubRepo] = useState(() => localStorage.getItem('caninana_github_repo') || '');
  const [githubBranch, setGithubBranch] = useState(() => localStorage.getItem('caninana_github_branch') || 'main');
  const [githubPath, setGithubPath] = useState(() => localStorage.getItem('caninana_github_path') || 'backups/caninana_backup.json');
  const [isGithubBackingUp, setIsGithubBackingUp] = useState(false);
  const [githubStatus, setGithubStatus] = useState<{ type: 'success' | 'error' | '', message: string }>({ type: '', message: '' });

  const handleGithubBackup = async () => {
    if (!githubToken || !githubRepo || !githubPath) {
      setGithubStatus({ type: 'error', message: 'Por favor, preencha o token, repositório e caminho.' });
      playBeep('error');
      return;
    }

    setIsGithubBackingUp(true);
    setGithubStatus({ type: '', message: '' });

    localStorage.setItem('caninana_github_token', githubToken);
    localStorage.setItem('caninana_github_repo', githubRepo);
    localStorage.setItem('caninana_github_branch', githubBranch);
    localStorage.setItem('caninana_github_path', githubPath);

    const backupData = {
      products,
      movements,
      inventory,
      logs,
      backupDate: new Date().toISOString()
    };

    try {
      const response = await fetch('/api/db/github-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: githubToken,
          repo: githubRepo,
          branch: githubBranch,
          filepath: githubPath,
          content: JSON.stringify(backupData, null, 2),
          message: `Backup de estoque Caninana Auto Vidros - ${new Date().toLocaleDateString('pt-BR')}`
        })
      });

      const data = await response.json();
      if (data.success) {
        setGithubStatus({ type: 'success', message: 'Backup enviado com sucesso para o GitHub!' });
        playBeep('success');
      } else {
        setGithubStatus({ type: 'error', message: data.error || 'Erro ao enviar backup.' });
        playBeep('error');
      }
    } catch (error: any) {
      console.error(error);
      setGithubStatus({ type: 'error', message: 'Falha na comunicação com o servidor.' });
      playBeep('error');
    } finally {
      setIsGithubBackingUp(false);
    }
  };

  const pendingMovements = movements.filter((m) => !m.synced).length;
  const pendingInventory = inventory.filter((i) => !i.synced).length;
  const totalPending = pendingMovements + pendingInventory;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSyncClick = async () => {
    await onSync();
  };

  // Convert array data to CSV and trigger local file download
  const downloadCSV = (title: string, headers: string[], rows: any[][]) => {
    const content = [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), content], { type: 'text/csv;charset=utf-8;' }); // Add BOM for excel
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Caninana_${title}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportTableToCSV = () => {
    if (activeTab === 'Produtos') {
      downloadCSV(
        'Produtos',
        ['barcode', 'description', 'category', 'application', 'stock', 'minStock'],
        products.map((p) => [p.barcode, p.description, p.category, p.application, p.stock, p.minStock])
      );
    } else if (activeTab === 'Movimentações') {
      downloadCSV(
        'Movimentacoes',
        ['id', 'barcode', 'type', 'quantity', 'originLocation', 'destinationLocation', 'date', 'user', 'synced'],
        movements.map((m) => [m.id, m.barcode, m.type, m.quantity, m.originLocation || '', m.destinationLocation || '', m.date, m.user, m.synced ? 'SIM' : 'NÃO'])
      );
    } else if (activeTab === 'Inventário') {
      downloadCSV(
        'Inventario',
        ['barcode', 'description', 'countedQuantity', 'date', 'user', 'synced'],
        inventory.map((i) => [i.barcode, i.description || '', i.countedQuantity, i.date, i.user, i.synced ? 'SIM' : 'NÃO'])
      );
    } else if (activeTab === 'Logs') {
      downloadCSV(
        'Logs',
        ['id', 'timestamp', 'message', 'type', 'user'],
        logs.map((l) => [l.id, l.timestamp, l.message, l.type, l.user])
      );
    }
  };

  return (
    <div id="config-tab-container" className="p-4 max-w-lg mx-auto pb-24 space-y-5 animate-fade-in">
      
      {/* CONNECTION STATUS & GOOGLE SPREADSHEET SETUP */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-[#2497DE]" size={18} />
            <h3 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">Planilha Google Sheets</h3>
          </div>
          <a
            href="https://docs.google.com/spreadsheets/d/10nUmSSw_OIVKlm7vAZ-fK4LF_vx4CZKLQDH9kTxhLFE/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[#2497DE] hover:underline font-bold font-mono flex items-center gap-1 bg-sky-50 px-2 py-1 rounded border border-sky-100"
          >
            Abrir Planilha Oficial
          </a>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1 font-mono">URL do Google Apps Script Web App</label>
            <input
              id="gas-url-input"
              type="text"
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl py-3 px-3 text-xs focus:outline-none focus:border-[#2497DE] font-mono truncate"
              value={gasUrl}
              onChange={(e) => setGasUrl(e.target.value)}
            />
          </div>

          {/* Quick Button to Fetch Sheets Data */}
          <button
            id="fetch-sheets-data-btn"
            type="button"
            onClick={async () => {
              if (onFetchSheets) {
                setIsFetchingSheets(true);
                try {
                  await onFetchSheets();
                } finally {
                  setIsFetchingSheets(false);
                }
              }
            }}
            disabled={isFetchingSheets || isSyncing}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-[11px] transition cursor-pointer flex items-center justify-center gap-2 border border-slate-200 disabled:opacity-50"
          >
            <Download size={14} className={isFetchingSheets ? 'animate-bounce' : ''} />
            {isFetchingSheets ? 'PUXANDO DADOS DA PLANILHA...' : 'PUXAR CATÁLOGO & ESTOQUES DA PLANILHA'}
          </button>

          <div>
            <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1 font-mono">Endereço do Servidor Backend Local (Computador)</label>
            <input
              id="backend-url-input"
              type="text"
              placeholder="http://192.168.0.x:3000"
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl py-3 px-3 text-xs focus:outline-none focus:border-[#2497DE] font-mono truncate"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
            />
            <p className="text-[9px] text-slate-400 mt-1">Insira o IP do seu computador caso queira testar a IA (Gemini) diretamente do celular.</p>
          </div>

          {/* Connection diagnostics */}
          <div className="flex items-center justify-between text-xs py-1">
            <span className="text-slate-400 font-mono text-[10px] uppercase">Status de Rede:</span>
            <div className="flex items-center gap-1.5">
              {!isOnline ? (
                <span id="network-offline-status" className="text-red-700 font-bold font-mono text-[10px] flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                  <WifiOff size={12} />
                  DISPOSITIVO OFFLINE
                </span>
              ) : (
                <span id="network-online-status" className="text-green-700 font-bold font-mono text-[10px] flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-md border border-green-200">
                  <Wifi size={12} />
                  ONLINE
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SYNC ACTIONS PANEL */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">Fila de Sincronia</h3>
            <p className="text-[10px] text-slate-400">Coletas locais armazenadas no dispositivo</p>
          </div>
          <span className="bg-slate-100 text-slate-700 font-mono text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200">
            {totalPending} pendentes
          </span>
        </div>

        {/* Sync Button */}
        <button
          id="manual-sync-trigger"
          onClick={handleSyncClick}
          disabled={isSyncing}
          className="w-full bg-[#2497DE] hover:bg-[#1d7ebc] text-white py-3 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 active:scale-98"
        >
          <CloudLightning size={16} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? 'SINCRONIZANDO COM PLANILHA...' : 'SINCRONIZAR AGORA COM PLANILHA'}
        </button>
      </div>

      {/* GITHUB BACKUP INTEGRATION PANEL */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <Github className="text-slate-800" size={18} />
          <h3 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">Integração com GitHub (Backup)</h3>
        </div>
        
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Exporte o estado completo do banco de dados (produtos, movimentações, contagens físicas de inventário e logs) diretamente para um repositório no GitHub para backup.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1 font-mono">Personal Access Token (PAT)</label>
            <input
              id="github-token-input"
              type="password"
              placeholder="ghp_..."
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl py-3 px-3 text-xs focus:outline-none focus:border-slate-800 font-mono"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1 font-mono">Repositório</label>
              <input
                id="github-repo-input"
                type="text"
                placeholder="usuario/repositorio"
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl py-3 px-3 text-xs focus:outline-none focus:border-slate-800 font-mono"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1 font-mono">Branch</label>
              <input
                id="github-branch-input"
                type="text"
                placeholder="main"
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl py-3 px-3 text-xs focus:outline-none focus:border-slate-800 font-mono"
                value={githubBranch}
                onChange={(e) => setGithubBranch(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1 font-mono">Caminho do Arquivo</label>
            <input
              id="github-path-input"
              type="text"
              placeholder="backups/estoque.json"
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl py-3 px-3 text-xs focus:outline-none focus:border-slate-800 font-mono"
              value={githubPath}
              onChange={(e) => setGithubPath(e.target.value)}
            />
          </div>

          {githubStatus.message && (
            <div className={`p-3 rounded-xl text-xs font-semibold ${
              githubStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {githubStatus.message}
            </div>
          )}

          <button
            id="github-backup-btn"
            onClick={handleGithubBackup}
            disabled={isGithubBackingUp}
            className="w-full bg-gradient-to-r from-slate-800 to-slate-950 hover:from-slate-900 hover:to-black text-white py-3 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 active:scale-98"
          >
            <Github size={16} className={isGithubBackingUp ? 'animate-spin' : ''} />
            {isGithubBackingUp ? 'ENVIANDO BACKUP PARA O GITHUB...' : 'EXPORTAR ESTOQUE PARA O GITHUB'}
          </button>
        </div>
      </div>

      {/* SCRIPT INTEGRATION GUIDE & COPY ZONE */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Code className="text-[#2497DE]" size={16} />
          <h4 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">Código Google Apps Script</h4>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Instale o script na sua planilha Google para permitir que o smartphone atualize os estoques e registre logs de movimentações em tempo real.
        </p>
        
        {/* Copy Box */}
        <div className="relative bg-slate-50 border border-slate-200 rounded-xl p-3">
          <pre className="text-[9px] font-mono text-slate-500 max-h-24 overflow-y-auto whitespace-pre-wrap select-all leading-normal">
            {GOOGLE_APPS_SCRIPT_CODE}
          </pre>
          <button
            id="copy-script-code-btn"
            type="button"
            onClick={handleCopyCode}
            className="absolute top-2.5 right-2.5 bg-[#2497DE] hover:bg-[#1d7ebc] text-white text-[10px] py-1 px-2.5 rounded-md font-bold font-mono flex items-center gap-1 cursor-pointer transition shadow-sm"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'COPIADO!' : 'COPIAR SCRIPT'}
          </button>
        </div>
      </div>

      {/* RAW DATABASE TAB EXPLORER */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Database className="text-slate-400" size={16} />
            <h4 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">Visualizador de Abas</h4>
          </div>
          {/* Download CSV */}
          <button
            id="export-csv-btn"
            onClick={exportTableToCSV}
            className="text-slate-500 hover:text-slate-800 border border-slate-200 bg-slate-50 py-1.5 px-2.5 rounded-lg text-[10px] font-bold font-mono flex items-center gap-1 cursor-pointer transition active:bg-slate-100"
          >
            <Download size={12} />
            Exportar .CSV
          </button>
        </div>

        {/* Tab Header Selector */}
        <div className="flex gap-1 border-b border-slate-100 pb-2 overflow-x-auto scrollbar-none">
          {(['Produtos', 'Movimentações', 'Inventário', 'Logs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono transition cursor-pointer ${
                activeTab === tab 
                  ? 'bg-[#2497DE] border border-[#2497DE] text-white font-bold shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Raw Viewport Content */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-x-auto max-h-56 shadow-inner">
          {activeTab === 'Produtos' && (
            <table className="w-full text-left font-mono text-[9px]">
              <thead className="bg-slate-100 text-slate-500 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-2">Barras</th>
                  <th className="p-2">Descrição</th>
                  <th className="p-2 text-right">Qtd</th>
                  <th className="p-2 text-right">Mín</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 divide-y divide-slate-150">
                {products.map((p) => (
                  <tr key={p.barcode} className="hover:bg-slate-100/60 transition">
                    <td className="p-2 font-bold text-slate-800">{p.barcode}</td>
                    <td className="p-2 truncate max-w-[120px] text-slate-600" title={p.description}>{p.description}</td>
                    <td className="p-2 text-right text-[#2497DE] font-bold">{p.stock}</td>
                    <td className="p-2 text-right text-slate-400">{p.minStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'Movimentações' && (
            <table className="w-full text-left font-mono text-[9px]">
              <thead className="bg-slate-100 text-slate-500 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Barras</th>
                  <th className="p-2 text-right">Qtd</th>
                  <th className="p-2 text-center">Sync</th>
                  <th className="p-2">Hora</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 divide-y divide-slate-150">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-100/60 transition">
                    <td className={`p-2 font-bold ${m.type === 'Entrada' ? 'text-green-600' : m.type === 'Saída' ? 'text-red-600' : 'text-blue-500'}`}>
                      {m.type}
                    </td>
                    <td className="p-2 text-slate-600 font-bold">{m.barcode}</td>
                    <td className="p-2 text-right font-bold text-slate-800">{m.quantity}</td>
                    <td className="p-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${m.synced ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                        {m.synced ? 'OK' : 'OFF'}
                      </span>
                    </td>
                    <td className="p-2 text-slate-400">
                      {m.date.split('T')[1]?.substring(0, 8) || '13:47'}
                    </td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400 font-sans">Sem registros de movimentações.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'Inventário' && (
            <table className="w-full text-left font-mono text-[9px]">
              <thead className="bg-slate-100 text-slate-500 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-2">EAN Barras</th>
                  <th className="p-2 text-right">Contado</th>
                  <th className="p-2 text-center">Sync</th>
                  <th className="p-2">Data/Hora</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 divide-y divide-slate-150">
                {inventory.map((i, idx) => (
                  <tr key={idx} className="hover:bg-slate-100/60 transition">
                    <td className="p-2 font-bold text-slate-800">{i.barcode}</td>
                    <td className="p-2 text-right text-green-600 font-bold">{i.countedQuantity} un</td>
                    <td className="p-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${i.synced ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                        {i.synced ? 'OK' : 'OFF'}
                      </span>
                    </td>
                    <td className="p-2 text-slate-400">
                      {i.date.split('T')[1]?.substring(0, 8) || '13:47'}
                    </td>
                  </tr>
                ))}
                {inventory.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400 font-sans">Nenhum inventário de prateleira lido ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'Logs' && (
            <table className="w-full text-left font-mono text-[9px]">
              <thead className="bg-slate-100 text-slate-500 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="p-2">Hora</th>
                  <th className="p-2">Op</th>
                  <th className="p-2">Ação</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 divide-y divide-slate-150">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-100/60 transition">
                    <td className="p-2 text-slate-400">{l.timestamp.split('T')[1]?.substring(0, 8) || '13:47'}</td>
                    <td className="p-2 text-[#2497DE] font-bold">@{l.user}</td>
                    <td className="p-2 truncate max-w-[150px] text-slate-600" title={l.message}>{l.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* SYSTEM HARD RESET (Admin Only) */}
      {user.role === 'Administrador' && (
        <div className="bg-white border border-red-200 rounded-xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Trash2 className="text-red-500" size={16} />
            <h4 className="text-xs font-bold text-red-600 uppercase font-mono tracking-wider">Perigo: Limpar Coletor</h4>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Esta operação apaga todos os dados locais do coletor armazenados neste smartphone (incluindo coletas offline não sincronizadas).
          </p>
          
          {!resetConfirm ? (
            <button
              id="clear-db-start-btn"
              onClick={() => {
                setResetConfirm(true);
                playBeep('warning');
              }}
              className="bg-red-50 hover:bg-red-105 border border-red-200 text-red-600 py-2.5 rounded-xl text-xs font-bold transition w-full cursor-pointer uppercase tracking-wider font-mono shadow-sm"
            >
              ZERAR DADOS DO DISPOSITIVO
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                id="clear-db-confirm-btn"
                onClick={() => {
                  onClearDatabase();
                  setResetConfirm(false);
                }}
                className="bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-xs font-bold transition flex-1 cursor-pointer"
              >
                SIM, CONFIRMAR APAGAR TUDO
              </button>
              <button
                id="clear-db-cancel-btn"
                onClick={() => {
                  setResetConfirm(false);
                  playBeep('success');
                }}
                className="bg-slate-50 border border-slate-200 text-slate-500 py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
