'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, Send } from 'lucide-react';

import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';

interface Turn {
  q: string;
  a: string;
}

export default function AssistantPage() {
  const t = useT();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Turn[]>([]);

  const SUGGESTIONS = [
    t('assistant.s1'),
    t('assistant.s2'),
    t('assistant.s3'),
    t('assistant.s4'),
  ];

  const ask = useMutation({
    mutationFn: async (question: string) =>
      (await api.post('/ai/ask', { question })).data.data as { answer: string },
    onSuccess: (data, q) => setHistory((h) => [...h, { q, a: data.answer }]),
  });

  const submit = () => {
    if (!input.trim() || ask.isPending) return;
    ask.mutate(input.trim());
    setInput('');
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('assistant.title')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('assistant.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('assistant.cardTitle')}</CardTitle>
          <CardDescription>{t('assistant.cardDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                onClick={() => ask.mutate(s)}
                disabled={ask.isPending}
              >
                {s}
              </Button>
            ))}
          </div>

          <div className="min-h-[200px] space-y-3 rounded-md border bg-muted/30 p-3">
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('assistant.placeholder')}</p>
            )}
            {history.map((turn, i) => (
              <div key={i} className="space-y-1">
                <div className="text-sm">
                  <span className="font-semibold">{t('assistant.you')}:</span> {turn.q}
                </div>
                <div className="text-sm">
                  <span className="font-semibold text-primary">{t('assistant.bot')}:</span> {turn.a}
                </div>
              </div>
            ))}
            {ask.isPending && (
              <div className="text-sm text-muted-foreground">{t('common.thinking')}</div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex gap-2"
          >
            <Input
              placeholder={t('assistant.inputPh')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <Button type="submit" disabled={ask.isPending}>
              <Send className="h-4 w-4 rtl-flip" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
