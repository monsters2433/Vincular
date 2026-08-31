/**
 * Ejemplo básico de uso del cliente Vincular
 * Consulta datos financieros de forma segura desde homelab
 */

import { FinanzasClient } from '../src/client.js';

// Configuración
const finanzas = new FinanzasClient({
  apiUrl: process.env.FINANZAS_API_URL || 'https://finanzas.example.com',
  apiToken: process.env.FINANZAS_API_TOKEN || 'sk_live_demo_token',
  timeout: 5000,
  retries: 3
});

async function main() {
  try {
    console.log('📊 Consultando datos financieros...\n');

    // 1. Obtener resumen financiero
    console.log('1️⃣ Resumen General');
    const summary = await finanzas.getSummary();
    console.log(`   Ingresos totales: $${summary.totalIncome}`);
    console.log(`   Gastos totales: $${summary.totalExpenses}`);
    console.log(`   Balance: $${summary.balance}`);
    console.log(`   Uso de presupuesto: ${(summary.budgetUsage * 100).toFixed(1)}%\n`);

    // 2. Obtener transacciones recientes
    console.log('2️⃣ Transacciones Recientes');
    const transactions = await finanzas.getTransactions({
      limit: 5,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });

    transactions.forEach(tx => {
      const icon = tx.type === 'income' ? '📈' : '📉';
      const amount = `$${tx.amount}`;
      console.log(`   ${icon} [${tx.date}] ${tx.category}: ${tx.description} (${amount})`);
    });
    console.log();

    // 3. Obtener presupuestos actuales
    console.log('3️⃣ Estado de Presupuestos');
    const budgets = await finanzas.getBudgets();

    budgets.forEach(budget => {
      const percentage = (budget.spent / budget.limit) * 100;
      const status = percentage > 90 ? '🔴' : percentage > 70 ? '🟡' : '🟢';
      console.log(`   ${status} ${budget.category}: $${budget.spent}/$${budget.limit} (${percentage.toFixed(0)}%)`);
    });
    console.log();

    // 4. Obtener historial de salarios
    console.log('4️⃣ Últimos Salarios');
    const salaries = await finanzas.getSalaries();

    salaries.slice(-3).forEach(salary => {
      console.log(`   💰 [${salary.date}] $${salary.amount} ${salary.notes ? `- ${salary.notes}` : ''}`);
    });
    console.log();

    // 5. Generar alerta si presupuesto está alto
    console.log('5️⃣ Verificación de Alertas');
    const highBudgetCategories = budgets.filter(b => (b.spent / b.limit) > 0.9);
    if (highBudgetCategories.length > 0) {
      console.log('   ⚠️  Presupuestos cercanos al límite:');
      highBudgetCategories.forEach(b => {
        const remaining = b.limit - b.spent;
        console.log(`      • ${b.category}: Solo $${remaining} restantes`);
      });
    } else {
      console.log('   ✅ Todos los presupuestos están bajo control');
    }

  } catch (error) {
    console.error('❌ Error al consultar datos:', error);
    process.exit(1);
  }
}

main();
