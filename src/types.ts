/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 'Administrador' | 'Operador' | 'Consulta';

export interface User {
  username: string;
  name: string;
  role: Role;
  email?: string;
  avatar?: string; // base64 representation or URL of the avatar
}

export interface Product {
  barcode: string;
  description: string;
  category: string;
  application: string;
  stock: number;
  minStock: number;
}

export interface Movement {
  id: string;
  barcode: string;
  type: 'Entrada' | 'Saída' | 'Transferência';
  quantity: number;
  originLocation?: string;
  destinationLocation?: string;
  destination?: 'Oficina' | 'Balcão' | 'Mercado Livre' | 'Outros' | string;
  orderNumber?: string;
  requester?: string;
  notes?: string;
  date: string;
  user: string;
  synced: boolean;
}

export interface InventoryItem {
  barcode: string;
  description?: string;
  countedQuantity: number;
  date: string;
  user: string;
  synced: boolean;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  user: string;
}

export interface SyncStatus {
  lastSync?: string;
  pendingMovementsCount: number;
  pendingInventoryCount: number;
  gasUrl: string;
  isOnline: boolean;
}
