const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'My Express API',
      version: '1.0.0',
      description: 'A simple Express API documented with Swagger',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Supabase session access token. Send as: Authorization: Bearer <access_token>',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string', example: 'EXTERNAL_API_ERROR' },
                message: { type: 'string', example: 'Unable to fetch exchange rates right now. Please try again later.' },
                details: { description: 'Optional safe details (non-secret).', nullable: true },
                cause: { description: 'Optional sanitized cause (non-secret).', nullable: true },
              },
            },
          },
        },

        User: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', example: '00000000-0000-0000-0000-000000000000' },
            name: { type: 'string', nullable: true, example: 'Alex Chen' },
            avatar_url: { type: 'string', nullable: true, example: 'https://example.com/avatar.png' },
            created_at: { type: 'string', format: 'date-time', nullable: true },
            updated_at: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        UserUpdate: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'Alex Chen' },
            avatar_url: { type: 'string', example: 'https://example.com/avatar.png' },
          },
        },

        Transaction: {
          type: 'object',
          required: ['id', 'user_id', 'amount', 'currency', 'category', 'merchant', 'occurred_at'],
          properties: {
            id: { type: 'string', example: '1' },
            user_id: { type: 'string', example: '00000000-0000-0000-0000-000000000000' },
            amount: { type: 'number', example: 24.5 },
            currency: { type: 'string', example: 'USD' },
            category: { type: 'string', example: 'Groceries' },
            merchant: { type: 'string', example: 'Target' },
            description: { type: 'string', nullable: true, example: 'Weekly groceries' },
            occurred_at: { type: 'string', format: 'date-time' },
            created_at: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        TransactionCreate: {
          type: 'object',
          required: ['amount', 'currency', 'category', 'merchant', 'occurred_at'],
          properties: {
            amount: { type: 'number', example: 24.5 },
            currency: { type: 'string', example: 'USD' },
            category: { type: 'string', example: 'Groceries' },
            merchant: { type: 'string', example: 'Target' },
            description: { type: 'string', example: 'Weekly groceries' },
            occurred_at: { type: 'string', format: 'date-time', example: '2025-01-15T12:00:00Z' },
          },
        },

        Alert: {
          type: 'object',
          required: ['id', 'user_id', 'type', 'message', 'status'],
          properties: {
            id: { type: 'string', example: '1' },
            user_id: { type: 'string', example: '00000000-0000-0000-0000-000000000000' },
            type: { type: 'string', example: 'budget' },
            message: { type: 'string', example: 'You are nearing your monthly budget.' },
            status: { type: 'string', example: 'active' },
            created_at: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        AlertCreate: {
          type: 'object',
          required: ['type', 'message'],
          properties: {
            type: { type: 'string', example: 'budget' },
            message: { type: 'string', example: 'You are nearing your monthly budget.' },
            status: { type: 'string', example: 'active' },
          },
        },

        AnalyticsSummary: {
          type: 'object',
          required: ['total_spend', 'average_daily_spend', 'top_categories', 'recent_merchants', 'range'],
          properties: {
            total_spend: { type: 'number', example: 1234.56 },
            average_daily_spend: { type: 'number', example: 45.67 },
            top_categories: {
              type: 'array',
              items: {
                type: 'object',
                required: ['category', 'total'],
                properties: {
                  category: { type: 'string', example: 'Groceries' },
                  total: { type: 'number', example: 456.78 },
                },
              },
            },
            recent_merchants: { type: 'array', items: { type: 'string' }, example: ['Target', 'Amazon'] },
            range: {
              type: 'object',
              required: ['from', 'to'],
              properties: {
                from: { type: 'string', nullable: true, example: '2025-01-01' },
                to: { type: 'string', nullable: true, example: '2025-01-31' },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/**/*.js'], // Path to the API docs
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
