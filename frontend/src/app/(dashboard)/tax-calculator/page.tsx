'use client';

import { useState, useCallback } from 'react';
import { Calculator, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useFormatters, useT } from '@/lib/i18n';

// Egyptian VAT rates
const VAT_RATES = [
  { value: '14', label: '14% — Standard' },
  { value: '5', label: '5% — Reduced' },
  { value: '0', label: '0% — Zero-rated / Exempt' },
];

// Withholding payment types (mirrors tax.utils.ts)
const WITHHOLDING_RATES: Record<string, { rate: number; labelEn: string; labelAr: string }> = {
  contractors: { rate: 0.05, labelEn: 'Contractors', labelAr: 'مقاولات' },
  professional_services: { rate: 0.1, labelEn: 'Professional services', labelAr: 'خدمات مهنية' },
  dividends: { rate: 0.1, labelEn: 'Dividends', labelAr: 'أرباح موزعة' },
  interest: { rate: 0.2, labelEn: 'Interest', labelAr: 'فوائد' },
  royalties: { rate: 0.2, labelEn: 'Royalties', labelAr: 'إتاوات' },
  rent: { rate: 0.1, labelEn: 'Rent', labelAr: 'إيجار' },
  commissions: { rate: 0.05, labelEn: 'Commissions', labelAr: 'عمولات' },
  prizes: { rate: 0.2, labelEn: 'Prizes & winnings', labelAr: 'جوائز' },
};

// Egyptian personal income tax brackets (2024 — annual net income in EGP)
const INCOME_TAX_BRACKETS = [
  { from: 0, to: 40000, rate: 0 },
  { from: 40000, to: 55000, rate: 0.1 },
  { from: 55000, to: 70000, rate: 0.15 },
  { from: 70000, to: 200000, rate: 0.2 },
  { from: 200000, to: 400000, rate: 0.225 },
  { from: 400000, to: 1200000, rate: 0.25 },
  { from: 1200000, to: Infinity, rate: 0.275 },
];

function calcIncomeTax(annualIncome: number): {
  tax: number;
  effectiveRate: number;
  breakdown: { bracket: string; taxable: number; rate: number; tax: number }[];
} {
  let tax = 0;
  const breakdown: { bracket: string; taxable: number; rate: number; tax: number }[] = [];

  for (const b of INCOME_TAX_BRACKETS) {
    if (annualIncome <= b.from) break;
    const taxableInBracket = Math.min(annualIncome, b.to === Infinity ? annualIncome : b.to) - b.from;
    const taxInBracket = taxableInBracket * b.rate;
    tax += taxInBracket;
    breakdown.push({
      bracket:
        b.to === Infinity
          ? `> ${b.from.toLocaleString()}`
          : `${b.from.toLocaleString()} – ${b.to.toLocaleString()}`,
      taxable: taxableInBracket,
      rate: b.rate,
      tax: taxInBracket,
    });
  }

  return {
    tax: Math.round(tax * 100) / 100,
    effectiveRate: annualIncome > 0 ? Math.round((tax / annualIncome) * 10000) / 100 : 0,
    breakdown,
  };
}

function ResultRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-md px-3 py-2 ${
        highlight ? 'bg-primary/10 font-semibold text-primary' : 'bg-muted/50 text-sm'
      }`}
    >
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

export default function TaxCalculatorPage() {
  const t = useT();
  const { formatCurrency, locale } = useFormatters();

  // --- VAT ---
  const [vatInput, setVatInput] = useState('');
  const [vatRate, setVatRate] = useState('14');
  const [vatMode, setVatMode] = useState<'exclusive' | 'inclusive'>('exclusive');

  const vatAmount = parseFloat(vatInput) || 0;
  const vatRateNum = parseFloat(vatRate) / 100;

  const vatResult =
    vatMode === 'exclusive'
      ? {
          net: vatAmount,
          vat: Math.round(vatAmount * vatRateNum * 100) / 100,
          gross: Math.round(vatAmount * (1 + vatRateNum) * 100) / 100,
        }
      : {
          net: Math.round((vatAmount / (1 + vatRateNum)) * 100) / 100,
          vat: Math.round((vatAmount - vatAmount / (1 + vatRateNum)) * 100) / 100,
          gross: vatAmount,
        };

  // --- Withholding ---
  const [whtInput, setWhtInput] = useState('');
  const [whtType, setWhtType] = useState('professional_services');

  const whtGross = parseFloat(whtInput) || 0;
  const whtInfo = WITHHOLDING_RATES[whtType];
  const whtAmount = Math.round(whtGross * whtInfo.rate * 100) / 100;
  const whtNet = Math.round((whtGross - whtAmount) * 100) / 100;

  // --- Income Tax ---
  const [itInput, setItInput] = useState('');
  const [itPeriod, setItPeriod] = useState<'annual' | 'monthly'>('annual');

  const itRaw = parseFloat(itInput) || 0;
  const itAnnual = itPeriod === 'monthly' ? itRaw * 12 : itRaw;
  const itResult = calcIncomeTax(itAnnual);
  const itMonthlyTax = Math.round((itResult.tax / 12) * 100) / 100;

  const fmt = useCallback(
    (n: number) => formatCurrency(n, 'EGP'),
    [formatCurrency],
  );

  const pct = (n: number) => `${n}%`;

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t('taxCalc.title')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t('taxCalc.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── VAT Calculator ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('taxCalc.vat.title')}</CardTitle>
            <CardDescription>{t('taxCalc.vat.desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode toggle */}
            <div className="flex gap-2">
              {(['exclusive', 'inclusive'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setVatMode(m)}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    vatMode === m
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t(`taxCalc.vat.${m}`)}
                </button>
              ))}
            </div>

            {/* Rate */}
            <div className="space-y-1.5">
              <Label>{t('taxCalc.vat.rate')}</Label>
              <Select value={vatRate} onValueChange={setVatRate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VAT_RATES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label>
                {vatMode === 'exclusive' ? t('taxCalc.vat.netAmount') : t('taxCalc.vat.grossAmount')}
              </Label>
              <Input
                type="number"
                min={0}
                placeholder="0.00"
                value={vatInput}
                onChange={(e) => setVatInput(e.target.value)}
              />
            </div>

            {/* Results */}
            {vatAmount > 0 && (
              <div className="space-y-1.5 pt-1">
                <ResultRow label={t('taxCalc.vat.net')} value={fmt(vatResult.net)} />
                <ResultRow
                  label={`${t('taxCalc.vat.vatAmount')} (${vatRate}%)`}
                  value={fmt(vatResult.vat)}
                />
                <ResultRow label={t('taxCalc.vat.gross')} value={fmt(vatResult.gross)} highlight />
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => setVatInput('')}
            >
              <RotateCcw className="me-1.5 h-3.5 w-3.5" />
              {t('common.clear')}
            </Button>
          </CardContent>
        </Card>

        {/* ── Withholding Tax Calculator ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('taxCalc.wht.title')}</CardTitle>
            <CardDescription>{t('taxCalc.wht.desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Payment type */}
            <div className="space-y-1.5">
              <Label>{t('taxCalc.wht.type')}</Label>
              <Select value={whtType} onValueChange={setWhtType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WITHHOLDING_RATES).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      {locale === 'ar' ? info.labelAr : info.labelEn}
                      {' '}
                      <span className="text-muted-foreground">({pct(info.rate * 100)})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Gross amount */}
            <div className="space-y-1.5">
              <Label>{t('taxCalc.wht.grossAmount')}</Label>
              <Input
                type="number"
                min={0}
                placeholder="0.00"
                value={whtInput}
                onChange={(e) => setWhtInput(e.target.value)}
              />
            </div>

            {/* Rate badge */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{t('taxCalc.wht.rate')}:</span>
              <Badge variant="secondary">{pct(whtInfo.rate * 100)}</Badge>
            </div>

            {/* Results */}
            {whtGross > 0 && (
              <div className="space-y-1.5 pt-1">
                <ResultRow label={t('taxCalc.wht.gross')} value={fmt(whtGross)} />
                <ResultRow
                  label={`${t('taxCalc.wht.withheld')} (${pct(whtInfo.rate * 100)})`}
                  value={fmt(whtAmount)}
                  highlight
                />
                <ResultRow label={t('taxCalc.wht.net')} value={fmt(whtNet)} />
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => setWhtInput('')}
            >
              <RotateCcw className="me-1.5 h-3.5 w-3.5" />
              {t('common.clear')}
            </Button>
          </CardContent>
        </Card>

        {/* ── Income Tax Calculator ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('taxCalc.income.title')}</CardTitle>
            <CardDescription>{t('taxCalc.income.desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Period toggle */}
            <div className="flex gap-2">
              {(['annual', 'monthly'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setItPeriod(p)}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    itPeriod === p
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t(`taxCalc.income.${p}`)}
                </button>
              ))}
            </div>

            {/* Income input */}
            <div className="space-y-1.5">
              <Label>{t('taxCalc.income.amount')}</Label>
              <Input
                type="number"
                min={0}
                placeholder="0.00"
                value={itInput}
                onChange={(e) => setItInput(e.target.value)}
              />
            </div>

            {/* Results */}
            {itAnnual > 0 && (
              <div className="space-y-1.5 pt-1">
                <ResultRow label={t('taxCalc.income.annual')} value={fmt(itAnnual)} />
                <ResultRow label={t('taxCalc.income.annualTax')} value={fmt(itResult.tax)} highlight />
                <ResultRow
                  label={t('taxCalc.income.monthlyTax')}
                  value={fmt(itMonthlyTax)}
                />
                <ResultRow
                  label={t('taxCalc.income.effectiveRate')}
                  value={pct(itResult.effectiveRate)}
                />
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => setItInput('')}
            >
              <RotateCcw className="me-1.5 h-3.5 w-3.5" />
              {t('common.clear')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Income Tax Brackets Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('taxCalc.income.brackets')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {INCOME_TAX_BRACKETS.map((b, i) => (
              <div
                key={i}
                className={`rounded-md border px-3 py-2 text-xs ${
                  itAnnual > b.from && itAnnual <= (b.to === Infinity ? Infinity : b.to)
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'bg-muted/30'
                }`}
              >
                <div className="font-semibold">{b.rate * 100}%</div>
                <div className="mt-0.5 text-muted-foreground">
                  {b.to === Infinity
                    ? `> ${b.from.toLocaleString()} EGP`
                    : `${b.from.toLocaleString()} – ${b.to.toLocaleString()} EGP`}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Withholding Rates Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('taxCalc.wht.ratesRef')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(WITHHOLDING_RATES).map(([key, info]) => (
              <div
                key={key}
                className={`rounded-md border px-3 py-2 text-xs ${
                  whtType === key ? 'border-primary bg-primary/5 text-primary' : 'bg-muted/30'
                }`}
              >
                <div className="font-semibold">{info.rate * 100}%</div>
                <div className="mt-0.5 text-muted-foreground">
                  {locale === 'ar' ? info.labelAr : info.labelEn}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
