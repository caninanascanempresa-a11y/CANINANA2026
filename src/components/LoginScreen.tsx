/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Key, UserCheck, AlertTriangle, UserPlus, ArrowLeft, Mail } from 'lucide-react';
import { User } from '../types';
import { playBeep } from '../utils/audio';
import { supabase } from '../utils/supabaseClient';

interface LoginScreenProps {
  onLogin: (user: User) => void;
  users?: (User & { passwordHash: string })[];
  onAddUserLocal?: (newUser: User & { passwordHash: string }) => void;
}

export default function LoginScreen({ onLogin, users = [], onAddUserLocal }: LoginScreenProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  
  // Login form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Register form states
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<'Administrador' | 'Operador' | 'Consulta'>('Operador');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const typedUser = username.trim().toLowerCase();
    const typedPass = password;

    // 1. First check local users database (or default admin)
    const found = users.find(
      (u) => u.username.toLowerCase() === typedUser && u.passwordHash === typedPass
    );

    if (found) {
      playBeep('success');
      onLogin({
        username: found.username,
        name: found.name,
        role: found.role,
        email: found.email,
        avatar: found.avatar,
      });
      setLoading(false);
      return;
    } else if (typedUser === 'admin' && typedPass === '123') {
      // Default admin access
      playBeep('success');
      onLogin({
        username: 'admin',
        name: 'Administrador Caninana',
        role: 'Administrador',
        email: 'carlos@caninana.com.br',
        avatar: ''
      });
      setLoading(false);
      return;
    }

    // 2. Fallback to Supabase only if online and table exists
    try {
      const { data: remoteUser, error: queryErr } = await supabase
        .from('users')
        .select('*')
        .eq('username', typedUser)
        .single();

      if (!queryErr && remoteUser) {
        if (remoteUser.password_hash === typedPass) {
          playBeep('success');
          onLogin({
            username: remoteUser.username,
            name: remoteUser.name,
            role: remoteUser.role,
            email: remoteUser.email || '',
            avatar: ''
          });
          setLoading(false);
          return;
        } else {
          setError('Senha incorreta.');
          playBeep('error');
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      // Ignore Supabase connection errors
    }

    setError('Usuário não encontrado ou senha incorreta. Use admin / 123 ou crie uma conta.');
    playBeep('error');
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validations
    if (!regName.trim() || !regUsername.trim() || !regPassword) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      playBeep('error');
      setLoading(false);
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('As senhas digitadas não coincidem.');
      playBeep('error');
      setLoading(false);
      return;
    }

    const cleanUsername = regUsername.trim().toLowerCase();

    // Check if username already exists locally
    if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      setError('Este nome de usuário já está cadastrado.');
      playBeep('error');
      setLoading(false);
      return;
    }

    const newUserObject = {
      username: cleanUsername,
      name: regName.trim(),
      role: regRole,
      email: regEmail.trim(),
      avatar: '',
      passwordHash: regPassword
    };

    // 1. Always register user locally first (100% works offline/online)
    if (onAddUserLocal) {
      onAddUserLocal(newUserObject);
    }

    // 2. Try to sync to Supabase in background without blocking the user
    try {
      await supabase
        .from('users')
        .insert({
          username: cleanUsername,
          name: regName.trim(),
          role: regRole,
          email: regEmail.trim() || '',
          password_hash: regPassword
        });
    } catch (supaErr) {
      // Supabase is optional; ignore network/schema failures
    }

    playBeep('success');
    setSuccess('Usuário cadastrado com sucesso! Faça seu login.');
    
    setRegName('');
    setRegUsername('');
    setRegEmail('');
    setRegPassword('');
    setRegConfirmPassword('');
    
    setTimeout(() => {
      setIsRegisterMode(false);
      setSuccess('');
    }, 1200);
  };

  return (
    <div id="login-container" className="min-h-screen bg-[#f4f7f9] flex flex-col items-center justify-center p-4 animate-fade-in">
      <div id="login-card" className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
        {/* Branding decoration */}
        <div className="absolute top-0 left-0 w-full h-1 bg-[#2497DE]"></div>
        
        {/* Header */}
        <div className="text-center mb-6 mt-2">
          <div className="mx-auto w-14 h-14 bg-[#2497DE]/10 border border-[#2497DE]/20 rounded-xl flex items-center justify-center mb-3">
            <span className="text-xl font-black text-[#2497DE] tracking-widest font-mono">CN</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight uppercase">Caninana Coletor</h1>
          <p className="text-slate-400 text-[9px] font-bold font-mono uppercase tracking-wider mt-1">Coletor de Dados Oficial</p>
          <p className="text-[#2497DE] text-[10px] font-bold uppercase tracking-wider mt-0.5">Caninana Auto Vidros</p>
        </div>

        {/* Dynamic Forms */}
        {!isRegisterMode ? (
          /* LOGIN FORM */
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider font-mono">Usuário / Login</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <UserCheck size={15} />
                </span>
                <input
                  id="username-input"
                  type="text"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs focus:border-[#2497DE] focus:bg-white focus:outline-none placeholder-slate-400 transition"
                  placeholder="Seu usuário"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider font-mono">Senha</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Key size={15} />
                </span>
                <input
                  id="password-input"
                  type="password"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs focus:border-[#2497DE] focus:bg-white focus:outline-none placeholder-slate-400 transition"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div id="login-error" className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl text-xs leading-relaxed">
                <AlertTriangle className="shrink-0 mt-0.5 text-red-500" size={15} />
                <span>{error}</span>
              </div>
            )}

            <button
              id="submit-login"
              type="submit"
              disabled={loading}
              className="w-full bg-[#2497DE] hover:bg-[#1d7ebc] text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-sm active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Shield size={14} />
              {loading ? 'Autenticando...' : 'Autenticar Dispositivo'}
            </button>

            <div className="pt-2 border-t border-slate-150">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center mb-2">Entrar rápido (Testes):</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUsername('admin');
                    setPassword('123');
                    setError('');
                  }}
                  className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition"
                >
                  👑 Admin (123)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUsername('operador');
                    setPassword('123');
                    setError('');
                  }}
                  className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition"
                >
                  👷 Operador (123)
                </button>
              </div>

              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.clear();
                    window.location.reload();
                  }}
                  className="text-[10px] text-slate-400 hover:text-red-500 font-mono transition"
                  title="Limpa cache e dados do navegador"
                >
                  🧹 Zerar cache e histórico do navegador
                </button>
              </div>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setIsRegisterMode(true);
                }}
                className="text-xs font-bold text-[#2497DE] hover:text-[#1d7ebc] font-sans flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
              >
                <UserPlus size={14} />
                Não tem conta? Cadastre-se
              </button>
            </div>
          </form>
        ) : (
          /* REGISTRATION FORM */
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setIsRegisterMode(false);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">Criar Novo Cadastro</span>
            </div>

            <div>
              <label className="block text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider font-mono">Nome Completo</label>
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl py-2.5 px-3 text-xs focus:border-[#2497DE] focus:bg-white focus:outline-none placeholder-slate-400 transition"
                placeholder="Ex: Alan Moreira"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider font-mono">Usuário (Login)</label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl py-2.5 px-3 text-xs focus:border-[#2497DE] focus:bg-white focus:outline-none placeholder-slate-400 transition"
                  placeholder="Ex: alan.moreira"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider font-mono">Nível / Perfil</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl py-2.5 px-2 text-xs focus:border-[#2497DE] focus:bg-white focus:outline-none transition"
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as any)}
                >
                  <option value="Operador">Operador (Coleta)</option>
                  <option value="Administrador">Administrador</option>
                  <option value="Consulta">Apenas Consulta</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider font-mono">E-mail (Opcional)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail size={14} />
                </span>
                <input
                  type="email"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs focus:border-[#2497DE] focus:bg-white focus:outline-none placeholder-slate-400 transition"
                  placeholder="Ex: alan@caninana.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider font-mono">Definir Senha</label>
                <input
                  type="password"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl py-2.5 px-3 text-xs focus:border-[#2497DE] focus:bg-white focus:outline-none placeholder-slate-400 transition"
                  placeholder="Senha"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider font-mono">Confirmar Senha</label>
                <input
                  type="password"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl py-2.5 px-3 text-xs focus:border-[#2497DE] focus:bg-white focus:outline-none placeholder-slate-400 transition"
                  placeholder="Repita a senha"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 p-2.5 rounded-xl text-[11px] leading-relaxed">
                <AlertTriangle className="shrink-0 mt-0.5 text-red-500" size={14} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-150 text-green-700 p-2.5 rounded-xl text-[11px] font-semibold text-center animate-pulse">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2497DE] hover:bg-[#1d7ebc] text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-sm active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <UserPlus size={14} />
              {loading ? 'Cadastrando...' : 'Finalizar Cadastro'}
            </button>
          </form>
        )}

        {/* Footer info */}
        <div className="text-center mt-6 text-slate-400 text-[9px] font-mono leading-relaxed uppercase">
          Caninana Auto Vidros Ltda © 2026<br />
          Sistema Offline-First Capable
        </div>
      </div>
    </div>
  );
}
