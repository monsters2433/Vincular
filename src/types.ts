// Tipos compartidos para la integración Finanzas-Homelab

export interface Transaction {
  id: number;
  date: string;
  category: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  tags?: string[];
}

export interface Budget {
  id: number;
  category: string;
  limit: number;
  spent: number;
  month: string;
  remaining: number;
}

export interface Salary {
  id: number;
  date: string;
  amount: number;
  notes?: string;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  budgetUsage: number;
  lastUpdated: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface FinanzasConfig {
  apiUrl: string;
  apiToken: string;
  timeout?: number;
  retries?: number;
}
