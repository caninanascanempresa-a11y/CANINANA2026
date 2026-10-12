/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Scan, 
  Search, 
  Settings, 
  LogOut, 
  Wifi, 
  WifiOff, 
  CloudLightning,
  Shield,
  Activity,
  UserCheck,
  User as UserIcon
} from 'lucide-react';
import { Product, Movement, InventoryItem, SystemLog, User } from './types';
import { INITIAL_PRODUCTS } from './productsCatalog';
import LoginScreen from './components/LoginScreen';
import DashboardTab from './components/DashboardTab';
import ScannerTab from './components/ScannerTab';
import QueryTab from './components/QueryTab';
import ConfigTab from './components/ConfigTab';
import ProfileTab from './components/ProfileTab';
import { playBeep } from './utils/audio';
import { supabase } from './utils/supabaseClient';

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('caninana_user');
    return cached ? JSON.parse(cached) : null;
  });

  // Users Database State
  const [users, setUsers] = useState<(User & { passwordHash: string })[]>(() => {
    const cached = localStorage.getItem('caninana_users_db');
    if (cached) return JSON.parse(cached);
    
    // Default initial users
    return [
      {
        username: 'admin',
        name: 'Carlos Caninana',
        role: 'Administrador' as const,
        email: 'carlos@caninana.com.br',
        avatar: '',
        passwordHash: '123'
      },
      {
        username: 'operador',
        name: 'Thiago Silva',
        role: 'Operador' as const,
        email: 'thiago@caninana.com.br',
        avatar: '',
        passwordHash: '123'
      },
      {
        username: 'consulta',
        name: 'Juliana Santos',
        role: 'Consulta' as const,
        email: 'juliana@caninana.com.br',
        avatar: '',
        passwordHash: '123'
      }
    ];
  });

  // Database States
  const [products, setProducts] = useState<Product[]>(() => {
    const cached = localStorage.getItem('caninana_products');
    return cached ? JSON.parse(cached) : INITIAL_PRODUCTS;
  });

  const [movements, setMovements] = useState<Movement[]>(() => {
    const cached = localStorage.getItem('caninana_movements');
    return cached ? JSON.parse(cached) : [];
  });

  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const cached = localStorage.getItem('caninana_inventory');
    return cached ? JSON.parse(cached) : [];
  });

  const [logs, setLogs] = useState<SystemLog[]>(() => {
    const cached = localStorage.getItem('caninana_logs');
    if (cached) return JSON.parse(cached);
    
    // Default initial system log and successful sync notification log
    return [
      {
        id: 'log_init',
        timestamp: new Date(Date.now() - 60000).toISOString(),
        message: 'Coletor de dados Caninana inicializado com sucesso.',
        type: 'success',
        user: 'Sistema'
      },
      {
        id: 'log_qr_success',
        timestamp: new Date().toISOString(),
        message: 'Aviso: Configuração da planilha realizada. QR Code lido e sincronização estabelecida com sucesso.',
        type: 'success',
        user: 'admin'
      }
    ];
  });

  // Default Google Apps Script Web App URL for Caninana Auto Vidros
  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxI024PKKAR0xvWgEOUBZzzyJz2zYbl6zzt41aLIQVvAzM9S5gVLAB_ucz2r5irlqch/exec';

  // Settings & Sync States
  const [gasUrl, setGasUrl] = useState<string>(() => {
    return localStorage.getItem('caninana_gas_url') || DEFAULT_GAS_URL;
  });

  const [backendUrl, setBackendUrl] = useState<string>(() => {
    return localStorage.getItem('caninana_backend_url') || 'http://localhost:3000';
  });

  useEffect(() => {
    localStorage.setItem('caninana_backend_url', backendUrl);
  }, [backendUrl]);

  // Dynamic API Base URL resolver for hybrid environments (Android WebView vs Web Browser)
  const getApiUrl = (path: string) => {
    if (window.location.hostname.includes('androidplatform.net') || window.location.protocol === 'file:') {
      // Use configured desktop backend URL on the mobile device
      return `${backendUrl.replace(/\/$/, '')}${path}`;
    }
    return path;
  };

  const isSimulatedOffline = false;

  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Active Screen Tab
  const [activeTab, setActiveTab] = useState<'Dashboard' | 'Scanner' | 'Consulta' | 'Perfil' | 'Config'>('Dashboard');

  // Persistence triggers
  useEffect(() => {
    localStorage.setItem('caninana_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('caninana_movements', JSON.stringify(movements));
  }, [movements]);

  useEffect(() => {
    localStorage.setItem('caninana_inventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('caninana_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('caninana_gas_url', gasUrl);
  }, [gasUrl]);

  useEffect(() => {
    localStorage.setItem('caninana_users_db', JSON.stringify(users));
  }, [users]);

  // Fetch initial database state from Server DB, Supabase and Google Sheets
  useEffect(() => {
    const loadInitialData = async () => {
      // 1. Tenta carregar do backend local (/api/db/load) se disponível
      try {
        const resp = await fetch(getApiUrl('/api/db/load'));
        if (resp.ok && resp.headers.get('content-type')?.includes('application/json')) {
          const resJson = await resp.json();
          if (resJson.success && resJson.data) {
            if (Array.isArray(resJson.data.products) && resJson.data.products.length > 0) {
              setProducts(resJson.data.products);
            }
            if (Array.isArray(resJson.data.users) && resJson.data.users.length > 0) {
              setUsers(resJson.data.users);
            }
            if (Array.isArray(resJson.data.movements) && resJson.data.movements.length > 0) {
              setMovements(resJson.data.movements);
            }
          }
        }
      } catch (err) {
        // Ambiente Vercel estático / offline contingência normal
      }

      // 2. Tenta carregar do Supabase se disponível
      try {
        const { data: remoteProducts, error: prodErr } = await supabase.from('products').select('*');
        if (!prodErr && remoteProducts && remoteProducts.length > 0) {
          const parsedProducts: Product[] = remoteProducts.map(p => ({
            barcode: p.barcode,
            description: p.description,
            category: p.category || '',
            application: p.application || '',
            stock: p.stock || 0,
            minStock: p.min_stock || 3
          }));
          setProducts(parsedProducts);
        }

        const { data: remoteUsers, error: userErr } = await supabase.from('users').select('*');
        if (!userErr && remoteUsers && remoteUsers.length > 0) {
          setUsers(remoteUsers.map(u => ({
            username: u.username,
            name: u.name,
            role: u.role as any,
            email: u.email || ''
          })));
        }
      } catch (err) {
        // Supabase offline
      }

      // 3. Tenta carregar dados atualizados da Planilha Google em segundo plano
      const activeGas = localStorage.getItem('caninana_gas_url') || DEFAULT_GAS_URL;
      if (activeGas) {
        fetchDataFromGoogleSheets(false, activeGas);
      }
    };

    loadInitialData();
  }, []);

  // Network connection listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addLog('Dispositivo detectou sinal de rede (Online).', 'info', 'Sistema');
      // Trigger background auto sync if not simulated offline
      if (!isSimulatedOffline) {
        syncDataWithServer();
        syncDataWithGoogleSheets();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      addLog('Dispositivo perdeu sinal de rede (Offline). Modo offline ativado.', 'warning', 'Sistema');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isSimulatedOffline, gasUrl, movements, inventory]);

  // Handle User Login
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('caninana_user', JSON.stringify(user));
    
    // Append log
    addLog(`Operador ${user.name} autenticado no nível [${user.role}].`, 'success', user.username);
  };

  // Handle Profile Update
  const handleUpdateProfile = async (updatedFields: Partial<User & { passwordHash?: string }>) => {
    if (!currentUser) return;
    
    const { passwordHash, ...userFields } = updatedFields;
    const updatedUser = { ...currentUser, ...userFields };
    setCurrentUser(updatedUser);
    localStorage.setItem('caninana_user', JSON.stringify(updatedUser));
    
    setUsers((prevUsers) => 
      prevUsers.map((u) => 
        u.username === currentUser.username 
          ? { ...u, ...updatedFields } 
          : u
      )
    );
    
    if (isOnline && !isSimulatedOffline) {
      try {
        const updatePayload: any = {
          name: updatedUser.name,
          role: updatedUser.role,
          email: updatedUser.email || ''
        };
        if (passwordHash) {
          updatePayload.password_hash = passwordHash;
        }
        await supabase
          .from('users')
          .update(updatePayload)
          .eq('username', currentUser.username);
      } catch (e) {
        console.error('Failed to sync profile update to Supabase:', e);
      }
    }
    
    playBeep('success');
    addLog(`Perfil do operador @${currentUser.username} atualizado com sucesso.`, 'success', currentUser.username);
  };

  // Handle Admin updating other user profiles
  const handleUpdateAnyUser = async (username: string, updatedFields: Partial<User & { passwordHash?: string }>) => {
    setUsers((prevUsers) => 
      prevUsers.map((u) => 
        u.username === username 
          ? { ...u, ...updatedFields } 
          : u
      )
    );

    // If the updated user is currently logged in, sync their local profile too!
    if (currentUser && currentUser.username === username) {
      const { passwordHash, ...userFields } = updatedFields;
      const updatedUser = { ...currentUser, ...userFields };
      setCurrentUser(updatedUser);
      localStorage.setItem('caninana_user', JSON.stringify(updatedUser));
    }

    if (isOnline && !isSimulatedOffline) {
      try {
        const updatePayload: any = {};
        if (updatedFields.name) updatePayload.name = updatedFields.name;
        if (updatedFields.role) updatePayload.role = updatedFields.role;
        if (updatedFields.email) updatePayload.email = updatedFields.email;
        if (updatedFields.passwordHash) updatePayload.password_hash = updatedFields.passwordHash;

        await supabase
          .from('users')
          .update(updatePayload)
          .eq('username', username);
      } catch (e) {
        console.error('Failed to sync user profile update to Supabase:', e);
      }
    }

    playBeep('success');
    addLog(`Operador @${username} atualizado pelo administrador.`, 'success', currentUser?.username || 'admin');
  };

  // Handle Admin adding a new user profile
  const handleAddUser = async (newUser: User & { passwordHash: string }) => {
    setUsers((prevUsers) => [...prevUsers, newUser]);

    if (isOnline && !isSimulatedOffline) {
      try {
        await supabase
          .from('users')
          .insert({
            username: newUser.username,
            name: newUser.name,
            role: newUser.role,
            email: newUser.email || '',
            password_hash: newUser.passwordHash
          });
      } catch (e) {
        console.error('Failed to insert user profile to Supabase:', e);
      }
    }

    addLog(`Novo operador @${newUser.username} cadastrado no nível [${newUser.role}].`, 'success', currentUser?.username || 'admin');
  };

  // Handle Logout
  const handleLogout = () => {
    if (currentUser) {
      addLog(`Operador @${currentUser.username} desconectou-se do coletor.`, 'info', currentUser.username);
    }
    setCurrentUser(null);
    localStorage.removeItem('caninana_user');
    playBeep('warning');
  };

  // Add Log Helper
  const addLog = (message: string, type: 'info' | 'warning' | 'error' | 'success', operatorUsername: string) => {
    const newLog: SystemLog = {
      id: 'log_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      message,
      type,
      user: operatorUsername
    };
    setLogs((prev) => [...prev, newLog]);
  };

  // Handle custom scans (like Google Spreadsheet link or Google Web App link)
  const handleCustomScan = (text: string) => {
    const normalizedText = text.trim();
    if (
      normalizedText.includes('10nUmSSw_OIVKlm7vAZ-fK4LF_vx4CZKLQDH9kTxhLFE') ||
      normalizedText.includes('docs.google.com/spreadsheets/d/10nUmSSw_OIVKlm7vAZ-fK4LF_vx4CZKLQDH9kTxhLFE') ||
      normalizedText.includes('docs.google.com/spreadsheets/d/1hpSmTKNZPfvopm_ZayB3KXibNF2CFLwnpqG-OC8WFvg') ||
      normalizedText.includes('1hpSmTKNZPfvopm_ZayB3KXibNF2CFLwnpqG-OC8WFvg') ||
      normalizedText.includes('AKfycbxI024PKKAR0xvWgEOUBZzzyJz2zYbl6zzt41aLIQVvAzM9S5gVLAB_ucz2r5irlqch') ||
      normalizedText.includes('AKfycbz6aPZdwu1JSXxcqqpVTldZrpDEnWSGMuO-MiInBMnsmfxjUyaYr1F4NRCQ-o1vi21UnQ')
    ) {
      const targetUrl = normalizedText.includes('script.google.com')
        ? normalizedText
        : 'https://docs.google.com/spreadsheets/d/10nUmSSw_OIVKlm7vAZ-fK4LF_vx4CZKLQDH9kTxhLFE/edit';
      setGasUrl(targetUrl);
      localStorage.setItem('caninana_gas_url', targetUrl);
      
      addLog('QR Code lido com sucesso! Planilha Oficial da Caninana Auto Vidros conectada.', 'success', currentUser?.username || 'Sistema');
      
      playBeep('success');
      alert('Planilha Caninana Auto Vidros vinculada via QR Code com sucesso! Carregando catálogo...');
      
      // Auto trigger sync with Google Sheets
      setTimeout(() => {
        fetchDataFromGoogleSheets(true, targetUrl);
      }, 500);
      
      return true;
    }
    
    // If it is any other spreadsheet URL
    if (normalizedText.startsWith('https://docs.google.com/spreadsheets/') || normalizedText.startsWith('https://script.google.com/')) {
      addLog(`QR Code lido: Link ${normalizedText.substring(0, 30)}... detectado.`, 'info', currentUser?.username || 'Sistema');
      playBeep('success');
      return true;
    }
    
    return false;
  };

  // Register a new product manually (scanned but unknown)
  const handleAddProduct = (newProduct: Product) => {
    setProducts((prev) => {
      // Avoid duplicates
      if (prev.some((p) => p.barcode === newProduct.barcode)) return prev;
      return [...prev, newProduct];
    });
    
    addLog(
      `Novo item registrado offline: EAN ${newProduct.barcode} - ${newProduct.description.substring(0, 30)}...`, 
      'info', 
      currentUser?.username || 'Sistema'
    );
  };

  // Register a movement (Entrada, Saída, Transferência)
  const handleAddMovement = (newMovement: Movement) => {
    setMovements((prev) => [...prev, newMovement]);

    // Instantly adjust local stock for immediate feedback
    setProducts((prevProducts) => {
      return prevProducts.map((p) => {
        if (p.barcode === newMovement.barcode) {
          let updatedStock = p.stock;
          if (newMovement.type === 'Entrada') {
            updatedStock += newMovement.quantity;
          } else if (newMovement.type === 'Saída') {
            updatedStock = Math.max(0, p.stock - newMovement.quantity);
          }
          return { ...p, stock: updatedStock };
        }
        return p;
      });
    });

    addLog(
      `Registrado: ${newMovement.type} de ${newMovement.quantity} un do item ${newMovement.barcode}.`,
      'info',
      currentUser?.username || 'Sistema'
    );

    // Auto sync if online and online sync is active
    if (!isSimulatedOffline && isOnline) {
      syncDataWithGoogleSheets([newMovement]);
      syncDataWithServer();
    }
  };

  // Register inventory physical count
  const handleAddInventoryItem = (newItem: InventoryItem) => {
    setInventory((prev) => {
      // Sum duplicates if same barcode exists in currently unsynced inventory checklist
      // "Inventário que soma automaticamente leituras repetidas do mesmo produto"
      const existingIdx = prev.findIndex((item) => item.barcode === newItem.barcode && !item.synced);
      if (existingIdx > -1) {
        const copy = [...prev];
        copy[existingIdx].countedQuantity += newItem.countedQuantity;
        copy[existingIdx].date = newItem.date;
        return copy;
      } else {
        return [...prev, newItem];
      }
    });

    const prod = products.find((p) => p.barcode === newItem.barcode);
    addLog(
      `Inventariado: EAN ${newItem.barcode} (${prod ? prod.description.substring(0, 20) : 'Novo'}). Qtd total lida: +${newItem.countedQuantity}.`,
      'info',
      currentUser?.username || 'Sistema'
    );

    // Auto sync in real-time if conditions match
    if (!isSimulatedOffline && isOnline) {
      setTimeout(() => {
        syncDataWithServer();
        syncDataWithGoogleSheets();
      }, 500);
    }
  };

  // Reset/Clear Database on Server and Client
  const handleClearDatabase = async () => {
    try {
      const response = await fetch(getApiUrl('/api/db/reset'), { method: 'POST' });
      const responseData = await response.json();
      if (responseData.success && responseData.data) {
        const db = responseData.data;
        setProducts(db.products);
        setMovements(db.movements);
        setInventory(db.inventory);
        setLogs(db.logs);
        setUsers(db.users);
      }
    } catch (e) {
      console.error('Failed to reset server DB, falling back to local reset', e);
      setProducts(INITIAL_PRODUCTS);
      setMovements([]);
      setInventory([]);
      setLogs([{
        id: 'log_reset',
        timestamp: new Date().toISOString(),
        message: 'Dispositivo resetado localmente.',
        type: 'warning',
        user: currentUser?.username || 'Sistema'
      }]);
    }
    
    playBeep('error');
  };

  // Fetch products and inventory counts directly from Google Spreadsheet
  const fetchDataFromGoogleSheets = async (showNotification = true, customUrl?: string) => {
    const targetGasUrl = customUrl || gasUrl;
    if (!targetGasUrl) {
      if (showNotification) {
        alert('Por favor, informe a URL do Google Apps Script nas configurações para buscar os dados da planilha.');
      }
      return false;
    }

    if (isSyncing) return false;
    setIsSyncing(true);

    try {
      let resultData: any = null;

      // 1. Tenta via backend proxy local para contornar restrições de CORS
      try {
        const resp = await fetch(getApiUrl('/api/sheets/fetch'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gasUrl: targetGasUrl })
        });
        const json = await resp.json();
        if (json.success && json.data) {
          resultData = json.data;
        } else if (json.error) {
          throw new Error(json.error);
        }
      } catch (proxyErr: any) {
        // Se backend indisponível, tenta requisição direta
        console.warn('Backend proxy indisponível, tentando chamada direta ao Google Apps Script:', proxyErr);
        const directResp = await fetch(targetGasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'fetch' }),
          redirect: 'follow'
        });
        const directJson = await directResp.json();
        if (directJson.success && directJson.data) {
          resultData = directJson.data;
        } else {
          throw new Error(directJson.error || 'Erro ao carregar dados do Google Apps Script');
        }
      }

      if (resultData) {
        if (Array.isArray(resultData.products) && resultData.products.length > 0) {
          setProducts(resultData.products);
          localStorage.setItem('caninana_products', JSON.stringify(resultData.products));
        }
        if (Array.isArray(resultData.users) && resultData.users.length > 0) {
          setUsers((prev) => {
            const map = new Map(prev.map(u => [u.username, u]));
            resultData.users.forEach((u: any) => {
              if (u.username) {
                map.set(u.username, {
                  username: u.username,
                  name: u.name || u.Nome || u.username,
                  role: (u.role || u.Perfil || 'Operador') as any,
                  email: u.email || '',
                  passwordHash: u.passwordHash || '123'
                });
              }
            });
            return Array.from(map.values());
          });
        }

        const count = resultData.products?.length || 0;
        addLog(`Planilha Google conectada! ${count} produtos e saldos de estoque sincronizados.`, 'success', currentUser?.username || 'Sistema');
        playBeep('success');
        if (showNotification) {
          alert(`Planilha Google conectada com sucesso!\n${count} produtos carregados.`);
        }
        return true;
      }
    } catch (err: any) {
      console.error('Falha ao buscar dados da planilha Google:', err);
      addLog(`Aviso na conexão com a planilha: ${err.message || 'Falha de rede'}.`, 'warning', currentUser?.username || 'Sistema');
      if (showNotification) {
        playBeep('warning');
        alert(`Não foi possível conectar à Planilha Google.\n\nDetalhes: ${err.message}\n\nDica: Certifique-se de que o Apps Script foi implantado como "App da Web" com acesso para "Qualquer pessoa" (inclusive anônimos).`);
      }
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync collected movements & inventory items with Google Spreadsheet
  const syncDataWithGoogleSheets = async (customMovements?: Movement[], isManual = false) => {
    if (isSyncing) return;
    setIsSyncing(true);

    const movsToSync = customMovements || movements.filter((m) => !m.synced);
    const pendingInvs = inventory.filter((i) => !i.synced);
    const unsyncedLogs = logs.filter((l) => l.id !== 'log_init');
    const newProducts = products.filter((p) => !INITIAL_PRODUCTS.some((ip) => ip.barcode === p.barcode));

    if (movsToSync.length === 0 && pendingInvs.length === 0 && !isManual) {
      setIsSyncing(false);
      return;
    }

    const payload = {
      movements: movsToSync,
      inventory: pendingInvs,
      logs: unsyncedLogs,
      newProducts: newProducts,
      users: users
    };

    try {
      let syncedSuccess = false;
      let returnedData: any = null;

      if (gasUrl) {
        // 1. Tenta envio direto ao Google Apps Script (Ideal para Vercel e produção)
        try {
          const directResp = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'sync', payload }),
            redirect: 'follow'
          });
          const directJson = await directResp.json();
          if (directJson.success) {
            syncedSuccess = true;
            returnedData = directJson.data;
          } else {
            throw new Error(directJson.error || 'Erro ao sincronizar');
          }
        } catch (directErr: any) {
          console.warn('Envio direto falhou, tentando backend proxy local:', directErr);
          // 2. Se falhar por CORS no localhost, tenta o backend proxy local
          try {
            const resp = await fetch(getApiUrl('/api/sheets/sync'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ gasUrl, payload })
            });
            const json = await resp.json();
            if (json.success) {
              syncedSuccess = true;
              returnedData = json.data;
            } else {
              throw new Error(json.error);
            }
          } catch (proxyErr: any) {
            throw new Error(directErr.message || proxyErr.message || 'Falha ao sincronizar');
          }
        }
      }

      if (syncedSuccess) {
        const syncedIds = new Set(movsToSync.map(m => m.id));
        setMovements((prev) => prev.map((m) => syncedIds.has(m.id) ? { ...m, synced: true } : m));
        setInventory((prev) => prev.map((i) => ({ ...i, synced: true })));

        if (returnedData && Array.isArray(returnedData.products) && returnedData.products.length > 0) {
          setProducts(returnedData.products);
        }

        addLog(`Planilha Google atualizada com sucesso! ${movsToSync.length} mov. enviadas.`, 'success', currentUser?.username || 'Sistema');
        playBeep('success');
        if (isManual) {
          alert('Planilha Google atualizada e sincronizada com sucesso!');
        }
      } else {
        // Fallback: sincroniza com o banco local
        await syncDataWithServer();
        setMovements((prev) => prev.map((m) => ({ ...m, synced: true })));
        setInventory((prev) => prev.map((i) => ({ ...i, synced: true })));
        addLog(`Dados gravados em contingência local.`, 'info', currentUser?.username || 'Sistema');
      }
    } catch (err: any) {
      console.error('Erro na sincronização:', err);
      await syncDataWithServer();
      addLog(`Aviso na sincronização: ${err.message}. Salvo localmente.`, 'warning', currentUser?.username || 'Sistema');
      if (isManual) {
        alert(`Erro na sincronização com a Planilha Google: ${err.message}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync data with local database on the backend server
  const syncDataWithServer = async () => {
    if (isSimulatedOffline || !isOnline) {
      return;
    }

    try {
      const unsyncedMovements = movements.filter((m) => !m.synced);
      const unsyncedInventory = inventory.filter((i) => !i.synced);
      const unsyncedLogs = logs.filter((l) => l.id !== 'log_init');
      const newProducts = products.filter((p) => !INITIAL_PRODUCTS.some((ip) => ip.barcode === p.barcode));

      const payload = {
        movements: unsyncedMovements,
        inventory: unsyncedInventory,
        logs: unsyncedLogs,
        newProducts: newProducts,
        users: users
      };

      const response = await fetch(getApiUrl('/api/db/sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();
      if (responseData.success && responseData.data) {
        const db = responseData.data;
        // Keep synced: true since server set them as synced
        setProducts(db.products);
        setMovements(db.movements);
        setInventory(db.inventory);
        setLogs(db.logs);
        setUsers(db.users);
      }
    } catch (err: any) {
      console.error('Server DB sync failed:', err);
    }
  };


  // Bi-directional Sincronização with Supabase Cloud Database
  const syncDataWithSupabase = async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    // Check if offline or simulated offline
    if (isSimulatedOffline || !isOnline) {
      const pendingMovs = movements.filter((m) => !m.synced).length;
      const pendingInvs = inventory.filter((i) => !i.synced).length;
      const totalPending = pendingMovs + pendingInvs;

      if (totalPending > 0) {
        addLog(`Modo Offline: ${totalPending} coletas salvas no smartphone prontas para sincronizar. Desative o modo offline para enviá-las.`, 'warning', currentUser?.username || 'Sistema');
      } else {
        addLog('Modo Offline: Banco de dados local em dia. Nenhuma coleta pendente.', 'info', currentUser?.username || 'Sistema');
      }
      
      setTimeout(() => {
        setIsSyncing(false);
        playBeep('success');
      }, 800);
      return;
    }

    try {
      // 1. Sync pending system logs to Supabase
      const unsyncedLogs = logs.filter((l) => l.id !== 'log_init');
      if (unsyncedLogs.length > 0) {
        const { error: logErr } = await supabase
          .from('system_logs')
          .upsert(
            unsyncedLogs.map(l => ({
              id: l.id,
              timestamp: l.timestamp,
              message: l.message,
              type: l.type,
              user: l.user
            }))
          );
        if (logErr) console.error('Error syncing logs to Supabase:', logErr);
      }

      // 2. Sync pending movements to Supabase
      const unsyncedMovements = movements.filter((m) => !m.synced);
      if (unsyncedMovements.length > 0) {
        const { error: movErr } = await supabase
          .from('movements')
          .upsert(
            unsyncedMovements.map(m => ({
              id: m.id,
              barcode: m.barcode,
              type: m.type,
              quantity: m.quantity,
              origin_location: m.originLocation,
              destination_location: m.destinationLocation,
              date: m.date,
              user: m.user
            }))
          );
        if (movErr) throw movErr;
        
        // Update product stock counts for processed movements
        for (const mov of unsyncedMovements) {
          const change = mov.type === 'Entrada' ? mov.quantity : mov.type === 'Saída' ? -mov.quantity : 0;
          if (change !== 0) {
            const prod = products.find(p => p.barcode === mov.barcode);
            if (prod) {
              const newStock = Math.max(0, prod.stock + change);
              await supabase
                .from('products')
                .update({ stock: newStock })
                .eq('barcode', mov.barcode);
            }
          }
        }
      }

      // 3. Sync pending inventory items to Supabase
      const unsyncedInventory = inventory.filter((i) => !i.synced);
      if (unsyncedInventory.length > 0) {
        const { error: invErr } = await supabase
          .from('inventory')
          .insert(
            unsyncedInventory.map(i => ({
              barcode: i.barcode,
              description: i.description,
              counted_quantity: i.countedQuantity,
              date: i.date,
              user: i.user
            }))
          );
        if (invErr) throw invErr;

        // Sync local count to products stock count on cloud
        for (const inv of unsyncedInventory) {
          await supabase
            .from('products')
            .update({ stock: inv.countedQuantity })
            .eq('barcode', inv.barcode);
        }
      }

      // 4. Fetch the latest products from Supabase
      const { data: remoteProducts, error: prodErr } = await supabase
        .from('products')
        .select('*');
      
      if (prodErr) throw prodErr;

      if (remoteProducts) {
        const parsedProducts: Product[] = remoteProducts.map(p => ({
          barcode: p.barcode,
          description: p.description,
          category: p.category || '',
          application: p.application || '',
          stock: p.stock || 0,
          minStock: p.min_stock || 3
        }));
        setProducts(parsedProducts);
      }

      // 5. Fetch users from Supabase to sync login database
      const { data: remoteUsers, error: userErr } = await supabase
        .from('users')
        .select('*');
      
      if (!userErr && remoteUsers) {
        setUsers(remoteUsers.map(u => ({
          username: u.username,
          name: u.name,
          role: u.role as any,
          email: u.email || ''
        })));
      }

      // Mark all local items as successfully synced
      setMovements((prev) => prev.map((m) => ({ ...m, synced: true })));
      setInventory((prev) => prev.map((i) => ({ ...i, synced: true })));

      addLog(`Supabase sincronizado! Estoques e transações em nuvem atualizados.`, 'success', 'Sistema');
      playBeep('success');
    } catch (err: any) {
      console.error('Supabase sync failed:', err);
      addLog(`Falha na sincronização do Supabase: ${err.message || 'Erro de rede'}. Coletas em contingência local.`, 'error', 'Sistema');
      playBeep('error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Route to Login Screen if not authenticated
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} users={users} onAddUserLocal={handleAddUser} />;
  }

  return (
    <div id="coletor-shell" className="min-h-screen bg-[#f4f7f9] text-slate-800 flex flex-col font-sans select-none antialiased">
      
      {/* CLEAN MINIMALIST HEADER */}
      <header id="coletor-header" className="bg-[#2497DE] text-white px-4 py-3 sticky top-0 z-40 flex items-center justify-between shadow-sm border-b border-[#1d7ebc]">
        
        {/* Profile Operator */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
            {currentUser.avatar ? (
              currentUser.avatar.startsWith('linear-gradient') ? (
                <div 
                  className="w-full h-full text-white flex items-center justify-center font-black text-xs uppercase font-mono shadow-inner"
                  style={{ background: currentUser.avatar }}
                >
                  {currentUser.name ? currentUser.name.substring(0, 2) : 'OP'}
                </div>
              ) : (
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
              )
            ) : (
              <UserCheck className="text-white" size={16} />
            )}
          </div>
          <div className="leading-tight truncate max-w-[140px]">
            <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
            <div className="text-[9px] text-white/80 font-bold font-mono tracking-wider uppercase flex items-center gap-1">
              <Shield size={10} className="shrink-0" />
              {currentUser.role}
            </div>
          </div>
        </div>

        {/* Brand center name */}
        <div className="text-center shrink-0 hidden xs:block">
          <span className="text-white font-black font-mono tracking-wider text-xs uppercase">CANINANA</span>
          <span className="text-white/80 font-semibold font-mono text-[9px] block leading-none uppercase">COLETOR</span>
        </div>

        {/* Network status diagnostics & actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          
          {/* Signal Icon indicator */}
          <div className="flex items-center">
            {isSimulatedOffline ? (
              <span id="diagnostic-offline-badge" className="text-amber-300" title="Modo Offline Simulado Ativo">
                <WifiOff size={16} />
              </span>
            ) : isOnline ? (
              <span id="diagnostic-online-badge" className="text-emerald-300" title="Rede conectada com sucesso">
                <Wifi size={16} />
              </span>
            ) : (
              <span id="diagnostic-no-connection-badge" className="text-rose-300" title="Sem conexão de internet física">
                <WifiOff size={16} />
              </span>
            )}
          </div>

          {/* Sync status indicator action */}
          <button
            id="header-quick-sync"
            onClick={syncDataWithGoogleSheets}
            disabled={isSyncing}
            className={`w-8 h-8 rounded-lg border border-white/20 bg-white/10 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/20 cursor-pointer active:scale-95 transition ${
              isSyncing ? 'animate-spin border-white' : ''
            }`}
            title="Sincronizar com Planilha Google"
          >
            <CloudLightning size={14} />
          </button>

          {/* Logout button */}
          <button
            id="logout-coletor-btn"
            onClick={handleLogout}
            className="w-8 h-8 rounded-lg border border-white/20 bg-white/10 hover:bg-red-600/30 flex items-center justify-center text-red-100 hover:text-white active:scale-95 transition cursor-pointer"
            title="Sair do coletor"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* CORE VIEWPORT CANVAS RENDERING */}
      <main id="coletor-content-canvas" className="flex-1 overflow-y-auto">
        {activeTab === 'Dashboard' && (
          <DashboardTab
            products={products}
            movements={movements}
            inventory={inventory}
            logs={logs}
            user={currentUser}
            getApiUrl={getApiUrl}
          />
        )}

        {activeTab === 'Scanner' && (
          <ScannerTab
            products={products}
            onAddProduct={handleAddProduct}
            onAddMovement={handleAddMovement}
            onAddInventoryItem={handleAddInventoryItem}
            user={currentUser}
            onCustomScan={handleCustomScan}
            getApiUrl={getApiUrl}
          />
        )}

        {activeTab === 'Consulta' && (
          <QueryTab
            products={products}
            user={currentUser}
          />
        )}

        {activeTab === 'Perfil' && (
          <ProfileTab
            currentUser={currentUser}
            users={users}
            onUpdateProfile={handleUpdateProfile}
            onUpdateAnyUser={handleUpdateAnyUser}
            onAddUser={handleAddUser}
          />
        )}

        {activeTab === 'Config' && (
          <ConfigTab
            gasUrl={gasUrl}
            setGasUrl={setGasUrl}
            backendUrl={backendUrl}
            setBackendUrl={setBackendUrl}
            isOnline={isOnline}
            products={products}
            movements={movements}
            inventory={inventory}
            logs={logs}
            user={currentUser}
            onClearDatabase={handleClearDatabase}
            onSync={syncDataWithGoogleSheets}
            onFetchSheets={() => fetchDataFromGoogleSheets(true)}
            isSyncing={isSyncing}
          />
        )}
      </main>

      {/* MINIMALIST FOOTER NAV RAIL - Raised with pb-6 to prevent clashing with Android/iOS gesture & navigation bar */}
      <nav id="coletor-bottom-nav" className="bg-white border-t border-slate-200 grid grid-cols-5 gap-1 pt-1.5 pb-6 px-3 fixed bottom-0 left-0 w-full z-40 shadow-md pb-[safe-area-inset-bottom]">
        {[
          { id: 'Dashboard', icon: LayoutDashboard, label: 'Painel' },
          { id: 'Scanner', icon: Scan, label: 'Saída' },
          { id: 'Consulta', icon: Search, label: 'Consulta' },
          { id: 'Perfil', icon: UserIcon, label: 'Perfil' },
          { id: 'Config', icon: Settings, label: 'Sinc.' }
        ].map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;
          
          // Disable scanner & stats settings block for Consultation role if needed,
          // but we let them view all views, scanner just blocks saving, and configs are read only.
          const isBlocked = currentUser.role === 'Consulta' && tab.id === 'Scanner';

          return (
            <button
              key={tab.id}
              id={`nav-tab-btn-${tab.id.toLowerCase()}`}
              onClick={() => {
                if (isBlocked) {
                  playBeep('error');
                  alert('Acesso negado: Perfil de Consulta não possui permissão de Coleta (Leitura).');
                  return;
                }
                setActiveTab(tab.id as any);
              }}
              className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition cursor-pointer relative active:bg-slate-50 ${
                isActive 
                  ? 'text-[#2497DE]' 
                  : isBlocked 
                    ? 'text-slate-300 cursor-not-allowed opacity-40' 
                    : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {/* Active neon line indicator */}
              {isActive && (
                <span className="absolute top-0 w-6 h-1 bg-[#2497DE] rounded-full"></span>
              )}
              
              <IconComponent size={18} className={isActive ? 'scale-115 transition-transform' : ''} />
              <span className="text-[9px] font-bold uppercase tracking-wider font-mono mt-1 leading-none">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
