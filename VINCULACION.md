# 🔗 Guía Completa de Vinculación

## Paso 1️⃣: Agregar Endpoints en Finanzas (15 min)

### 1.1 Copiar este archivo en Finanzas

**Archivo:** `src/lib/api-keys.ts`

```typescript
import crypto from 'crypto';
import { getDb } from './db';

export function generateApiKey(): string {
  const prefix = 'sk_live_';
  const random = crypto.randomBytes(24).toString('hex');
  return prefix + random;
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function verifyApiKey(key: string): Promise<boolean> {
  const db = getDb();
  const hash = hashApiKey(key);
  
  const row = db.prepare(`
    SELECT id FROM api_keys 
    WHERE hash = ? AND is_active = 1
    LIMIT 1
  `).get(hash) as any;

  if (row) {
    // Actualizar last_used
    db.prepare('UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?')
      .run(row.id);
    return true;
  }

  return false;
}
```

### 1.2 Crear middleware de autenticación

**Archivo:** `src/middleware/api-auth.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-keys';

export async function withApiAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Missing Bearer token' },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);
  const isValid = await verifyApiKey(token);

  if (!isValid) {
    return NextResponse.json(
      { success: false, error: 'Invalid token' },
      { status: 401 }
    );
  }

  return null; // OK
}
```

### 1.3 Crear endpoint: GET /api/transactions

**Archivo:** `src/app/api/transactions/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/middleware/api-auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  // Verificar autenticación
  const authError = await withApiAuth(req);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);

    const db = getDb();
    let query = 'SELECT * FROM transactions WHERE 1=1';
    const params: any[] = [];

    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date DESC LIMIT ?';
    params.push(limit);

    const transactions = db.prepare(query).all(...params);

    return NextResponse.json({
      success: true,
      data: transactions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    }
  });
}
```

### 1.4 Crear endpoint: GET /api/budgets

**Archivo:** `src/app/api/budgets/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/middleware/api-auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const authError = await withApiAuth(req);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') || 
      new Date().toISOString().slice(0, 7);

    const db = getDb();
    const budgets = db.prepare(`
      SELECT 
        id, category, limit, month,
        (SELECT COALESCE(SUM(amount), 0) 
         FROM transactions 
         WHERE category = budgets.category 
         AND DATE(date) >= DATE(month || '-01')
         AND type = 'expense') as spent
      FROM budgets
      WHERE month = ?
      ORDER BY category
    `).all(month) as any[];

    const enriched = budgets.map(b => ({
      ...b,
      remaining: b.limit - b.spent
    }));

    return NextResponse.json({
      success: true,
      data: enriched,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 1.5 Crear endpoint: GET /api/summary

**Archivo:** `src/app/api/summary/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/middleware/api-auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const authError = await withApiAuth(req);
  if (authError) return authError;

  try {
    const db = getDb();

    const income = db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = "income"'
    ).get() as any;

    const expenses = db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = "expense"'
    ).get() as any;

    const budget = db.prepare(`
      SELECT 
        COALESCE(SUM(limit), 0) as total_limit,
        COALESCE(SUM(spent), 0) as total_spent
      FROM (
        SELECT 
          id, category, limit, month,
          (SELECT COALESCE(SUM(amount), 0) 
           FROM transactions 
           WHERE category = budgets.category 
           AND type = 'expense') as spent
        FROM budgets
        WHERE month = ?
      )
    `, [new Date().toISOString().slice(0, 7)]).get() as any;

    const totalIncome = income.total || 0;
    const totalExpenses = expenses.total || 0;
    const balance = totalIncome - totalExpenses;
    const budgetUsage = budget.total_limit > 0 
      ? budget.total_spent / budget.total_limit 
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        balance,
        budgetUsage: Math.min(budgetUsage, 1),
        lastUpdated: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 1.6 Crear tabla de API Keys en Finanzas

Ejecuta esto en tu BD:

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used DATETIME,
  is_active BOOLEAN DEFAULT 1
);

CREATE INDEX idx_api_keys_hash ON api_keys(hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
```

### 1.7 Generar API Token

Copia este script y ejecútalo **una sola vez**:

```bash
# gen-token.mjs
import crypto from 'crypto';
import Database from 'better-sqlite3';

const db = new Database('db.sqlite');

const prefix = 'sk_live_';
const random = crypto.randomBytes(24).toString('hex');
const apiKey = prefix + random;
const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

db.prepare(`
  INSERT INTO api_keys (name, hash, is_active)
  VALUES (?, ?, 1)
`).run('homelab', hash);

console.log('\n✅ Token generado:\n');
console.log(apiKey);
console.log('\n⚠️  Guárdalo en un lugar seguro (no lo compartas)\n');

db.close();
```

Ejecuta:
```bash
node gen-token.mjs
```

Verás algo como:
```
✅ Token generado:

sk_live_YOUR_GENERATED_TOKEN_HERE_32_CHARS

⚠️  Guárdalo en un lugar seguro (no lo compartas)
```

### 1.8 Probar los endpoints

```bash
# Reemplaza con tu token generado
TOKEN="sk_live_YOUR_GENERATED_TOKEN_HERE_32_CHARS"

# Probar transacciones
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/transactions

# Probar presupuestos
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/budgets

# Probar resumen
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/summary
```

Deberías ver JSON con tus datos financieros.

---

## Paso 2️⃣: Configurar Variables de Entorno

### En Finanzas (.env.local)

```bash
# Finanzas puede ser accedida desde cualquier lugar con HTTPS
# (o especifica solo homelab.example.com si quieres más seguridad)
```

### En Homelab (.env.local)

```bash
FINANZAS_API_URL=http://localhost:3000
FINANZAS_API_TOKEN=sk_live_YOUR_TOKEN_GOES_HERE
```

⚠️ **Reemplaza `sk_live_YOUR_TOKEN_GOES_HERE` con tu token generado en el paso 1.7**

---

## Paso 3️⃣: Usar SDK en Homelab

### Opción A: npm install local

En tu homelab, instala Vincular:

```bash
npm install /path/to/Vincular
# o si está en npm
npm install vincular
```

Luego usa:

```typescript
import { FinanzasClient } from 'vincular';

const finanzas = new FinanzasClient({
  apiUrl: process.env.FINANZAS_API_URL,
  apiToken: process.env.FINANZAS_API_TOKEN
});

const summary = await finanzas.getSummary();
console.log('Balance:', summary.balance);
```

### Opción B: Docker Compose

```yaml
# homelab/docker-compose.yml
version: '3.8'

services:
  finanzas-sync:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./vincular:/app
      - finanzas-data:/data
    environment:
      FINANZAS_API_URL: http://finanzas:3000
      FINANZAS_API_TOKEN: ${FINANZAS_API_TOKEN}
    command: npm run dev:sync
    restart: always

  finanzas:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./finanzas:/app
    ports:
      - "3000:3000"
    command: npm run dev
    restart: always

volumes:
  finanzas-data:
```

### Opción C: CronJob en Kubernetes

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: finanzas-sync
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
              value: "https://finanzas.example.com"
            - name: FINANZAS_API_TOKEN
              valueFrom:
                secretKeyRef:
                  name: finanzas-secrets
                  key: api-token
            volumeMounts:
            - name: data
              mountPath: /data
          volumes:
          - name: data
            persistentVolumeClaim:
              claimName: finanzas-data
          restartPolicy: OnFailure
```

---

## Resumen de Vinculación

```
FINANZAS (Next.js)
  ├─ src/lib/api-keys.ts
  ├─ src/middleware/api-auth.ts
  ├─ src/app/api/transactions/route.ts
  ├─ src/app/api/budgets/route.ts
  └─ src/app/api/summary/route.ts
       ↓
       ↓ HTTP GET (Bearer Token)
       ↓
HOMELAB
  ├─ npm install vincular
  ├─ import { FinanzasClient }
  └─ const finanzas = new FinanzasClient({
       apiUrl: FINANZAS_API_URL,
       apiToken: FINANZAS_API_TOKEN
     })
       ↓
DASHBOARD / ALERTS / SYNC
```

---

## ✅ Verificación de Vinculación

- [ ] Tokens creados en Finanzas
- [ ] Endpoints responden 200 con Bearer token
- [ ] Endpoints responden 401 sin token
- [ ] FinanzasClient se conecta correctamente
- [ ] Datos se sincronizan en homelab
- [ ] Alertas se generan correctamente

**¡Listo! Ahora están vinculados 🎉**
