import { getApiHealth } from './api-health';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const api = await getApiHealth();

  return (
    <main>
      <p className="eyebrow">Fase 1 · Núcleo técnico mínimo</p>
      <h1>EMPRE.IA</h1>
      <p className="intro">
        Plataforma empresarial preparada para crecer con controles y trazabilidad.
      </p>
      <section aria-labelledby="api-status-title" className="status-card">
        <h2 id="api-status-title">Estado de la API</h2>
        {api.available ? (
          <p>
            Disponible · {api.health.service} · {api.health.environment}
          </p>
        ) : (
          <p>Sin conexión · {api.reason}</p>
        )}
      </section>
    </main>
  );
}
