/**
 * Minimal Swagger/OpenAPI spec exposed at /api/docs.
 * We hand-write the high-level shape; controllers carry @openapi JSDoc
 * comments for incremental enrichment later via swagger-jsdoc.
 */
import { env } from './env';

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'ETA SaaS API',
    version: '0.1.0',
    description:
      'Smart E-Invoicing & ETA Reader SaaS — Backend API.\n\nAll routes are multi-tenant-scoped via the JWT `companyId` claim.',
  },
  servers: [{ url: env.API_PREFIX }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  paths: {
    '/health': {
      get: { tags: ['System'], summary: 'Health check', responses: { 200: { description: 'OK' } } },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new company + owner user',
        responses: { 201: { description: 'Created' } },
      },
    },
    '/auth/login': {
      post: { tags: ['Auth'], summary: 'Login', responses: { 200: { description: 'OK' } } },
    },
    '/auth/refresh': {
      post: { tags: ['Auth'], summary: 'Refresh access token', responses: { 200: { description: 'OK' } } },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user + company',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/customers': {
      get: { tags: ['Customers'], summary: 'List customers', security: [{ bearerAuth: [] }] },
      post: { tags: ['Customers'], summary: 'Create customer', security: [{ bearerAuth: [] }] },
    },
    '/products': {
      get: { tags: ['Products'], summary: 'List products', security: [{ bearerAuth: [] }] },
      post: { tags: ['Products'], summary: 'Create product', security: [{ bearerAuth: [] }] },
    },
    '/invoices': {
      get: { tags: ['Invoices'], summary: 'List invoices', security: [{ bearerAuth: [] }] },
      post: { tags: ['Invoices'], summary: 'Create invoice', security: [{ bearerAuth: [] }] },
    },
    '/invoices/{id}/submit': {
      post: { tags: ['Invoices'], summary: 'Submit invoice to ETA', security: [{ bearerAuth: [] }] },
    },
    '/invoices/{id}/pdf': {
      get: { tags: ['Invoices'], summary: 'Render invoice as PDF', security: [{ bearerAuth: [] }] },
    },
    '/invoices/export/excel': {
      get: { tags: ['Invoices'], summary: 'Export filtered invoices as Excel', security: [{ bearerAuth: [] }] },
    },
    '/payments': {
      post: { tags: ['Payments'], summary: 'Record payment', security: [{ bearerAuth: [] }] },
    },
    '/eta/status/{uuid}': {
      get: { tags: ['ETA'], summary: 'Fetch ETA status by UUID', security: [{ bearerAuth: [] }] },
    },
    '/eta/logs': {
      get: { tags: ['ETA'], summary: 'List ETA sync logs', security: [{ bearerAuth: [] }] },
    },
    '/eta/retry/{invoiceId}': {
      post: { tags: ['ETA'], summary: 'Retry failed invoice submission', security: [{ bearerAuth: [] }] },
    },
    '/dashboard/metrics': {
      get: { tags: ['Dashboard'], summary: 'Aggregate KPIs', security: [{ bearerAuth: [] }] },
    },
    '/dashboard/revenue-by-month': {
      get: { tags: ['Dashboard'], summary: 'Revenue trend', security: [{ bearerAuth: [] }] },
    },
    '/companies/me': {
      get: { tags: ['Company'], summary: 'Current company', security: [{ bearerAuth: [] }] },
      patch: { tags: ['Company'], summary: 'Update current company', security: [{ bearerAuth: [] }] },
    },
    '/companies/me/eta-credentials': {
      put: { tags: ['Company'], summary: 'Update ETA credentials', security: [{ bearerAuth: [] }] },
    },
    '/ai/ask': {
      post: { tags: ['AI'], summary: 'Ask the conversational layer', security: [{ bearerAuth: [] }] },
    },
  },
};
