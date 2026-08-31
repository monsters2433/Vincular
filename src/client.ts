import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  Transaction,
  Budget,
  Salary,
  FinancialSummary,
  ApiResponse,
  FinanzasConfig
} from './types.js';

export class FinanzasClient {
  private client: AxiosInstance;
  private config: Required<FinanzasConfig>;

  constructor(config: FinanzasConfig) {
    this.config = {
      timeout: 5000,
      retries: 3,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async getTransactions(filters?: {
    startDate?: string;
    endDate?: string;
    category?: string;
    limit?: number;
  }): Promise<Transaction[]> {
    return this.withRetry(() =>
      this.client.get<ApiResponse<Transaction[]>>('/api/transactions', { params: filters })
        .then(res => res.data.data || [])
    );
  }

  async getTransaction(id: number): Promise<Transaction | null> {
    return this.withRetry(() =>
      this.client.get<ApiResponse<Transaction>>(`/api/transactions/${id}`)
        .then(res => res.data.data || null)
    );
  }

  async getBudgets(month?: string): Promise<Budget[]> {
    return this.withRetry(() =>
      this.client.get<ApiResponse<Budget[]>>('/api/budgets', { params: { month } })
        .then(res => res.data.data || [])
    );
  }

  async getSalaries(year?: number): Promise<Salary[]> {
    return this.withRetry(() =>
      this.client.get<ApiResponse<Salary[]>>('/api/salaries', { params: { year } })
        .then(res => res.data.data || [])
    );
  }

  async getSummary(): Promise<FinancialSummary> {
    return this.withRetry(() =>
      this.client.get<ApiResponse<FinancialSummary>>('/api/summary')
        .then(res => res.data.data || {
          totalIncome: 0,
          totalExpenses: 0,
          balance: 0,
          budgetUsage: 0,
          lastUpdated: new Date().toISOString()
        })
    );
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (attempt < this.config.retries && this.isRetryable(error)) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.withRetry(fn, attempt + 1);
      }
      throw error;
    }
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof AxiosError) {
      return !error.response || error.response.status >= 500;
    }
    return true;
  }
}

export { FinanzasConfig } from './types.js';
