import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.controller';
import { customerRouter } from '../modules/customers/customer.controller';
import { productRouter } from '../modules/products/product.controller';
import { invoiceRouter } from '../modules/invoices/invoice.controller';
import { paymentRouter } from '../modules/payments/payment.controller';
import { etaRouter } from '../modules/eta/eta.controller';
import { etaPortalRouter } from '../modules/eta/eta-portal.controller';
import { dashboardRouter } from '../modules/dashboard/dashboard.controller';
import { companyRouter } from '../modules/companies/company.controller';
import { branchRouter } from '../modules/branches/branch.controller';
import { aiRouter } from '../modules/ai/ai.controller';
import { recurringInvoiceRouter } from '../modules/recurring/recurring-invoice.controller';
import { notificationRouter } from '../modules/notifications/notification.controller';
import { paymentLinkRouter } from '../modules/payment-links/payment-link.controller';
import { publicPayRouter } from '../modules/payment-links/public-pay.controller';
import { alertRouter } from '../modules/alerts/alert.controller';
import { vatReturnRouter } from '../modules/tax/vat.controller';
import { form41Router } from '../modules/tax/form41.controller';
import { taxCalendarRouter } from '../modules/tax/tax-calendar.controller';
import { subscriptionRouter } from '../modules/subscriptions/subscription.controller';
import { publicSubscriptionRouter } from '../modules/subscriptions/public-subscription.controller';
import { teamRouter, publicInviteRouter } from '../modules/team/team.controller';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: { status: 'ok', timestamp: new Date().toISOString() },
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/companies', companyRouter);
apiRouter.use('/branches', branchRouter);
apiRouter.use('/customers', customerRouter);
apiRouter.use('/products', productRouter);
apiRouter.use('/invoices', invoiceRouter);
apiRouter.use('/recurring-invoices', recurringInvoiceRouter);
apiRouter.use('/payments', paymentRouter);
apiRouter.use('/payment-links', paymentLinkRouter);
apiRouter.use('/public/pay', publicPayRouter);
apiRouter.use('/public/subscription', publicSubscriptionRouter);
apiRouter.use('/public/invites', publicInviteRouter);
apiRouter.use('/team', teamRouter);
apiRouter.use('/subscriptions', subscriptionRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/alerts', alertRouter);
apiRouter.use('/vat-return', vatReturnRouter);
apiRouter.use('/form41', form41Router);
apiRouter.use('/tax-calendar', taxCalendarRouter);
apiRouter.use('/eta', etaRouter);
apiRouter.use('/eta-portal', etaPortalRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/ai', aiRouter);
