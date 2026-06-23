import type { Request } from 'express';

export function getClientInfo(req: Request) {
  const info: { ipAddress?: string; userAgent?: string } = {};
  if (req.ip) info.ipAddress = req.ip;
  if (req.headers['user-agent']) info.userAgent = req.headers['user-agent'];
  return info;
}
