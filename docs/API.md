# Especificación API - Finanzas

## Base URL
```
https://finanzas.example.com/api
```

## Autenticación

Todos los endpoints requieren autenticación con Bearer Token:

```
Authorization: Bearer YOUR_API_TOKEN
```

## Endpoints de Lectura

### Transacciones

**GET** `/transactions`

Obtiene un listado de transacciones con filtros opcionales.

**Query Parameters:**
- `startDate` (string, ISO 8601): Fecha inicial
- `endDate` (string, ISO 8601): Fecha final
- `category` (string): Categoría de filtro
- `limit` (number): Máximo de resultados (default: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "date": "2026-08-31",
      "category": "Alimentación",
      "description": "Supermercado",
      "amount": 45.50,
      "type": "expense",
      "tags": ["groceries", "food"]
    }
  ],
  "timestamp": "2026-08-31T18:00:00Z"
}
```

**GET** `/transactions/:id`

Obtiene una transacción específica.

**Response:**
```json
{
  "success": true,
  "data": { /* Transaction object */ },
  "timestamp": "2026-08-31T18:00:00Z"
}
```

### Presupuestos

**GET** `/budgets`

Obtiene los presupuestos del mes actual.

**Query Parameters:**
- `month` (string, YYYY-MM): Mes específico

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "category": "Alimentación",
      "limit": 300,
      "spent": 250,
      "month": "2026-08",
      "remaining": 50
    }
  ],
  "timestamp": "2026-08-31T18:00:00Z"
}
```

### Salarios

**GET** `/salaries`

Obtiene el historial de salarios.

**Query Parameters:**
- `year` (number): Año específico

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "date": "2026-08-01",
      "amount": 2500,
      "notes": "Salario agosto"
    }
  ],
  "timestamp": "2026-08-31T18:00:00Z"
}
```

### Resumen

**GET** `/summary`

Obtiene un resumen financiero general.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalIncome": 2500,
    "totalExpenses": 1250,
    "balance": 1250,
    "budgetUsage": 0.83,
    "lastUpdated": "2026-08-31T18:00:00Z"
  },
  "timestamp": "2026-08-31T18:00:00Z"
}
```

## Códigos de Error

- `200`: Éxito
- `400`: Solicitud inválida
- `401`: No autenticado
- `403`: No autorizado
- `404`: No encontrado
- `429`: Demasiadas solicitudes
- `500`: Error del servidor

## Rate Limiting

- Límite: 100 requests por minuto
- Headers de respuesta:
  - `X-RateLimit-Limit`: Límite de requests
  - `X-RateLimit-Remaining`: Requests restantes
  - `X-RateLimit-Reset`: Timestamp de reset
