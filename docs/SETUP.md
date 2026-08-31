# Guía de Setup - Vincular

## Requisitos Previos

1. **En Finanzas**: Crear endpoints API de lectura
2. **Token API**: Generar token seguro
3. **CORS**: Configurar en Finanzas para permitir homelab

## Paso 1: Implementar API en Finanzas

### Crear archivo de routes API

```typescript
// src/app/api/readonly/route.ts
export const GET = async (req: Request) => {
  // Verificar token
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!validateToken(token)) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Retornar datos de lectura
  return Response.json({ success: true, data: [] });
};
```

### Endpoints Necesarios

- `GET /api/transactions` - Lista transacciones
- `GET /api/transactions/:id` - Transacción específica
- `GET /api/budgets` - Presupuestos del mes
- `GET /api/salaries` - Historial de salarios
- `GET /api/summary` - Resumen financiero

### CORS Configuration

```typescript
// next.config.ts
export default {
  headers: async () => [
    {
      source: '/api/:path*',
      headers: [
        {
          key: 'Access-Control-Allow-Origin',
          value: 'https://homelab.example.com'
        },
        {
          key: 'Access-Control-Allow-Methods',
          value: 'GET, OPTIONS'
        },
        {
          key: 'Access-Control-Allow-Headers',
          value: 'Authorization, Content-Type'
        }
      ]
    }
  ]
};
```

## Paso 2: Generar API Token

### Crear función hash para tokens

```typescript
// utils/api-keys.ts
import crypto from 'crypto';

export function generateApiKey(): string {
  const prefix = 'sk_live_';
  const random = crypto.randomBytes(24).toString('hex');
  return prefix + random;
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}
```

### Almacenar en base de datos

```sql
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY,
  hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used DATETIME,
  is_active BOOLEAN DEFAULT 1
);
```

## Paso 3: Configurar Vincular

### 1. Instalar dependencias

```bash
cd /home/user/Vincular
npm install
```

### 2. Crear archivo .env

```env
FINANZAS_API_URL=https://finanzas.example.com
FINANZAS_API_TOKEN=sk_live_xxxxxxxxxxxxxxxxxxxx
NODE_ENV=production
```

### 3. Compilar TypeScript

```bash
npm run build
```

### 4. Verificar compilación

```bash
ls -la dist/
```

## Paso 4: Probar Conexión

### Script de prueba

```bash
cat > test-connection.ts << 'EOF'
import { FinanzasClient } from './src/client.js';

const client = new FinanzasClient({
  apiUrl: process.env.FINANZAS_API_URL!,
  apiToken: process.env.FINANZAS_API_TOKEN!
});

try {
  const summary = await client.getSummary();
  console.log('✓ Conexión exitosa!');
  console.log('Balance:', summary.balance);
} catch (error) {
  console.error('✗ Error de conexión:', error);
  process.exit(1);
}
EOF

node --loader=tsx test-connection.ts
```

## Paso 5: Integración en Homelab

### Opción Docker

```bash
docker run -e FINANZAS_API_URL=https://finanzas.example.com \
  -e FINANZAS_API_TOKEN=sk_live_... \
  -v finanzas-data:/data \
  vincular:latest
```

### Opción npm Package

Publicar en npm o como monorepo:

```bash
npm publish
```

Usar en homelab:

```typescript
import { FinanzasClient } from 'vincular';

const client = new FinanzasClient({
  apiUrl: process.env.FINANZAS_API_URL,
  apiToken: process.env.FINANZAS_API_TOKEN
});
```

## Verificación de Seguridad

- [ ] HTTPS en ambas aplicaciones
- [ ] Token almacenado en secretos, no en código
- [ ] CORS limitado a dominios específicos
- [ ] Rate limiting configurado
- [ ] Logs de acceso a API
- [ ] Rotación de tokens cada 90 días
- [ ] Auditoría de cambios en endpoints

## Troubleshooting

### Error 401 - No autenticado
- Verificar token en `.env`
- Validar que el token esté activo en Finanzas
- Revisar headers de autorización

### Error 403 - Prohibido
- Verificar CORS configuration
- Comprobar que la URL de homelab está en whitelist

### Timeout
- Aumentar `timeout` en config (default: 5000ms)
- Verificar conectividad de red
- Revisar logs de Finanzas

### Rate Limit
- Reducir frecuencia de syncs
- Contactar admin de Finanzas para aumentar límite

## Referencias

- [API Specification](./API.md)
- [Integration Guide](./INTEGRATION.md)
- [Client Source](../src/client.ts)
