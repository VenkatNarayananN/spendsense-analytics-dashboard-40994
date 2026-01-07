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
      },
    },
  },
  apis: ['./src/routes/**/*.js'], // Path to the API docs
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
