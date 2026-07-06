import { NextResponse } from 'next/server';

import { ETA_AGENT_DOWNLOAD_URL } from '@/lib/eta-agent-config';

/** Short shareable URL — redirects to the static executable. */
export function GET(request: Request) {
  const target = new URL(ETA_AGENT_DOWNLOAD_URL, request.url);
  return NextResponse.redirect(target);
}
