'use client';

import { useState, type FormEvent } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3001';

export default function Login({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessType, setBusinessType] = useState<'legal_entity' | 'natural_person' | 'informal'>('legal_entity');
  const [legalRegistered, setLegalRegistered] = useState(true);
  const [legalName, setLegalName] = useState('');
  const [nit, setNit] = useState('');
  const [nitDv, setNitDv] = useState('');
  const [taxDeclaration, setTaxDeclaration] = useState<'obligated' | 'not_obligated' | 'unknown'>('unknown');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setMessage('');
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const body = mode === 'login'
        ? { email, password }
        : { companyName, name, email, password, countryCode: 'CO', businessType, legalRegistered, legalName: legalRegistered ? legalName : undefined, nit: legalRegistered ? nit : undefined, nitDv: legalRegistered ? nitDv : undefined, taxDeclaration };
      const response = await fetch(`${API}${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? 'No se pudo completar la operación.');
      if (mode === 'login') { localStorage.setItem('empre-token', data.token); onAuthenticated(); }
      else { setMessage('Empresa creada correctamente. Ahora inicia sesión.'); setMode('login'); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Error inesperado.'); }
    finally { setPending(false); }
  }

  return <main className="auth-screen"><div className="auth-glow"/><section className="auth-card"><div className="auth-brand"><div className="auth-robot-wrap"><img src="/empre-robot.png" alt="EMPRE.IA"/></div><span className="section-kicker">INTELIGENCIA EMPRESARIAL</span><h1>EMPRE<span>.IA</span></h1><p>Tu empresa, más inteligente.</p><div className="auth-trust"><span>✓ Núcleo por empresa</span><span>✓ Permisos y auditoría</span><span>✓ Sin inventar conexiones</span></div></div><div className="auth-panel"><span className="section-kicker">{mode === 'login' ? 'ACCESO SEGURO' : 'ALTA EMPRESARIAL'}</span><h2>{mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu empresa'}</h2><p>{mode === 'login' ? 'Entra al centro de inteligencia de tu empresa.' : 'Antes de activar el entorno, EMPRE registra el tipo de organización y la situación legal/tributaria declarada.'}</p><form onSubmit={submit} className="auth-form">
      {mode === 'register' && <>
        <label>Empresa<input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Nombre comercial" required/></label>
        <label>Tu nombre<input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre completo" required/></label>
        <div className="form-grid compact"><label>Tipo de organización<select value={businessType} onChange={e => setBusinessType(e.target.value as typeof businessType)}><option value="legal_entity">Empresa constituida / persona jurídica</option><option value="natural_person">Persona natural con actividad económica</option><option value="informal">Emprendimiento no constituido</option></select></label><label>¿Está registrada formalmente?<select value={legalRegistered ? 'yes' : 'no'} onChange={e => setLegalRegistered(e.target.value === 'yes')}><option value="yes">Sí</option><option value="no">No</option></select></label></div>
        {legalRegistered && <div className="legal-onboarding"><div className="legal-title">Datos para identificar la empresa</div><label>Razón social / nombre legal<input value={legalName} onChange={e => setLegalName(e.target.value)} placeholder="Nombre que figura en RUT / documento legal" required/></label><div className="form-grid compact"><label>NIT (sin DV)<input inputMode="numeric" value={nit} onChange={e => setNit(e.target.value.replace(/\D/g, ''))} placeholder="900123456" required/></label><label>DV<input inputMode="numeric" maxLength={1} value={nitDv} onChange={e => setNitDv(e.target.value.replace(/\D/g, '').slice(0, 1))} placeholder="7" required/></label></div></div>}
        <label>¿Tiene obligaciones tributarias?<select value={taxDeclaration} onChange={e => setTaxDeclaration(e.target.value as typeof taxDeclaration)}><option value="unknown">No lo sé todavía</option><option value="obligated">Tengo obligaciones tributarias</option><option value="not_obligated">No tengo obligaciones tributarias / no me aplican</option></select></label>
        <p className="legal-note">La declaración tributaria es información aportada por la empresa; no sustituye una verificación oficial. Para Colombia, la comprobación oficial del RUT/NIT se realizará mediante canales autorizados.</p>
      </>}
      <label>Correo electrónico<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@empresa.com" required/></label>
      <label>Contraseña<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" minLength={8} required/></label>
      {message && <p className="auth-message">{message}</p>}
      <button className="primary-button auth-submit" disabled={pending}>{pending ? 'Procesando…' : mode === 'login' ? 'Entrar a EMPRE.IA →' : 'Crear empresa →'}</button>
    </form><button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage(''); }}>{mode === 'login' ? 'Crear una empresa nueva' : 'Ya tengo una cuenta'}</button><a className="platform-entry" href="/platform">Acceso de propietario EMPRE.IA</a></div></section></main>;
}
