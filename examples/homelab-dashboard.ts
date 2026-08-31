/**
 * Ejemplo: Sincronizar datos financieros para dashboard de homelab
 * Guarda datos en JSON para ser consumidos por aplicaciones web
 */

import { FinanzasClient } from '../src/client.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const finanzas = new FinanzasClient({
  apiUrl: process.env.FINANZAS_API_URL!,
  apiToken: process.env.FINANZAS_API_TOKEN!
});

interface DashboardData {
  summary: any;
  transactions: any[];
  budgets: any[];
  salaries: any[];
  alerts: string[];
  syncedAt: string;
  nextSync: string;
}

async function generateDashboardData(): Promise<DashboardData> {
  const summary = await finanzas.getSummary();
  const transactions = await finanzas.getTransactions({ limit: 20 });
  const budgets = await finanzas.getBudgets();
  const salaries = await finanzas.getSalaries();

  // Generar alertas
  const alerts: string[] = [];

  // Alerta de presupuesto alto
  budgets.forEach(budget => {
    const usage = budget.spent / budget.limit;
    if (usage > 0.9) {
      alerts.push(`${budget.category} utilizado al ${(usage * 100).toFixed(0)}%`);
    }
  });

  // Alerta de gasto alto este mes
  const thisMonth = new Date();
  const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1)
    .toISOString()
    .split('T')[0];

  const monthExpenses = transactions
    .filter(t => t.type === 'expense' && t.date >= monthStart)
    .reduce((sum, t) => sum + t.amount, 0);

  const averageMonthly = summary.totalExpenses / 12; // Aproximado
  if (monthExpenses > averageMonthly * 1.2) {
    alerts.push(`Gasto mensual ${((monthExpenses / averageMonthly - 1) * 100).toFixed(0)}% arriba del promedio`);
  }

  const now = new Date();
  const nextSync = new Date(now.getTime() + 60 * 60 * 1000); // Próximo sync en 1 hora

  return {
    summary,
    transactions,
    budgets,
    salaries,
    alerts,
    syncedAt: now.toISOString(),
    nextSync: nextSync.toISOString()
  };
}

async function main() {
  try {
    console.log('🔄 Generando datos para dashboard...');

    const data = await generateDashboardData();

    // Crear directorio si no existe
    const dataDir = process.env.DATA_PATH || '/data/finanzas';
    mkdirSync(dataDir, { recursive: true });

    // Guardar datos
    const outputPath = join(dataDir, 'dashboard.json');
    writeFileSync(outputPath, JSON.stringify(data, null, 2));

    console.log(`✅ Datos guardados en: ${outputPath}`);
    console.log(`📊 Resumen:`);
    console.log(`   Balance: $${data.summary.balance}`);
    console.log(`   Transacciones: ${data.transactions.length}`);
    console.log(`   Presupuestos: ${data.budgets.length}`);
    console.log(`   Alertas: ${data.alerts.length}`);

    if (data.alerts.length > 0) {
      console.log(`\n⚠️  Alertas:`);
      data.alerts.forEach(alert => console.log(`   • ${alert}`));
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Ejecutar una vez al iniciar, luego cada hora
main();
setInterval(main, 60 * 60 * 1000);
