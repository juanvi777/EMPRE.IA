import { getApiHealth } from './api-health';
import SessionGate from './session-gate';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const api = await getApiHealth();
  return <SessionGate api={api} />;
}
