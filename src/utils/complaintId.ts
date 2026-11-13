/**
 * Generates unique complaint ID in format: LW-GOA-YYYY-XXXXXX
 * matches regex: ^LW-GOA-[0-9]{4}-[A-Z0-9]{6}$
 */
export function generateComplaintId(): string {
  const year = new Date().getFullYear();
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // non-ambiguous uppercase alphanumerics
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `LW-GOA-${year}-${randomPart}`;
}
