# ✅ Checklist de Implementación en Finanzas

Este archivo contiene un checklist paso a paso para implementar los endpoints API necesarios en el repositorio de Finanzas.

## 📋 Prerrequisitos

- [ ] Tener acceso de escritura a `monsters2433/Finanzas`
- [ ] Node.js 20+ instalado
- [ ] SQLite configurado en Finanzas
- [ ] HTTPS en producción

---

## 🔐 Fase 1: Sistema de Autenticación (CRÍTICO)

### 1.1 Crear tabla de API Keys

```sql
-- scripts/setup-api-keys.sql
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  prefix TEXT DEFAULT 'sk_live_',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  last_used DATETIME,
  is_active BOOLEAN DEFAULT 1,
  rate_limit INTEGER DEFAULT 100,
  period_minutes INTEGER DEFAULT 60
);

CREATE INDEX idx_api_keys_hash ON api_keys(hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
```

**Acciones:**
- [ ] Crear archivo SQL
- [ ] Ejecutar: `npm run scripts setup-api-keys.sql`
- [ ] Verificar tabla creada: `SELECT * FROM api_keys;`

---

### 1.2 Crear utilidades de generación de tokens

```typescript
// src/lib/api-keys.ts
import crypto from 'crypto';

export interface ApiKeyConfig {
  name: string;
  createdBy: string;
  rateLimit?: number;
  periodMinutes?: number;
}

export function generateApiKey(): string {
  const prefix = 'sk_live_';
  const random = crypto.randomBytes(24).toString('hex');
  return prefix + random;
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function createApiKey(
  db: Database,
  config: ApiKeyConfig
): Promise<string> {
  const apiKey = generateApiKey();
  const hash = hashApiKey(apiKey);

  db.prepare(`
    INSERT INTO api_keys (name, hash, created_by, rate_limit, period_minutes)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    config.name,
    hash,
    config.createdBy,
    config.rateLimit || 100,
    config.periodMinutes || 60
  );

  return apiKey;
}

export async function verifyApiKey(
  db: Database,
  key: string
): Promise<boolean> {
  const hash = hashApiKey(key);
  const row = db.prepare(`
    SELECT id, is_active, last_used FROM api_keys
    WHERE hash = ? AND is_active = 1
    LIMIT 1
  `).get(hash) as any;

  if (!row) return false;

  // Actualizar last_used
  db.prepare('UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?')
    .run(row.id);

  return true;
}
```

**Acciones:**
- [ ] Crear archivo `src/lib/api-keys.ts`
- [ ] Importar en `src/lib/index.ts`
- [ ] Crear script de generación: `npm run generate-key -- --name="homelab" --created-by="admin"`

---

## 🔌 Fase 2: Middleware de Autenticación

### 2.1 Crear middleware de verificación

```typescript
// src/middleware-api.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-keys';
import { getDb } from '@/lib/db';

export async function withApiAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid authorization header' },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7); // Remove "Bearer "
  const db = getDb();

  const isValid = await verifyApiKey(db, token);

  if (!isValid) {
    return NextResponse.json(
      { success: false, error: 'Invalid or inactive token' },
      { status: 401 }
    );
  }

  return null; // OK, continuar
}
```

**Acciones:**
- [ ] Crear archivo `src/middleware-api.ts`
- [ ] Añadir al index de exports

---

## 📍 Fase 3: Endpoints API de Lectura

### 3.1 GET /api/transactions

```typescript
// src/app/api/transactions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/middleware-api';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  // Verificar autenticación
  const authError = await withApiAuth(req);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');
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
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY date DESC LIMIT ?';
    params.push(limit);

    const transactions = db.prepare(query).all(...params);

    return NextResponse.json(
      {
        success: true,
        data: transactions,
        timestamp: new Date().toISOString()
      },
      {
        headers: {
          'Access-Control-Allow-Origin': process.env.HOMELAB_URL || '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    );
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.HOMELAB_URL || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    }
  });
}
```

**Acciones:**
- [ ] Crear carpeta `src/app/api/transactions/`
- [ ] Crear archivo `route.ts` con código arriba
- [ ] Probar: `curl -H "Authorization: Bearer sk_live_..." http://localhost:3000/api/transactions`

### 3.2 GET /api/transactions/:id

```typescript
// src/app/api/transactions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/middleware-api';
import { getDb } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await withApiAuth(req);
  if (authError) return authError;

  try {
    const db = getDb();
    const transaction = db.prepare(
      'SELECT * FROM transactions WHERE id = ? LIMIT 1'
    ).get(parseInt(params.id));

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: transaction,
        timestamp: new Date().toISOString()
      },
      {
        headers: {
          'Access-Control-Allow-Origin': process.env.HOMELAB_URL || '*'
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Acciones:**
- [ ] Crear archivo `src/app/api/transactions/[id]/route.ts`
- [ ] Probar: `curl -H "Authorization: Bearer sk_live_..." http://localhost:3000/api/transactions/1`

### 3.3 GET /api/budgets

```typescript
// src/app/api/budgets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/middleware-api';
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
      SELECT id, category, limit, month, 
             (SELECT COALESCE(SUM(amount), 0) 
              FROM transactions 
              WHERE category = budgets.category 
              AND DATE(date) >= DATE(month || '-01')
              AND type = 'expense') as spent
      FROM budgets
      WHERE month = ?
      ORDER BY category
    `).all(month);

    const enriched = (budgets as any[]).map(b => ({
      ...b,
      remaining: b.limit - b.spent
    }));

    return NextResponse.json(
      {
        success: true,
        data: enriched,
        timestamp: new Date().toISOString()
      },
      {
        headers: {
          'Access-Control-Allow-Origin': process.env.HOMELAB_URL || '*'
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Acciones:**
- [ ] Crear archivo `src/app/api/budgets/route.ts`
- [ ] Probar endpoint

### 3.4 GET /api/salaries

**Acciones:**
- [ ] Crear archivo `src/app/api/salaries/route.ts`
- [ ] Implementar similar a budgets

### 3.5 GET /api/summary

**Acciones:**
- [ ] Crear archivo `src/app/api/summary/route.ts`
- [ ] Calcular totales de ingresos/gastos/balance

---

## 🔒 Fase 4: CORS y Seguridad

### 4.1 Configurar CORS en Next.js

```typescript
// next.config.ts
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.HOMELAB_URL || 'http://localhost:3001'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Authorization, Content-Type'
          },
          {
            key: 'Access-Control-Max-Age',
            value: '3600'
          }
        ]
      }
    ];
  }
};
```

**Acciones:**
- [ ] Actualizar `next.config.ts`
- [ ] Establecer `HOMELAB_URL` en .env

### 4.2 Variables de Entorno

```bash
# .env.example
HOMELAB_URL=https://homelab.example.com
API_RATE_LIMIT=100
API_RATE_PERIOD_MINUTES=60
```

**Acciones:**
- [ ] Crear `.env.local` con valores reales
- [ ] NO commitar `.env.local`

---

## ✅ Fase 5: Testing y Validación

### 5.1 Tests de endpoints

```typescript
// __tests__/api.test.ts
describe('API Endpoints', () => {
  const validToken = 'sk_live_...'; // Generar uno para tests

  it('GET /api/transactions sin token debe retornar 401', async () => {
    const res = await fetch('/api/transactions');
    expect(res.status).toBe(401);
  });

  it('GET /api/transactions con token válido retorna datos', async () => {
    const res = await fetch('/api/transactions', {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
```

**Acciones:**
- [ ] Crear archivo de tests
- [ ] Ejecutar: `npm test`
- [ ] Todos los tests en verde ✅

### 5.2 Validación manual

```bash
# Generar token de prueba
npm run scripts generate-key -- --name="test" --created-by="dev"

# Probar endpoints
curl -H "Authorization: Bearer sk_live_xxx" \
  http://localhost:3000/api/transactions

curl -H "Authorization: Bearer sk_live_xxx" \
  http://localhost:3000/api/budgets

curl -H "Authorization: Bearer sk_live_xxx" \
  http://localhost:3000/api/summary
```

**Acciones:**
- [ ] Todos los endpoints responden 200
- [ ] Datos son válidos
- [ ] CORS headers presentes

---

## 🚀 Fase 6: Deployment

### 6.1 Producción

**Acciones:**
- [ ] HTTPS activo
- [ ] Dominio configurado
- [ ] Rate limiting activo
- [ ] Logs en rotación
- [ ] Backups de DB configurados

### 6.2 Comunicación con Homelab

**Acciones:**
- [ ] Compartir URL de API
- [ ] Compartir token de API
- [ ] Confirmar conectividad: ping a `/api/summary`

---

## 📊 Resumen

```
Total de archivos a crear: ~12
Total de líneas de código: ~400
Tiempo estimado: 2-3 horas
Complejidad: Media
```

---

## 🆘 Troubleshooting

### Error: "Table 'api_keys' doesn't exist"
- [ ] Ejecutar script de setup: `npm run setup-db`
- [ ] Verificar que la BD está inicializada

### Error: 401 en todos los endpoints
- [ ] Verificar que el token está siendo generado correctamente
- [ ] Revisar que `verifyApiKey()` está funcionando
- [ ] Comprobar hash del token en BD

### Error: CORS blocked
- [ ] Verificar `HOMELAB_URL` en `.env`
- [ ] Verificar headers en respuesta
- [ ] Revisar `next.config.ts`

---

**Última actualización:** 2026-08-31  
**Estado:** Checklist de referencia  
**Rama:** `claude/finanzas-homelab-integration-4pi1kn`
