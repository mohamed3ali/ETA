'use client';

import Link from 'next/link';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  Calculator,
  Check,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Headphones,
  LayoutDashboard,
  Mail,
  Menu,
  MessageCircle,
  Package,
  Phone,
  Quote,
  Receipt,
  ReceiptText,
  Repeat,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  UsersRound,
  Wallet,
  X,
  Zap,
  Bell,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useI18n, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function LandingPage() {
  const { dir } = useI18n();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />
      <Hero ArrowIcon={Arrow} />
      <IntegrationMarquee />
      <StatsStrip />
      <HowItWorksSection />
      <FeaturesSection />
      <ModulesCatalogSection />
      <ToolsSection ArrowIcon={Arrow} />
      <AudienceSection />
      <ComplianceStrip />
      <PricingSection ArrowIcon={Arrow} />
      <TestimonialsSection />
      <FaqSection />
      <CtaSection ArrowIcon={Arrow} />
      <Footer />
    </div>
  );
}

/* ─────────────────────────────  NAVBAR  ───────────────────────────── */

function Navbar() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const nav = [
    { id: 'features', href: '#features', label: t('landing.nav.features') },
    { id: 'modules', href: '#modules', label: t('landing.section.modules') },
    { id: 'how', href: '#how', label: t('landing.nav.how') },
    { id: 'tools', href: '#tools', label: t('landing.section.tools') },
    { id: 'pricing', href: '#pricing', label: t('landing.nav.pricing') },
    { id: 'faq', href: '#faq', label: t('landing.nav.faq') },
  ];

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'border-b border-border/80 bg-background/90 shadow-sm backdrop-blur-xl'
          : 'border-b border-transparent bg-background/60 backdrop-blur-md',
      )}
    >
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:h-[4.25rem]">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-indigo-600 to-violet-600 text-primary-foreground shadow-lg shadow-primary/25 transition-transform group-hover:scale-105">
            <Sparkles className="h-5 w-5" />
            <span className="absolute -inset-0.5 -z-10 rounded-xl bg-gradient-to-br from-primary to-violet-600 opacity-40 blur-md" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            ETA<span className="bg-gradient-to-l from-primary to-violet-600 bg-clip-text text-transparent"> SaaS</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {nav.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className="relative text-sm font-medium text-muted-foreground transition-colors hover:text-foreground after:absolute after:-bottom-1 after:start-0 after:h-0.5 after:w-0 after:bg-primary after:transition-all hover:after:w-full"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <LanguageSwitcher />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href="/login">{t('common.signIn')}</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="shadow-md shadow-primary/20 transition-shadow hover:shadow-lg hover:shadow-primary/30"
          >
            <Link href="/register">{t('common.getStarted')}</Link>
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background/95 backdrop-blur-xl lg:hidden">
          <div className="container mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4">
            {nav.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-4">
              <LanguageSwitcher showLabel />
              <Button asChild variant="outline" size="sm">
                <Link href="/login">{t('common.signIn')}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">{t('common.getStarted')}</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

/* ─────────────────────────────  HERO  ───────────────────────────── */

function Hero({ ArrowIcon }: { ArrowIcon: typeof ArrowLeft }) {
  const t = useT();

  return (
    <section className="relative overflow-hidden pb-8 pt-10 md:pb-16 md:pt-16">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="landing-glow-orb absolute -top-40 start-1/2 h-[720px] w-[720px] -translate-x-1/2 rounded-full blur-3xl rtl:translate-x-1/2" />
        <div className="absolute start-0 top-1/4 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute end-0 top-1/3 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-0 landing-grid-bg opacity-[0.35]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
      </div>

      <div className="container mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-4xl text-center">
          <div
            className="mx-auto mb-6 inline-flex animate-fade-up items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary shadow-sm"
            style={{ animationDelay: '0ms' }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <BadgeCheck className="h-3.5 w-3.5" />
            <span>{t('landing.heroBadge')}</span>
          </div>

          <h1
            className="animate-fade-up text-balance text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl md:text-6xl lg:text-[3.5rem]"
            style={{ animationDelay: '80ms' }}
          >
            <span className="block text-foreground">{t('landing.heroPrefix')}</span>
            <span className="mt-1 block text-gradient-hero">{t('landing.heroAccent')}</span>
          </h1>

          <p
            className="mx-auto mt-6 max-w-2xl animate-fade-up text-balance text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl"
            style={{ animationDelay: '160ms' }}
          >
            {t('landing.heroSub')}
          </p>

          <p
            className="mx-auto mt-3 max-w-xl animate-fade-up text-sm font-medium text-foreground/70"
            style={{ animationDelay: '200ms' }}
          >
            {t('landing.hero.tagline')}
          </p>

          <div
            className="mt-9 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: '280ms' }}
          >
            <Button
              asChild
              size="lg"
              className="h-12 w-full min-w-[200px] px-8 text-base shadow-lg shadow-primary/25 sm:w-auto"
            >
              <Link href="/register">
                {t('landing.cta.start')}
                <ArrowIcon className="ms-2 h-4 w-4 rtl-flip" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 w-full border-border/80 bg-background/80 backdrop-blur-sm sm:w-auto"
            >
              <a href="#pricing">{t('landing.cta.pricing')}</a>
            </Button>
          </div>

          <div
            className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 animate-fade-up text-xs text-muted-foreground sm:text-sm"
            style={{ animationDelay: '360ms' }}
          >
            <HeroBullet icon={ShieldCheck} text={t('landing.trialNote')} />
            <HeroBullet icon={Check} text={t('landing.heroBullet.eta')} />
            <HeroBullet icon={Check} text={t('landing.heroBullet.paymob')} />
            <HeroBullet icon={Check} text={t('landing.heroBullet.whatsapp')} />
          </div>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

function HeroBullet({
  icon: Icon,
  text,
}: {
  icon: ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-1.5 shadow-sm backdrop-blur-sm">
      <Icon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
      {text}
    </span>
  );
}

function HeroPreview() {
  const t = useT();

  return (
    <div className="relative mx-auto mt-16 max-w-5xl md:mt-20">
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-tr from-primary/30 via-indigo-400/15 to-violet-500/20 blur-2xl animate-pulse-glow" />

      {/* floating badges */}
      <div className="pointer-events-none absolute -start-2 top-8 z-10 hidden animate-float rounded-xl border border-emerald-500/20 bg-card/95 px-3 py-2 shadow-lg backdrop-blur-md md:block lg:-start-8">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
            <Check className="h-4 w-4" />
          </span>
          <span>{t('landing.preview.accepted')}</span>
        </div>
      </div>
      <div
        className="pointer-events-none absolute -end-2 top-24 z-10 hidden animate-float rounded-xl border border-primary/20 bg-card/95 px-3 py-2 shadow-lg backdrop-blur-md md:block lg:-end-8"
        style={{ animationDelay: '1.5s' }}
      >
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Bot className="h-4 w-4" />
          </span>
          {t('landing.preview.aiAssistant')}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-400/90" />
          <span className="h-3 w-3 rounded-full bg-amber-400/90" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/90" />
          <div className="mx-auto flex h-7 min-w-[200px] items-center justify-center rounded-md bg-background/80 px-4 text-[11px] text-muted-foreground ring-1 ring-border/60">
            app.eta-saas.com/dashboard
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 bg-gradient-to-b from-muted/20 to-background p-5 md:grid-cols-3 md:p-6">
          <PreviewCard
            tone="primary"
            label={t('landing.preview.kpi.revenue')}
            value="٢٤٨٬٠٠٠ ج.م"
            delta="+18%"
          />
          <PreviewCard
            tone="emerald"
            label={t('landing.preview.kpi.invoices')}
            value="١٬٢٤٢"
            delta="+22%"
          />
          <PreviewCard
            tone="amber"
            label={t('landing.preview.kpi.collected')}
            value="١٨٩٬٢٠٠ ج.م"
            delta="+11%"
          />

          <div className="col-span-1 rounded-xl border border-border bg-card p-4 shadow-sm md:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold">{t('landing.preview.chart')}</div>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                +12%
              </span>
            </div>
            <SparkBars />
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold">{t('landing.preview.recent')}</div>
            <ul className="space-y-2.5">
              {['#INV-1042', '#INV-1041', '#INV-1040'].map((n, i) => (
                <li key={n} className="flex items-center justify-between rounded-lg bg-muted/40 px-2.5 py-2 text-xs">
                  <span className="font-mono text-muted-foreground">{n}</span>
                  <StatusPill
                    label={
                      i === 0
                        ? t('landing.preview.paid')
                        : i === 1
                          ? t('landing.preview.pending')
                          : t('landing.preview.accepted')
                    }
                    variant={i === 0 ? 'paid' : i === 1 ? 'pending' : 'accepted'}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  label,
  variant,
}: {
  label: string;
  variant: 'paid' | 'pending' | 'accepted';
}) {
  const cls = {
    paid: 'bg-emerald-500/10 text-emerald-600',
    pending: 'bg-amber-500/10 text-amber-600',
    accepted: 'bg-sky-500/10 text-sky-600',
  }[variant];
  return <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', cls)}>{label}</span>;
}

function PreviewCard({
  tone,
  label,
  value,
  delta,
}: {
  tone: 'primary' | 'emerald' | 'amber';
  label: string;
  value: string;
  delta: string;
}) {
  const toneCls = {
    primary: 'from-primary/15 to-primary/5 border-primary/20',
    emerald: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20',
    amber: 'from-amber-500/15 to-amber-500/5 border-amber-500/20',
  }[tone];
  const deltaCls = {
    primary: 'text-primary',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
  }[tone];

  return (
    <div className={cn('rounded-xl border bg-gradient-to-br p-4 shadow-sm', toneCls)}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight">{value}</div>
      <div className={cn('mt-0.5 text-xs font-bold', deltaCls)}>{delta}</div>
    </div>
  );
}

function SparkBars() {
  const bars = [40, 65, 50, 80, 55, 90, 72, 88, 60, 95, 78, 100];
  return (
    <div className="flex h-28 items-end gap-1.5">
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-md bg-gradient-to-t from-primary/25 to-primary shadow-sm transition-all hover:from-primary/40"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────  INTEGRATIONS MARQUEE  ───────────────────────────── */

function IntegrationMarquee() {
  const t = useT();
  const items = [
    { icon: Building2, label: t('landing.trustBar.eta') },
    { icon: FileText, label: t('landing.module.invoices.title') },
    { icon: ReceiptText, label: t('landing.module.receipts.title') },
    { icon: CreditCard, label: 'Paymob' },
    { icon: MessageCircle, label: 'WhatsApp' },
    { icon: ScrollText, label: t('landing.module.etaReader.title') },
    { icon: Receipt, label: t('landing.module.vatReturn.title') },
    { icon: Bot, label: t('landing.module.assistant.title') },
    { icon: Briefcase, label: t('landing.module.firm.title') },
    { icon: ShieldCheck, label: t('landing.compliance.cloud') },
  ];

  const doubled = [...items, ...items];

  return (
    <section className="border-y border-border/60 bg-muted/30 py-10">
      <div className="container mx-auto max-w-7xl px-4">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t('landing.trust.integrations')}
        </p>
        <div className="relative overflow-hidden mask-fade-x">
          <div className="flex w-max animate-marquee gap-4">
            {doubled.map((item, i) => (
              <div
                key={`${item.label}-${i}`}
                className="flex shrink-0 items-center gap-3 rounded-full border border-border/80 bg-card px-5 py-2.5 shadow-sm"
              >
                <item.icon className="h-4 w-4 text-primary" />
                <span className="whitespace-nowrap text-sm font-semibold">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────  STATS  ───────────────────────────── */

function StatsStrip() {
  const t = useT();
  const stats = [
    { value: '+250', label: t('landing.stats.companies'), color: 'from-primary to-indigo-500' },
    { value: '+1.2K', label: t('landing.stats.users'), color: 'from-indigo-500 to-violet-500' },
    { value: '+50K', label: t('landing.stats.invoices'), color: 'from-violet-500 to-fuchsia-500' },
    { value: '99.9%', label: t('landing.stats.uptime'), color: 'from-emerald-500 to-teal-500' },
  ];

  return (
    <section className="relative py-16 md:py-20">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
          {stats.map((s) => (
            <div
              key={s.label}
              className="group rounded-2xl border border-border/80 bg-card p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
            >
              <div
                className={cn(
                  'bg-gradient-to-l bg-clip-text text-3xl font-extrabold tracking-tight text-transparent md:text-4xl lg:text-5xl',
                  s.color,
                )}
              >
                {s.value}
              </div>
              <div className="mt-2 text-sm font-medium text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────  HOW IT WORKS  ───────────────────────────── */

function HowItWorksSection() {
  const t = useT();
  const steps = [
    { num: '01', title: t('landing.how.step1.title'), desc: t('landing.how.step1.desc'), icon: FileText },
    { num: '02', title: t('landing.how.step2.title'), desc: t('landing.how.step2.desc'), icon: CreditCard },
    { num: '03', title: t('landing.how.step3.title'), desc: t('landing.how.step3.desc'), icon: BarChart3 },
  ];

  return (
    <section id="how" className="border-y border-border/60 bg-muted/20 py-20 md:py-28">
      <div className="container mx-auto max-w-7xl px-4">
        <SectionHeading
          eyebrow={t('landing.how.eyebrow')}
          title={t('landing.how.title')}
          subtitle={t('landing.how.sub')}
        />

        <div className="relative mt-14 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
          <div className="pointer-events-none absolute top-16 hidden h-0.5 bg-gradient-to-l from-transparent via-primary/30 to-transparent md:block md:inset-x-[16%]" />

          {steps.map((step, i) => (
            <div
              key={step.num}
              className="relative rounded-2xl border border-border bg-card p-8 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="text-4xl font-black text-primary/15">{step.num}</span>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="h-6 w-6" />
                </div>
              </div>
              <h3 className="text-xl font-bold">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
              {i < steps.length - 1 && (
                <div className="absolute -bottom-4 start-1/2 hidden h-8 w-px bg-border md:block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────  FEATURES  ───────────────────────────── */

function FeaturesSection() {
  const t = useT();
  const features = [
    {
      icon: FileText,
      title: t('landing.feature.invoices.title'),
      desc: t('landing.feature.invoices.desc'),
      color: 'text-sky-600',
      bg: 'bg-sky-500/10',
      ring: 'group-hover:ring-sky-500/30',
    },
    {
      icon: ReceiptText,
      title: t('landing.feature.receipts.title'),
      desc: t('landing.feature.receipts.desc'),
      color: 'text-cyan-600',
      bg: 'bg-cyan-500/10',
      ring: 'group-hover:ring-cyan-500/30',
    },
    {
      icon: Repeat,
      title: t('landing.feature.recurring.title'),
      desc: t('landing.feature.recurring.desc'),
      color: 'text-blue-600',
      bg: 'bg-blue-500/10',
      ring: 'group-hover:ring-blue-500/30',
    },
    {
      icon: Wallet,
      title: t('landing.feature.payments.title'),
      desc: t('landing.feature.payments.desc'),
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
      ring: 'group-hover:ring-emerald-500/30',
    },
    {
      icon: ScrollText,
      title: t('landing.feature.reader.title'),
      desc: t('landing.feature.reader.desc'),
      color: 'text-indigo-600',
      bg: 'bg-indigo-500/10',
      ring: 'group-hover:ring-indigo-500/30',
    },
    {
      icon: Receipt,
      title: t('landing.feature.vat.title'),
      desc: t('landing.feature.vat.desc'),
      color: 'text-amber-600',
      bg: 'bg-amber-500/10',
      ring: 'group-hover:ring-amber-500/30',
    },
    {
      icon: Bot,
      title: t('landing.feature.ai.title'),
      desc: t('landing.feature.ai.desc'),
      color: 'text-violet-600',
      bg: 'bg-violet-500/10',
      ring: 'group-hover:ring-violet-500/30',
    },
    {
      icon: UsersRound,
      title: t('landing.feature.team.title'),
      desc: t('landing.feature.team.desc'),
      color: 'text-rose-600',
      bg: 'bg-rose-500/10',
      ring: 'group-hover:ring-rose-500/30',
    },
    {
      icon: Briefcase,
      title: t('landing.feature.firm.title'),
      desc: t('landing.feature.firm.desc'),
      color: 'text-fuchsia-600',
      bg: 'bg-fuchsia-500/10',
      ring: 'group-hover:ring-fuchsia-500/30',
    },
    {
      icon: BarChart3,
      title: t('landing.feature.analytics.title'),
      desc: t('landing.feature.analytics.desc'),
      color: 'text-teal-600',
      bg: 'bg-teal-500/10',
      ring: 'group-hover:ring-teal-500/30',
    },
    {
      icon: ShieldCheck,
      title: t('landing.feature.compliance.title'),
      desc: t('landing.feature.compliance.desc'),
      color: 'text-green-600',
      bg: 'bg-green-500/10',
      ring: 'group-hover:ring-green-500/30',
    },
    {
      icon: Zap,
      title: t('landing.feature.automation.title'),
      desc: t('landing.feature.automation.desc'),
      color: 'text-orange-600',
      bg: 'bg-orange-500/10',
      ring: 'group-hover:ring-orange-500/30',
    },
  ];

  return (
    <section id="features" className="py-20 md:py-28">
      <div className="container mx-auto max-w-7xl px-4">
        <SectionHeading
          eyebrow={t('landing.section.features')}
          title={t('landing.section.featuresSub')}
          subtitle={t('landing.section.featuresDesc')}
        />
        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className={cn(
                'feature-card-glow group rounded-2xl border border-border bg-card p-6 ring-1 ring-transparent transition-all duration-300 hover:-translate-y-1 hover:shadow-xl',
                f.ring,
              )}
            >
              <div
                className={cn(
                  'mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110',
                  f.bg,
                )}
              >
                <f.icon className={cn('h-6 w-6', f.color)} />
              </div>
              <h3 className="mb-1.5 text-base font-bold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────  MODULES CATALOG  ───────────────────────────── */

type ModuleCat = 'invoicing' | 'tax' | 'management' | 'intelligence';

function ModulesCatalogSection() {
  const t = useT();
  const [active, setActive] = useState<ModuleCat>('invoicing');

  const categories: { id: ModuleCat; label: string }[] = [
    { id: 'invoicing', label: t('landing.modules.cat.invoicing') },
    { id: 'tax', label: t('landing.modules.cat.tax') },
    { id: 'management', label: t('landing.modules.cat.management') },
    { id: 'intelligence', label: t('landing.modules.cat.intelligence') },
  ];

  const modules: Record<
    ModuleCat,
    { icon: ComponentType<{ className?: string }>; key: string; color: string; bg: string }[]
  > = {
    invoicing: [
      { icon: FileText, key: 'invoices', color: 'text-sky-600', bg: 'bg-sky-500/10' },
      { icon: ReceiptText, key: 'receipts', color: 'text-cyan-600', bg: 'bg-cyan-500/10' },
      { icon: Repeat, key: 'recurring', color: 'text-blue-600', bg: 'bg-blue-500/10' },
      { icon: Users, key: 'customers', color: 'text-violet-600', bg: 'bg-violet-500/10' },
      { icon: Package, key: 'products', color: 'text-indigo-600', bg: 'bg-indigo-500/10' },
    ],
    tax: [
      { icon: ScrollText, key: 'etaReader', color: 'text-sky-600', bg: 'bg-sky-500/10' },
      { icon: Download, key: 'etaPortal', color: 'text-blue-600', bg: 'bg-blue-500/10' },
      { icon: Receipt, key: 'vatReturn', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
      { icon: ClipboardList, key: 'form41', color: 'text-amber-600', bg: 'bg-amber-500/10' },
      { icon: Calculator, key: 'taxCalculator', color: 'text-orange-600', bg: 'bg-orange-500/10' },
    ],
    management: [
      { icon: Wallet, key: 'payments', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
      { icon: UsersRound, key: 'team', color: 'text-violet-600', bg: 'bg-violet-500/10' },
      { icon: Building2, key: 'companies', color: 'text-indigo-600', bg: 'bg-indigo-500/10' },
      { icon: Briefcase, key: 'firm', color: 'text-fuchsia-600', bg: 'bg-fuchsia-500/10' },
      { icon: Building2, key: 'branches', color: 'text-rose-600', bg: 'bg-rose-500/10' },
      { icon: Bell, key: 'alerts', color: 'text-amber-600', bg: 'bg-amber-500/10' },
    ],
    intelligence: [
      { icon: LayoutDashboard, key: 'dashboard', color: 'text-primary', bg: 'bg-primary/10' },
      { icon: BarChart3, key: 'reports', color: 'text-teal-600', bg: 'bg-teal-500/10' },
      { icon: Bot, key: 'assistant', color: 'text-violet-600', bg: 'bg-violet-500/10' },
    ],
  };

  return (
    <section id="modules" className="border-y border-border/60 bg-muted/20 py-20 md:py-28">
      <div className="container mx-auto max-w-7xl px-4">
        <SectionHeading
          eyebrow={t('landing.section.modules')}
          title={t('landing.section.modulesSub')}
          subtitle={t('landing.section.modulesDesc')}
        />

        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActive(cat.id)}
              className={cn(
                'rounded-full px-5 py-2.5 text-sm font-semibold transition-all',
                active === cat.id
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                  : 'border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules[active].map((mod) => (
            <div
              key={mod.key}
              className="group flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
            >
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
                  mod.bg,
                )}
              >
                <mod.icon className={cn('h-5 w-5', mod.color)} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold">{t(`landing.module.${mod.key}.title`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {t(`landing.module.${mod.key}.desc`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────  TOOLS  ───────────────────────────── */

function ToolsSection({ ArrowIcon }: { ArrowIcon: typeof ArrowLeft }) {
  const t = useT();
  const blocks = [
    {
      icon: Receipt,
      tag: t('landing.main.invoices.tag'),
      title: t('landing.main.invoices.title'),
      desc: t('landing.main.invoices.desc'),
      bullets: [
        t('landing.main.invoices.b1'),
        t('landing.main.invoices.b2'),
        t('landing.main.invoices.b3'),
      ],
      gradient: 'from-primary/10 via-indigo-400/10 to-transparent',
      accent: 'border-primary/20',
    },
    {
      icon: CreditCard,
      tag: t('landing.main.payments.tag'),
      title: t('landing.main.payments.title'),
      desc: t('landing.main.payments.desc'),
      bullets: [
        t('landing.main.payments.b1'),
        t('landing.main.payments.b2'),
        t('landing.main.payments.b3'),
      ],
      gradient: 'from-emerald-500/10 via-teal-400/10 to-transparent',
      accent: 'border-emerald-500/20',
    },
    {
      icon: ClipboardList,
      tag: t('landing.main.tax.tag'),
      title: t('landing.main.tax.title'),
      desc: t('landing.main.tax.desc'),
      bullets: [t('landing.main.tax.b1'), t('landing.main.tax.b2'), t('landing.main.tax.b3')],
      gradient: 'from-amber-500/10 via-orange-400/10 to-transparent',
      accent: 'border-amber-500/20',
    },
    {
      icon: FileSpreadsheet,
      tag: t('landing.main.reports.tag'),
      title: t('landing.main.reports.title'),
      desc: t('landing.main.reports.desc'),
      bullets: [
        t('landing.main.reports.b1'),
        t('landing.main.reports.b2'),
        t('landing.main.reports.b3'),
      ],
      gradient: 'from-rose-500/10 via-pink-400/10 to-transparent',
      accent: 'border-rose-500/20',
    },
    {
      icon: Briefcase,
      tag: t('landing.main.team.tag'),
      title: t('landing.main.team.title'),
      desc: t('landing.main.team.desc'),
      bullets: [t('landing.main.team.b1'), t('landing.main.team.b2'), t('landing.main.team.b3')],
      gradient: 'from-violet-500/10 via-fuchsia-400/10 to-transparent',
      accent: 'border-violet-500/20',
    },
  ];

  return (
    <section id="tools" className="border-y border-border/60 bg-muted/20 py-20 md:py-28">
      <div className="container mx-auto max-w-7xl px-4">
        <SectionHeading
          eyebrow={t('landing.section.tools')}
          title={t('landing.section.toolsTitle')}
          subtitle={t('landing.section.toolsSub')}
        />

        <div className="mt-14 space-y-12">
          {blocks.map((b, i) => (
            <div
              key={b.title}
              className={cn(
                'grid grid-cols-1 items-center gap-10 rounded-3xl border bg-card p-6 shadow-sm md:grid-cols-2 md:p-10 lg:p-12',
                'bg-gradient-to-br',
                b.gradient,
                b.accent,
              )}
            >
              <div className={cn('order-1', i % 2 === 1 && 'md:order-2')}>
                <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-foreground/70">
                  <b.icon className="h-3.5 w-3.5 text-primary" />
                  {b.tag}
                </span>
                <h3 className="text-2xl font-extrabold tracking-tight md:text-3xl lg:text-4xl">{b.title}</h3>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">{b.desc}</p>
                <ul className="mt-6 space-y-3">
                  {b.bullets.map((bl) => (
                    <li key={bl} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                        <Check className="h-3 w-3 text-emerald-600" />
                      </span>
                      <span>{bl}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-8" variant="outline">
                  <Link href="/register">
                    {t('landing.main.cta')}
                    <ArrowIcon className="ms-1.5 h-3.5 w-3.5 rtl-flip" />
                  </Link>
                </Button>
              </div>

              <div className={cn('order-2', i % 2 === 1 && 'md:order-1')}>
                <ToolMock icon={b.icon} tag={b.tag} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ToolMock({ icon: Icon, tag }: { icon: typeof Receipt; tag: string }) {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-tr from-primary/15 via-indigo-400/10 to-violet-500/10 blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
          <span className="font-mono font-medium">{tag}</span>
          <span className="rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary">ETA SaaS</span>
        </div>
        <div className="space-y-3 p-5">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 rounded-md bg-muted animate-pulse" />
              <div className="h-2.5 w-1/2 rounded-md bg-muted/70" />
            </div>
          </div>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5 transition-colors hover:bg-muted/30"
            >
              <div className="space-y-2">
                <div className="h-2.5 w-28 rounded bg-muted" />
                <div className="h-2 w-20 rounded bg-muted/60" />
              </div>
              <div className="h-7 w-20 rounded-full bg-gradient-to-l from-emerald-500/20 to-emerald-500/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────  AUDIENCE  ───────────────────────────── */

function AudienceSection() {
  const t = useT();

  const cards = [
    {
      icon: Building2,
      title: t('landing.audience.business.title'),
      desc: t('landing.audience.business.desc'),
      bullets: [
        t('landing.audience.business.b1'),
        t('landing.audience.business.b2'),
        t('landing.audience.business.b3'),
      ],
      gradient: 'from-primary/15 via-indigo-500/10 to-transparent',
      iconBg: 'bg-primary/10 text-primary',
    },
    {
      icon: Briefcase,
      title: t('landing.audience.firm.title'),
      desc: t('landing.audience.firm.desc'),
      bullets: [
        t('landing.audience.firm.b1'),
        t('landing.audience.firm.b2'),
        t('landing.audience.firm.b3'),
      ],
      gradient: 'from-violet-500/15 via-fuchsia-500/10 to-transparent',
      iconBg: 'bg-violet-500/10 text-violet-600',
    },
  ];

  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto max-w-7xl px-4">
        <SectionHeading
          eyebrow={t('landing.audience.eyebrow')}
          title={t('landing.audience.title')}
          subtitle={t('landing.audience.sub')}
        />

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
          {cards.map((card) => (
            <div
              key={card.title}
              className={cn(
                'rounded-3xl border bg-gradient-to-br p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl md:p-10',
                card.gradient,
                'border-border',
              )}
            >
              <div
                className={cn(
                  'mb-5 flex h-14 w-14 items-center justify-center rounded-2xl',
                  card.iconBg,
                )}
              >
                <card.icon className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-extrabold tracking-tight">{card.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">{card.desc}</p>
              <ul className="mt-6 space-y-3">
                {card.bullets.map((bl) => (
                  <li key={bl} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                      <Check className="h-3 w-3 text-emerald-600" />
                    </span>
                    <span>{bl}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────  COMPLIANCE  ───────────────────────────── */

function ComplianceStrip() {
  const t = useT();
  const items = [
    { icon: Building2, label: t('landing.compliance.eta') },
    { icon: CreditCard, label: t('landing.compliance.paymob') },
    { icon: MessageCircle, label: t('landing.compliance.whatsapp') },
    { icon: Database, label: t('landing.compliance.cloud') },
  ];

  return (
    <section className="py-16 md:py-20">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-violet-500/5 p-8 shadow-inner md:p-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {items.map((it) => (
              <div key={it.label} className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card shadow-md ring-1 ring-border transition-transform hover:scale-105">
                  <it.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="text-sm font-semibold">{it.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────  PRICING  ───────────────────────────── */

type PlanId = 'starter' | 'professional' | 'enterprise';

interface PlanDef {
  id: PlanId;
  name: string;
  desc: string;
  monthly: number;
  yearly: number;
  quota: number;
  features: string[];
  popular?: boolean;
}

function PricingSection({ ArrowIcon }: { ArrowIcon: typeof ArrowLeft }) {
  const t = useT();
  const [yearly, setYearly] = useState(false);

  const plans: PlanDef[] = [
    {
      id: 'starter',
      name: t('landing.plan.starter'),
      desc: t('landing.plan.starterDesc'),
      monthly: 299,
      yearly: 2_990,
      quota: 200,
      features: [
        t('landing.plan.feat1'),
        t('landing.plan.feat2'),
        t('landing.plan.feat3'),
        t('landing.plan.feat.starter1'),
      ],
    },
    {
      id: 'professional',
      name: t('landing.plan.professional'),
      desc: t('landing.plan.proDesc'),
      monthly: 699,
      yearly: 6_990,
      quota: 1_000,
      popular: true,
      features: [
        t('landing.plan.feat1'),
        t('landing.plan.feat2'),
        t('landing.plan.feat3'),
        t('landing.plan.feat.pro1'),
        t('landing.plan.feat.pro2'),
      ],
    },
    {
      id: 'enterprise',
      name: t('landing.plan.enterprise'),
      desc: t('landing.plan.entDesc'),
      monthly: 1_999,
      yearly: 19_990,
      quota: 10_000,
      features: [
        t('landing.plan.feat1'),
        t('landing.plan.feat2'),
        t('landing.plan.feat3'),
        t('landing.plan.feat.ent1'),
        t('landing.plan.feat.ent2'),
        t('landing.plan.feat.ent3'),
      ],
    },
  ];

  return (
    <section id="pricing" className="py-20 md:py-28">
      <div className="container mx-auto max-w-7xl px-4">
        <SectionHeading
          eyebrow={t('landing.section.pricing')}
          title={t('landing.section.pricingTitle')}
          subtitle={t('landing.section.pricingSub')}
        />

        <div className="mt-10 flex items-center justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 p-1 shadow-inner">
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={cn(
                'rounded-full px-5 py-2 text-sm font-semibold transition-all',
                !yearly ? 'bg-background text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t('landing.billing.monthly')}
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all',
                yearly ? 'bg-background text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t('landing.billing.yearly')}
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                -17%
              </span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col rounded-2xl border border-dashed border-border bg-muted/20 p-7">
            <div className="text-sm font-semibold text-muted-foreground">{t('landing.plan.trial')}</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold">{t('landing.plan.free')}</span>
              <span className="text-sm text-muted-foreground">/ {t('landing.plan.trial14')}</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t('landing.plan.trialDesc')}</p>
            <ul className="mt-6 flex-1 space-y-3 text-sm">
              {[t('landing.plan.trial1'), t('landing.plan.trial2'), t('landing.plan.trial3')].map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-8 w-full">
              <Link href="/register">{t('landing.plan.startTrial')}</Link>
            </Button>
          </div>

          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} yearly={yearly} ArrowIcon={ArrowIcon} />
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">{t('landing.pricing.note')}</p>
      </div>
    </section>
  );
}

function PlanCard({
  plan,
  yearly,
  ArrowIcon,
}: {
  plan: PlanDef;
  yearly: boolean;
  ArrowIcon: typeof ArrowLeft;
}) {
  const t = useT();
  const price = yearly ? plan.yearly : plan.monthly;
  const per = yearly ? t('landing.billing.perYear') : t('landing.billing.perMonth');

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border bg-card p-7 transition-all duration-300',
        plan.popular
          ? 'scale-[1.02] border-primary shadow-2xl shadow-primary/15 ring-2 ring-primary/25'
          : 'border-border hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl',
      )}
    >
      {plan.popular && (
        <div className="absolute -top-3.5 start-1/2 -translate-x-1/2 rounded-full bg-gradient-to-l from-primary to-violet-600 px-4 py-1 text-[11px] font-bold text-primary-foreground shadow-lg rtl:translate-x-1/2">
          ★ {t('landing.plan.popular')}
        </div>
      )}

      <div className="text-sm font-bold">{plan.name}</div>
      <p className="mt-1 text-xs text-muted-foreground">{plan.desc}</p>
      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="text-4xl font-extrabold tracking-tight">{price.toLocaleString()}</span>
        <span className="text-sm font-medium text-muted-foreground">EGP</span>
      </div>
      <span className="text-xs text-muted-foreground">/ {per}</span>
      <p className="mt-3 text-xs text-muted-foreground">
        {t('landing.plan.quota', { count: plan.quota.toLocaleString() })}
      </p>

      <ul className="mt-6 flex-1 space-y-3 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Button asChild className="mt-8 w-full" variant={plan.popular ? 'default' : 'outline'} size="lg">
        <Link href={`/register?plan=${plan.id}&billing=${yearly ? 'yearly' : 'monthly'}`}>
          {t('landing.plan.subscribe')}
          <ArrowIcon className="ms-1.5 h-3.5 w-3.5 rtl-flip" />
        </Link>
      </Button>
    </div>
  );
}

/* ─────────────────────────────  TESTIMONIALS  ───────────────────────────── */

function TestimonialsSection() {
  const t = useT();
  const items = [1, 2, 3].map((i) => ({
    quote: t(`landing.testimonial.${i}.quote`),
    name: t(`landing.testimonial.${i}.name`),
    role: t(`landing.testimonial.${i}.role`),
  }));

  const gradients = [
    'from-primary/20 to-indigo-500/10',
    'from-violet-500/20 to-fuchsia-500/10',
    'from-emerald-500/20 to-teal-500/10',
  ];

  return (
    <section className="border-t border-border/60 bg-muted/20 py-20 md:py-28">
      <div className="container mx-auto max-w-7xl px-4">
        <SectionHeading
          eyebrow={t('landing.section.testimonials')}
          title={t('landing.section.testimonialsTitle')}
          subtitle={t('landing.section.testimonialsSub')}
        />

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {items.map((tm, i) => (
            <figure
              key={tm.name}
              className={cn(
                'relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl',
              )}
            >
              <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60', gradients[i])} />
              <div className="relative">
                <div className="mb-4 flex gap-0.5 text-amber-400">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <Quote className="mb-3 h-7 w-7 text-primary/30" />
                <blockquote className="flex-1 text-sm leading-relaxed md:text-base">"{tm.quote}"</blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-border/60 pt-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet-600 text-sm font-bold text-primary-foreground shadow-md">
                    {tm.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold">{tm.name}</div>
                    <div className="text-xs text-muted-foreground">{tm.role}</div>
                  </div>
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────  FAQ  ───────────────────────────── */

function FaqSection() {
  const t = useT();
  const faqs = [1, 2, 3, 4, 5].map((i) => ({
    q: t(`landing.faq.${i}.q`),
    a: t(`landing.faq.${i}.a`),
  }));

  return (
    <section id="faq" className="py-20 md:py-28">
      <div className="container mx-auto max-w-3xl px-4">
        <SectionHeading
          eyebrow={t('landing.nav.faq')}
          title={t('landing.section.faq')}
          subtitle={t('landing.section.faqSub')}
          align="center"
        />

        <div className="mt-12 space-y-3">
          {faqs.map((f, i) => (
            <FaqItem key={i} q={f.q} a={f.a} defaultOpen={i === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div
      className={cn(
        'rounded-xl border bg-card transition-all',
        open ? 'border-primary/30 shadow-md' : 'border-border hover:border-border/80',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start md:px-6 md:py-5"
      >
        <span className="text-sm font-semibold md:text-base">{q}</span>
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180 text-primary',
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-all duration-200',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground md:px-6 md:pb-6">
            {a}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────  CTA  ───────────────────────────── */

function CtaSection({ ArrowIcon }: { ArrowIcon: typeof ArrowLeft }) {
  const t = useT();
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-primary via-indigo-600 to-violet-700 px-6 py-16 text-center text-primary-foreground shadow-2xl shadow-primary/25 md:px-14 md:py-20">
          <div className="pointer-events-none absolute inset-0">
            <div
              className="h-full w-full opacity-25"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 65%, white 1px, transparent 1px)',
                backgroundSize: '48px 48px, 64px 64px',
              }}
            />
            <div className="absolute -end-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-16 -start-16 h-56 w-56 rounded-full bg-violet-400/20 blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl font-extrabold leading-tight md:text-5xl">{t('landing.cta.final')}</h2>
            <p className="mx-auto mt-4 max-w-xl text-base opacity-90 md:text-lg">{t('landing.cta.finalSub')}</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="secondary" className="h-12 w-full px-8 sm:w-auto">
                <Link href="/register">
                  {t('common.startFreeTrial')}
                  <ArrowIcon className="ms-2 h-4 w-4 rtl-flip" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 w-full border-white/40 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15 hover:text-white sm:w-auto"
              >
                <a href="#pricing">{t('landing.cta.pricing')}</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────  FOOTER  ───────────────────────────── */

function Footer() {
  const t = useT();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-600 text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold">ETA SaaS</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {t('landing.footer.tagline')}
          </p>
        </div>

        <FooterCol title={t('landing.footer.product')}>
          <FooterLink href="#features">{t('landing.nav.features')}</FooterLink>
          <FooterLink href="#modules">{t('landing.section.modules')}</FooterLink>
          <FooterLink href="#how">{t('landing.nav.how')}</FooterLink>
          <FooterLink href="#tools">{t('landing.section.tools')}</FooterLink>
          <FooterLink href="#pricing">{t('landing.nav.pricing')}</FooterLink>
          <FooterLink href="/register">{t('common.startFreeTrial')}</FooterLink>
        </FooterCol>

        <FooterCol title={t('landing.footer.resources')}>
          <FooterLink href="#faq">{t('landing.nav.faq')}</FooterLink>
          <FooterLink href="/login">{t('common.signIn')}</FooterLink>
          <FooterLink href="/register">{t('common.register')}</FooterLink>
        </FooterCol>

        <FooterCol title={t('landing.footer.contact')}>
          <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0 text-primary" /> support@eta-saas.com
          </li>
          <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0 text-primary" /> +20 100 000 0000
          </li>
          <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Headphones className="h-4 w-4 shrink-0 text-primary" /> {t('landing.footer.support247')}
          </li>
        </FooterCol>
      </div>

      <div className="container mx-auto max-w-7xl border-t border-border/60 px-4 py-6">
        <p className="text-center text-xs text-muted-foreground">{t('landing.footer.copy', { year })}</p>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-4 text-sm font-bold">{title}</div>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        {children}
      </Link>
    </li>
  );
}

/* ─────────────────────────────  SHARED  ───────────────────────────── */

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: 'center' | 'start';
}) {
  return (
    <div className={cn('max-w-3xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-bold text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          {eyebrow}
        </div>
      )}
      <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl lg:text-[2.75rem] lg:leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">{subtitle}</p>
      )}
    </div>
  );
}
