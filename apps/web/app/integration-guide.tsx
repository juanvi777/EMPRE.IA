'use client';

import { useState } from 'react';

interface IntegrationPlan {
  planId: string;
  status: 'ready_for_owner_review' | 'blocked';
  targetUrl: string;
  detectedKind: 'api-or-connector' | 'public-webpage';
  recommendedAuth: Array<'oauth' | 'login' | 'bearer' | 'api_key' | 'none'>;
  discoveryOrder: string[];
  candidateEndpoints: string[];
  requiredOwnerInputs: string[];
  safetyRules: string[];
  nextSteps: string[];
}

export default function IntegrationGuide(props: { apiBaseUrl: string; token: string | null; canPrepare: boolean; openIntegrations: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'guide' | 'prepare'>('guide');
  const [url, setUrl] = useState('');
  const [goal, setGoal] = useState('Conectar y poder consultar clientes, ventas, citas y operaciones autorizadas.');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [plan, setPlan] = useState<IntegrationPlan | null>(null);

  async function prepare() {
    if (!props.token || !url.trim()) { setMessage('Escribe la URL HTTPS del sistema que deseas conectar.'); return; }
    setPending(true); setMessage('EMPRE está preparando el plan de integración…'); setPlan(null);
    try {
      const response = await fetch(`${props.apiBaseUrl}/connectors/plan`, {
        method: 'POST',
        headers: { authorization: `Bearer ${props.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), goal: goal.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? 'No se pudo preparar la integración.');
      setPlan(data as IntegrationPlan); setMessage('Plan preparado. Revísalo antes de autorizar la conexión.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo preparar la integración.');
    } finally { setPending(false); }
  }

  function applyPlan() {
    if (!plan) return;
    window.dispatchEvent(new CustomEvent('empre:connector-draft', { detail: plan }));
    setOpen(false);
    props.openIntegrations();
  }

  return <>
    <div className={`integration-fab-wrap ${open ? 'open' : ''}`}>
      {open && <div className="integration-fab-panel" role="dialog" aria-label="Guía de integración de EMPRE.IA">
        <div className="popover-head"><div><strong>Guía de integración</strong><small>EMPRE te acompaña paso a paso</small></div><button onClick={() => setOpen(false)} aria-label="Cerrar">×</button></div>
        <div className="guide-tabs"><button className={mode === 'guide' ? 'active' : ''} onClick={() => setMode('guide')}>Guía</button><button className={mode === 'prepare' ? 'active' : ''} onClick={() => setMode('prepare')} disabled={!props.canPrepare}>Preparar conexión</button></div>
        {mode === 'guide' ? <div className="guide-body">
          <p><strong>¿Quieres conectar tu página o sistema?</strong><br/>EMPRE no entra a una empresa sin autorización. El propietario decide cuándo preparar y activar una integración.</p>
          <ol>
            <li>Ten una API/Connector/SDK o webhook que permita operar el sistema.</li>
            <li>Usa una cuenta técnica con los permisos mínimos.</li>
            <li>Introduce la URL HTTPS del sistema.</li>
            <li>Deja que EMPRE prepare el plan de descubrimiento.</li>
            <li>Revisa lo que se podrá consultar o ejecutar.</li>
            <li>Autoriza la conexión y completa la autenticación.</li>
            <li>EMPRE verifica salud, identidad y capacidades antes de desbloquear operaciones.</li>
          </ol>
          <p className="guide-note">Una página pública sin API no basta para administrar sus datos. En ese caso EMPRE necesita un adaptador específico.</p>
          <div className="guide-actions"><button className="primary-button" onClick={() => props.openIntegrations()}>Abrir Integraciones</button><a className="ghost-button" href="/guides/EMPREIA-GUIA-INTEGRACION.pptx" target="_blank" rel="noreferrer">Abrir PowerPoint</a></div>
        </div> : <div className="guide-body">
          <p>Esta herramienta está disponible para el propietario o administrador. <strong>Preparar</strong> no da acceso automáticamente: genera un plan para que tú lo revises.</p>
          <label>URL del sistema<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://api.miempresa.com" /></label>
          <label>¿Qué quieres que haga EMPRE?<textarea rows={3} value={goal} onChange={(event) => setGoal(event.target.value)} /></label>
          <button className="primary-button" onClick={prepare} disabled={pending}>{pending ? 'Preparando…' : 'Preparar con EMPRE'}</button>
          {message && <div className="integration-plan-message">{message}</div>}
          {plan && <div className="integration-plan-result">
            <div className="plan-meta"><span>Plan {plan.planId}</span><strong>{plan.detectedKind === 'public-webpage' ? 'Página web pública' : 'API / Connector'}</strong></div>
            <p><strong>Descubrimiento:</strong> {plan.discoveryOrder.join(' → ')}</p>
            <p><strong>Autenticación sugerida:</strong> {plan.recommendedAuth.join(', ')}</p>
            <details><summary>Endpoints candidatos</summary><div className="plan-list">{plan.candidateEndpoints.map((item) => <code key={item}>{item}</code>)}</div></details>
            <details><summary>Reglas de seguridad</summary><ul>{plan.safetyRules.map((item) => <li key={item}>{item}</li>)}</ul></details>
            <button className="primary-button" onClick={applyPlan}>Usar este plan en Integraciones</button>
          </div>}
        </div>}
      </div>}
      <button className="integration-fab" onClick={() => setOpen((value) => !value)} aria-label="Abrir guía de integración">
        <img src="/empre-robot.png" alt="Guía EMPRE.IA" />
      </button>
      <span className="integration-fab-label">Guía</span>
    </div>
  </>;
}
