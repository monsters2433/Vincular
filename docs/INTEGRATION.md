# Guía de Integración - Homelab

## Requisitos

- Docker o Kubernetes
- Token API de Finanzas
- URL accesible de Finanzas desde el homelab

## Opción 1: Contenedor Docker

### 1. Crear un cliente Node.js

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json .
RUN npm install

COPY src/ src/
COPY tsconfig.json .

CMD ["node", "--loader=tsx", "src/sync.ts"]
```

### 2. Script de Sincronización

```typescript
// src/sync.ts
import { FinanzasClient } from 'vincular';
import { writeFileSync } from 'fs';

const client = new FinanzasClient({
  apiUrl: process.env.FINANZAS_API_URL!,
  apiToken: process.env.FINANZAS_API_TOKEN!
});

async function syncData() {
  try {
    const summary = await client.getSummary();
    const transactions = await client.getTransactions({ limit: 50 });
    const budgets = await client.getBudgets();

    const data = {
      summary,
      transactions,
      budgets,
      syncedAt: new Date().toISOString()
    };

    writeFileSync('/data/finanzas-sync.json', JSON.stringify(data, null, 2));
    console.log('✓ Datos sincronizados exitosamente');
  } catch (error) {
    console.error('✗ Error en sincronización:', error);
    process.exit(1);
  }
}

// Ejecutar cada hora
setInterval(syncData, 60 * 60 * 1000);
syncData();
```

### 3. Docker Compose

```yaml
version: '3.8'

services:
  finanzas-sync:
    build: .
    environment:
      FINANZAS_API_URL: ${FINANZAS_API_URL}
      FINANZAS_API_TOKEN: ${FINANZAS_API_TOKEN}
    volumes:
      - finanzas-data:/data
    restart: always

volumes:
  finanzas-data:
```

## Opción 2: CronJob en Kubernetes

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: finanzas-sync
  namespace: default
spec:
  schedule: "0 * * * *"  # Cada hora
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: sync
            image: node:20-alpine
            env:
            - name: FINANZAS_API_URL
              valueFrom:
                secretKeyRef:
                  name: finanzas-config
                  key: api-url
            - name: FINANZAS_API_TOKEN
              valueFrom:
                secretKeyRef:
                  name: finanzas-config
                  key: api-token
            command:
            - node
            - --loader=tsx
            - sync.ts
          restartPolicy: OnFailure
```

## Opción 3: n8n Workflow

### Trigger: Cron (cada 30 minutos)

```json
{
  "nodes": [
    {
      "name": "Cron",
      "type": "n8n-nodes-base.cron",
      "position": [250, 300],
      "parameters": {
        "cronExpression": "*/30 * * * *"
      }
    },
    {
      "name": "HTTP Request",
      "type": "n8n-nodes-base.httpRequest",
      "position": [450, 300],
      "parameters": {
        "method": "GET",
        "url": "={{ $env.FINANZAS_API_URL }}/api/summary",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "httpCustomAuth",
        "options": {
          "headers": {
            "Authorization": "Bearer {{ $env.FINANZAS_API_TOKEN }}"
          }
        }
      }
    },
    {
      "name": "Save to Database",
      "type": "n8n-nodes-base.postgres",
      "position": [650, 300],
      "parameters": {
        "operation": "insert",
        "table": "finanzas_summary",
        "columns": "timestamp,total_income,total_expenses,balance"
      }
    }
  ]
}
```

## Variables de Entorno

```bash
# .env en homelab
FINANZAS_API_URL=https://finanzas.example.com
FINANZAS_API_TOKEN=sk_live_xxxxxxxxxxxxxxxxxxxx
SYNC_INTERVAL=3600  # segundos
DATA_PATH=/data/finanzas
```

## Monitoreo

### Verificar sincronización

```bash
docker exec finanzas-sync cat /data/finanzas-sync.json | jq '.summary'
```

### Logs

```bash
docker logs -f finanzas-sync
```

### Alertas

Configurar en homelab para alertar si:
- Última sincronización > 2 horas
- Balance < X cantidad
- Uso de presupuesto > 90%

## Seguridad

1. Usar secretos para almacenar tokens
2. Limitar acceso a archivos sincronizados
3. HTTPS obligatorio para conexiones
4. Rotación de tokens cada 3 meses
5. Auditar accesos a la API
