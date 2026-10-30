import type { Authority } from './complaintApi';

const slcgRoles = ['Admin', 'OPS'];

export const authorityName = (name: string) => slcgRoles.includes(name) ? 'SLCG' : name;

// Normalize both API versions so forwarding always presents one SLCG recipient.
// Keep the actual receiving role IDs for the request, including on older servers.
export function receivingAuthorities(authorities: Authority[]) {
  const grouped = authorities.find(authority => authority.name === 'SLCG');
  const individual = authorities.filter(authority => slcgRoles.includes(authority.name));
  const options = authorities.filter(authority => !slcgRoles.includes(authority.name) && authority.name !== 'SLCG');
  if (grouped) options.push(grouped);
  else if (individual.length > 0) options.push({
    id: 'slcg', name: 'SLCG',
    activeUsers: slcgRoles.every(role => individual.some(authority => authority.name === role))
      ? Math.min(...individual.map(authority => authority.activeUsers)) : 0,
    roleIds: individual.map(authority => authority.id),
  });
  return options.map(authority => ({ ...authority, roleIds: authority.roleIds ?? [authority.id] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
