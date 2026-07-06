import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from '../config/env';

import { User } from '../modules/users/user.entity';
import { Company } from '../modules/companies/company.entity';
import { CompanyMembership } from '../modules/companies/company-membership.entity';
import { Branch } from '../modules/branches/branch.entity';
import { Customer } from '../modules/customers/customer.entity';
import { Product } from '../modules/products/product.entity';
import { Invoice } from '../modules/invoices/invoice.entity';
import { InvoiceItem } from '../modules/invoices/invoice-item.entity';
import { Payment } from '../modules/payments/payment.entity';
import { InvoiceLog } from '../modules/invoices/invoice-log.entity';
import { EtaSyncLog } from '../modules/eta/eta-sync-log.entity';
import { EtaPortalDocument } from '../modules/eta/eta-portal-document.entity';
import { Subscription } from '../modules/subscriptions/subscription.entity';
import { SubscriptionCheckout } from '../modules/subscriptions/subscription-checkout.entity';
import { AuditLog } from '../modules/audit/audit-log.entity';
import { RecurringInvoice } from '../modules/recurring/recurring-invoice.entity';
import { NotificationSettings } from '../modules/notifications/notification-settings.entity';
import { WhatsappMessage } from '../modules/notifications/whatsapp-message.entity';
import { PaymentLink } from '../modules/payment-links/payment-link.entity';
import { Alert } from '../modules/alerts/alert.entity';
import { VatReturn } from '../modules/tax/vat-return.entity';
import { VatPurchaseManual } from '../modules/tax/vat-purchase-manual.entity';
import { Form41Return } from '../modules/tax/form41-return.entity';
import { WithholdingEntry } from '../modules/tax/withholding-entry.entity';
import { CompanyInvite } from '../modules/team/company-invite.entity';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: env.MYSQL_HOST,
  port: env.MYSQL_PORT,
  username: env.MYSQL_USER,
  password: env.MYSQL_PASSWORD,
  database: env.MYSQL_DATABASE,
  // Respect DB_SYNCHRONIZE — keep false on existing DBs to avoid ER_DROP_INDEX_FK
  // drift on compound @Index + FK columns (see scripts/fix-schema-drift.ts).
  synchronize: env.DB_SYNCHRONIZE,
  logging: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  entities: [
    User,
    Company,
    CompanyMembership,
    Branch,
    Customer,
    Product,
    Invoice,
    InvoiceItem,
    Payment,
    InvoiceLog,
    EtaSyncLog,
    EtaPortalDocument,
    Subscription,
    SubscriptionCheckout,
    AuditLog,
    RecurringInvoice,
    NotificationSettings,
    WhatsappMessage,
    PaymentLink,
    Alert,
    VatReturn,
    VatPurchaseManual,
    Form41Return,
    WithholdingEntry,
    CompanyInvite,
  ],
  migrations: ['dist/database/migrations/*.js'],
  charset: 'utf8mb4_unicode_ci',
});
