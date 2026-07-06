/**
 * Shared ETA Desktop Agent settings (safe to import from server routes and
 * client components).
 */
export const ETA_AGENT_URL =
  process.env.NEXT_PUBLIC_ETA_AGENT_URL || 'http://127.0.0.1:8765';

export const ETA_AGENT_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_ETA_AGENT_DOWNLOAD_URL || '/downloads/EtaSigner.exe';

export const ETA_AGENT_DOWNLOAD_FILENAME = 'EtaSigner.exe';
