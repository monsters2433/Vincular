# Vincular - Integración Finanzas + Homelab

Proyecto que establece la comunicación entre el **Gestor de Finanzas** y la **Infraestructura Homelab**.

## 🎯 Objetivo

Proporcionar una API de lectura segura desde Finanzas que permita al homelab:
- Consultar transacciones y presupuestos
- Obtener resúmenes financieros
- Integrar datos financieros en dashboards del homelab
- Disparar automatizaciones basadas en estado financiero

## 📚 Estructura

```
vincular/
├── src/
│   ├── types.ts           # Tipos TypeScript compartidos
│   ├── client.ts          # SDK cliente para Finanzas API
│   └── index.ts           # Exports
├── docs/
│   ├── API.md             # Especificación de API
│   ├── SETUP.md           # Guía de configuración
│   └── INTEGRATION.md     # Guía de integración con homelab
└── package.json
```

## 🚀 Uso Rápido

### Cliente SDK

```typescript
import { FinanzasClient } from 'vincular';

const finanzas = new FinanzasClient({
  apiUrl: 'https://finanzas.example.com',
  apiToken: 'tu-token-api-aqui'
});

// Obtener transacciones
const transactions = await finanzas.getTransactions({
  startDate: '2026-01-01',
  endDate: '2026-08-31'
});

// Obtener resumen
const summary = await finanzas.getSummary();
console.log(`Balance: ${summary.balance}`);
```

## 🔐 Seguridad

- Autenticación con Bearer Token
- Solo endpoints de lectura
- CORS configurado en Finanzas
- Reintentos automáticos con backoff exponencial
- Timeout de conexión configurables

## 📝 Próximos Pasos

1. Implementar endpoints API en Finanzas
2. Crear cliente Docker para homelab
3. Configurar sincronización periódica
4. Integración con n8n workflows
5. Dashboard en Kubernetes/Portainer
