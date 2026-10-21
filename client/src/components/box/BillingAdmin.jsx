// Gestão de mensalidades e regras de marcação (só gestores da box).
// O interruptor "Cobrar mensalidades" liga/desliga tudo o que é cobrança nesta box;
// as regras de marcação aplicam-se sempre.
import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Plus, X, Check, AlertTriangle, ShieldCheck, Clock, Search, Undo2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';

export const euros = (cents) => `${((cents || 0) / 100).toFixed(2).replace('.', ',')} €`;
const toCents = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) : null; };
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
export const PERIODS = { 1: 'Mensal', 3: 'Trimestral', 6: 'Semestral', 12: 'Anual' };
export const METHODS = { CASH: 'Numerário', MBWAY: 'MB Way', TRANSFER: 'Transferência', MULTIBANCO: 'Multibanco', CARD: 'Cartão', OTHER: 'Outro' };
export const STATUS_STYLE = {
    OK: { color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
    DUE: { color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
    OVERDUE: { color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
    EXEMPT: { color: '#64748b', bg: 'rgba(100,116,139,0.12)' }
};

const card = { background: 'var(--bg-color)', padding: '1.25rem', marginBottom: '1rem' };
const field = { width: '100%', padding: '0.65rem 0.8rem', borderRadius: '0.75rem', border: '2px solid var(--surface-color)', background: 'var(--surface-color)', color: 'var(--text-main)', fontWeight: 700, fontSize: '0.95rem' };
const label = { display: 'block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '0.3rem' };

function Toggle({ checked, onChange, disabled }) {
    return (
        <button role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} style={{
            width: '52px', height: '30px', borderRadius: '999px', border: 'none', cursor: disabled ? 'default' : 'pointer', flexShrink: 0,
            background: checked ? '#16a34a' : '#cbd5e1', position: 'relative', transition: 'background 0.2s ease'
        }}>
            <span style={{ position: 'absolute', top: '3px', left: checked ? '25px' : '3px', width: '24px', height: '24px', borderRadius: '50%', background: 'white', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgb(0 0 0 / 0.25)' }} />
        </button>
    );
}

export function StatusPill({ status }) {
    if (!status) return <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)' }}>Sem plano</span>;
    const st = STATUS_STYLE[status.code];
    return (
        <span style={{ fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: st.color, background: st.bg, padding: '3px 8px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
            {status.label}{status.code === 'OVERDUE' || status.code === 'DUE' ? ` · ${status.daysOverdue} d` : ''}
        </span>
    );
}

function RulesCard({ settings, onSave, saving }) {
    const [r, setR] = useState(settings.bookingRules);
    useEffect(() => setR(settings.bookingRules), [settings]);
    const num = (k, v) => setR(prev => ({ ...prev, [k]: v === '' ? null : Number(v) }));
    const rows = [
        { k: 'maxDaysAhead', label: 'Marcar com até', unit: 'dias de antecedência', min: 0, max: 60 },
        { k: 'minMinutesBefore', label: 'Marcações fecham', unit: 'min antes do início', min: 0, max: 1440 },
        { k: 'dailyLimit', label: 'Máximo de aulas por dia', unit: 'aulas', min: 1, max: 10 },
        { k: 'dailyLimitPerType', label: 'Máximo por tipo de aula por dia', unit: 'aulas', min: 1, max: 10 }
    ];
    return (
        <div className="premium-card" style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.3rem' }}>
                <Clock size={18} color="var(--primary-color)" />
                <h4 style={{ margin: 0, fontWeight: 900 }}>Regras de marcação</h4>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>Aplicam-se a todos os atletas da box, com ou sem mensalidades. Deixa vazio para não limitar. O prazo de cancelamento continua a ser definido em cada aula.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {rows.map(row => (
                    <div key={row.k} style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '0.75rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{row.label} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>({row.unit})</span></span>
                        <input type="number" min={row.min} max={row.max} placeholder="—" value={r?.[row.k] ?? ''} onChange={e => num(row.k, e.target.value)} style={{ ...field, textAlign: 'center' }} aria-label={row.label} />
                    </div>
                ))}
            </div>
            <button className="btn btn-primary" disabled={saving} onClick={() => onSave({ bookingRules: r })} style={{ height: '44px', marginTop: '1rem' }}>Guardar regras</button>
        </div>
    );
}

function PlanForm({ plan, classNames, onSave, onCancel }) {
    const [f, setF] = useState(() => ({
        name: plan?.name || '', price: plan ? String(plan.priceCents / 100).replace('.', ',') : '',
        periodMonths: plan?.periodMonths || 1, weeklyLimit: plan?.weeklyLimit ?? '', classTypes: plan?.classTypes || []
    }));
    const [typeInput, setTypeInput] = useState('');
    const allNames = [...new Set([...classNames, ...f.classTypes])];
    const toggleType = (n) => setF(p => ({ ...p, classTypes: p.classTypes.includes(n) ? p.classTypes.filter(x => x !== n) : [...p.classTypes, n] }));
    return (
        <div style={{ padding: '1rem', background: 'var(--surface-color)', borderRadius: '1rem', marginTop: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ gridColumn: '1 / -1' }}><label style={label}>Nome</label><input style={{ ...field, background: 'var(--bg-color)' }} value={f.name} maxLength={80} placeholder="Ex: Ilimitado, 2x por semana" onChange={e => setF({ ...f, name: e.target.value })} /></div>
                <div><label style={label}>Preço (€)</label><input style={{ ...field, background: 'var(--bg-color)' }} inputMode="decimal" value={f.price} placeholder="65,00" onChange={e => setF({ ...f, price: e.target.value })} /></div>
                <div><label style={label}>Periodicidade</label>
                    <select style={{ ...field, background: 'var(--bg-color)' }} value={f.periodMonths} onChange={e => setF({ ...f, periodMonths: Number(e.target.value) })}>
                        {Object.entries(PERIODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}><label style={label}>Aulas por semana (vazio = ilimitado)</label><input type="number" min="1" max="21" style={{ ...field, background: 'var(--bg-color)' }} value={f.weeklyLimit} placeholder="Ilimitado" onChange={e => setF({ ...f, weeklyLimit: e.target.value })} /></div>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label style={label}>Tipos de aula incluídos (nenhum = todos)</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                        {allNames.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ainda não há aulas com nome; escreve o nome abaixo.</span>}
                        {allNames.map(n => (
                            <button key={n} type="button" onClick={() => toggleType(n)} style={{
                                border: `1.5px solid ${f.classTypes.includes(n) ? 'var(--primary-color)' : 'var(--glass-border)'}`, borderRadius: '999px', padding: '0.3rem 0.7rem', cursor: 'pointer', font: 'inherit', fontSize: '0.78rem', fontWeight: 800,
                                background: f.classTypes.includes(n) ? 'var(--primary-color)' : 'var(--bg-color)', color: f.classTypes.includes(n) ? 'white' : 'var(--text-main)'
                            }}>{f.classTypes.includes(n) && '✓ '}{n}</button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <input style={{ ...field, background: 'var(--bg-color)' }} placeholder="Outro tipo de aula (nome exato)" value={typeInput} onChange={e => setTypeInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && typeInput.trim()) { toggleType(typeInput.trim()); setTypeInput(''); } }} />
                        <button type="button" className="chip" onClick={() => { if (typeInput.trim()) { toggleType(typeInput.trim()); setTypeInput(''); } }}><Plus size={16} /></button>
                    </div>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="chip" onClick={onCancel}>Cancelar</button>
                <button className="btn btn-primary" style={{ height: '42px' }} onClick={() => {
                    const priceCents = toCents(f.price);
                    if (!f.name.trim() || priceCents == null) return alert('Indica o nome e o preço do plano.');
                    onSave({ name: f.name.trim(), priceCents, periodMonths: f.periodMonths, weeklyLimit: f.weeklyLimit === '' ? null : Number(f.weeklyLimit), classTypes: f.classTypes });
                }}>Guardar plano</button>
            </div>
        </div>
    );
}

function MemberPanel({ boxId, member, plans, onChanged, onClose }) {
    const m = member.membership;
    const activePlans = plans.filter(p => p.active);
    const [planId, setPlanId] = useState(m?.planId || activePlans[0]?.id || '');
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [discount, setDiscount] = useState(m?.discountPct || 0);
    const [exempt, setExempt] = useState(!!m?.exempt);
    const [method, setMethod] = useState('MBWAY');
    const [amount, setAmount] = useState('');
    const [periods, setPeriods] = useState(1);
    const [payments, setPayments] = useState([]);
    const [busy, setBusy] = useState(false);

    const loadPayments = () => apiFetch(`boxes/${boxId}/billing/members/${member.id}/payments`).then(r => r.json()).then(d => setPayments(Array.isArray(d) ? d : [])).catch(() => {});
    useEffect(() => { if (m) loadPayments(); }, [member.id, m?.nextDueDate]);

    const call = async (path, method_, body) => {
        setBusy(true);
        try {
            const res = await apiFetch(path, { method: method_, body: body ? JSON.stringify(body) : undefined });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Erro');
            await onChanged();
            return data;
        } catch (err) {
            alert(err.message);
        } finally {
            setBusy(false);
        }
    };

    const suggested = m ? Math.round(m.plan.priceCents * (100 - (m.discountPct || 0)) / 100) * periods : 0;

    return (
        <div className="premium-card animate-slide-up" style={{ ...card, border: '2px solid var(--primary-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '0.5rem' }}>
                <div>
                    <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{member.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{member.email}</div>
                </div>
                <button className="chip" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
            </div>

            {m && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', padding: '0.85rem', background: 'var(--surface-color)', borderRadius: '1rem', marginBottom: '1rem' }}>
                    <div><div style={label}>Plano</div><div style={{ fontWeight: 900, fontSize: '0.9rem' }}>{m.plan.name}</div></div>
                    <div><div style={label}>Valor</div><div style={{ fontWeight: 900, fontSize: '0.9rem' }}>{m.exempt ? 'Isento' : euros(m.amountDueCents)}</div></div>
                    <div><div style={label}>Próximo</div><div style={{ fontWeight: 900, fontSize: '0.9rem' }}>{fmtDate(m.nextDueDate)}</div></div>
                    <div style={{ gridColumn: '1 / -1' }}><StatusPill status={m.status} /></div>
                </div>
            )}

            {m && !m.exempt && (
                <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontWeight: 900, marginBottom: '0.6rem' }}>Registar pagamento</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                        <div><label style={label}>Método</label>
                            <select style={field} value={method} onChange={e => setMethod(e.target.value)}>
                                {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                        <div><label style={label}>Períodos</label>
                            <select style={field} value={periods} onChange={e => setPeriods(Number(e.target.value))}>
                                {[1, 2, 3, 6, 12].map(n => <option key={n} value={n}>{n} × {PERIODS[m.plan.periodMonths]?.toLowerCase() || 'período'}</option>)}
                            </select>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}><label style={label}>Valor (€) — vazio usa {euros(suggested)}</label>
                            <input style={field} inputMode="decimal" placeholder={euros(suggested)} value={amount} onChange={e => setAmount(e.target.value)} />
                        </div>
                    </div>
                    <button className="btn btn-primary" disabled={busy} style={{ height: '46px', marginTop: '0.75rem', background: '#16a34a' }}
                        onClick={() => call(`boxes/${boxId}/billing/members/${member.id}/payments`, 'POST', { method, periods, amountCents: amount === '' ? null : toCents(amount) }).then(() => setAmount(''))}>
                        <Check size={18} /> Marcar como pago
                    </button>
                </div>
            )}

            <div style={{ fontWeight: 900, marginBottom: '0.6rem' }}>{m ? 'Alterar plano' : 'Atribuir plano'}</div>
            {activePlans.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cria primeiro um plano na secção "Planos".</p>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                        <div style={{ gridColumn: '1 / -1' }}><label style={label}>Plano</label>
                            <select style={field} value={planId} onChange={e => setPlanId(Number(e.target.value))}>
                                {activePlans.map(p => <option key={p.id} value={p.id}>{p.name} — {euros(p.priceCents)} ({PERIODS[p.periodMonths]})</option>)}
                            </select>
                        </div>
                        {!m && <div><label style={label}>Início (1.º pagamento)</label><input type="date" style={field} value={startDate} onChange={e => setStartDate(e.target.value)} /></div>}
                        <div><label style={label}>Desconto (%)</label><input type="number" min="0" max="100" style={field} value={discount} onChange={e => setDiscount(e.target.value)} /></div>
                        <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={exempt} onChange={e => setExempt(e.target.checked)} /> Isento de pagamento (ex.: treinador, staff)
                        </label>
                    </div>
                    <button className="btn btn-primary" disabled={busy} style={{ height: '44px', marginTop: '0.75rem' }}
                        onClick={() => call(`boxes/${boxId}/billing/members/${member.id}`, 'PUT', { planId, startDate, discountPct: Number(discount) || 0, exempt })}>
                        {m ? 'Guardar alterações' : 'Atribuir plano'}
                    </button>
                </>
            )}

            {m && payments.length > 0 && (
                <div style={{ marginTop: '1.25rem' }}>
                    <div style={{ fontWeight: 900, marginBottom: '0.5rem' }}>Histórico de pagamentos</div>
                    {payments.map((p, i) => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0', borderTop: '1px solid var(--surface-color)', fontSize: '0.82rem' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800 }}>{euros(p.amountCents)} · {METHODS[p.method] || p.method}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{fmtDate(p.periodStart)} → {fmtDate(p.periodEnd)} · pago a {new Date(p.paidAt).toLocaleDateString('pt-PT')}{p.recordedBy ? ` por ${p.recordedBy.name}` : ''}</div>
                            </div>
                            {i === 0 && (
                                <button className="chip" title="Anular este pagamento" disabled={busy} onClick={() => { if (window.confirm('Anular este pagamento? O vencimento volta para trás.')) call(`boxes/${boxId}/billing/payments/${p.id}`, 'DELETE'); }} style={{ padding: '0.35rem', color: '#dc2626' }}><Undo2 size={15} /></button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {m && (
                <button disabled={busy} onClick={() => { if (window.confirm(`Terminar o plano de ${member.name}? O histórico de pagamentos fica guardado.`)) call(`boxes/${boxId}/billing/members/${member.id}`, 'DELETE').then(onClose); }}
                    style={{ width: '100%', marginTop: '1rem', background: 'none', border: 'none', color: '#dc2626', fontWeight: 800, cursor: 'pointer', padding: '0.5rem' }}>
                    Terminar plano
                </button>
            )}
        </div>
    );
}

export default function BillingAdmin({ boxId, classes = [] }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [planForm, setPlanForm] = useState(null); // null | 'new' | plan
    const [filter, setFilter] = useState('all');
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState(null);

    const load = async () => {
        try {
            const res = await apiFetch(`boxes/${boxId}/billing`);
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || 'Erro ao carregar');
            setData(d);
            setError('');
        } catch (err) { setError(err.message); }
    };
    useEffect(() => { load(); }, [boxId]);

    const saveSettings = async (patch) => {
        setSaving(true);
        try {
            const res = await apiFetch(`boxes/${boxId}/billing/settings`, { method: 'PATCH', body: JSON.stringify(patch) });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || 'Erro ao guardar');
            setData(d);
        } catch (err) { alert(err.message); } finally { setSaving(false); }
    };

    const savePlan = async (body) => {
        const isNew = planForm === 'new';
        const res = await apiFetch(isNew ? `boxes/${boxId}/billing/plans` : `boxes/${boxId}/billing/plans/${planForm.id}`, { method: isNew ? 'POST' : 'PATCH', body: JSON.stringify(body) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) return alert(d.error || 'Erro ao guardar o plano');
        setPlanForm(null);
        load();
    };

    const classNames = useMemo(() => [...new Set(classes.map(c => c.name).filter(Boolean))], [classes]);
    const members = useMemo(() => {
        if (!data) return [];
        const q = query.trim().toLowerCase();
        return data.members.filter(m => {
            if (q && !(`${m.name} ${m.email}`.toLowerCase().includes(q))) return false;
            const code = m.membership?.status?.code;
            if (filter === 'overdue') return code === 'OVERDUE' || code === 'DUE';
            if (filter === 'none') return !m.membership;
            if (filter === 'ok') return code === 'OK' || code === 'EXEMPT';
            return true;
        });
    }, [data, filter, query]);

    if (error) return <div className="premium-card" style={card}><p style={{ color: '#dc2626', fontWeight: 700 }}>{error}</p></div>;
    if (!data) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>;

    const { settings, plans, summary } = data;
    const selected = data.members.find(m => m.id === selectedId);

    return (
        <div className="animate-fade">
            <div className="premium-card" style={{ ...card, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <CreditCard size={26} color={settings.billingEnabled ? '#16a34a' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900 }}>Cobrar mensalidades nesta box</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{settings.billingEnabled ? 'Ligado: os atletas veem o plano e os pagamentos em "A minha conta".' : 'Desligado: nada de cobranças aparece aos atletas. Os dados ficam guardados.'}</div>
                </div>
                <Toggle checked={settings.billingEnabled} disabled={saving} onChange={v => saveSettings({ billingEnabled: v })} />
            </div>

            <RulesCard settings={settings} onSave={saveSettings} saving={saving} />

            {settings.billingEnabled && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                        {[
                            { l: 'Recebido este mês', v: euros(summary.receivedThisMonthCents), s: `${summary.paymentsThisMonth} pagamentos`, c: '#16a34a' },
                            { l: 'Previsto por mês', v: euros(summary.expectedMonthlyCents), s: `${summary.withPlan} atletas com plano` },
                            { l: 'Em atraso', v: summary.overdue, s: `${summary.pending} pendentes`, c: summary.overdue ? '#dc2626' : undefined }
                        ].map(x => (
                            <div key={x.l} className="premium-card" style={{ background: 'var(--bg-color)', padding: '1rem' }}>
                                <div style={label}>{x.l}</div>
                                <div style={{ fontWeight: 900, fontSize: '1.3rem', color: x.c }}>{x.v}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{x.s}</div>
                            </div>
                        ))}
                    </div>

                    <div className="premium-card" style={card}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                            <ShieldCheck size={18} color="var(--primary-color)" />
                            <h4 style={{ margin: 0, fontWeight: 900, flex: 1 }}>Atrasos</h4>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 700 }}>Bloquear marcações a quem tem a mensalidade em atraso</span>
                            <Toggle checked={settings.billingBlockOverdue} disabled={saving} onChange={v => saveSettings({ billingBlockOverdue: v })} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '0.75rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Dias de tolerância após o vencimento <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>(fica "Pendente")</span></span>
                            <input key={settings.billingGraceDays} type="number" min="0" max="60" defaultValue={settings.billingGraceDays} onBlur={e => { if (Number(e.target.value) !== settings.billingGraceDays) saveSettings({ billingGraceDays: Number(e.target.value) }); }} style={{ ...field, textAlign: 'center' }} aria-label="Dias de tolerância" />
                        </div>
                    </div>

                    <div className="premium-card" style={card}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h4 style={{ margin: 0, fontWeight: 900, flex: 1 }}>Planos</h4>
                            {planForm !== 'new' && <button className="chip" onClick={() => setPlanForm('new')}><Plus size={15} /> Novo plano</button>}
                        </div>
                        {planForm === 'new' && <PlanForm classNames={classNames} onSave={savePlan} onCancel={() => setPlanForm(null)} />}
                        {plans.length === 0 && planForm !== 'new' && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ainda não há planos. Cria o primeiro (ex.: "Ilimitado — 65 € mensal").</p>}
                        {plans.map(p => (
                            <div key={p.id} style={{ borderTop: '1px solid var(--surface-color)', padding: '0.75rem 0', opacity: p.active ? 1 : 0.55 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 900 }}>{p.name} {!p.active && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(inativo)</span>}</div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                            {euros(p.priceCents)} · {PERIODS[p.periodMonths]} · {p.weeklyLimit ? `${p.weeklyLimit} aulas/semana` : 'Ilimitado'} · {p.classTypes?.length ? p.classTypes.join(', ') : 'Todas as aulas'}
                                        </div>
                                    </div>
                                    <button className="chip" onClick={() => setPlanForm(planForm?.id === p.id ? null : p)}>Editar</button>
                                    <button className="chip" onClick={async () => { await apiFetch(`boxes/${boxId}/billing/plans/${p.id}`, { method: 'PATCH', body: JSON.stringify({ active: !p.active }) }); load(); }}>{p.active ? 'Desativar' : 'Ativar'}</button>
                                </div>
                                {planForm?.id === p.id && <PlanForm plan={p} classNames={classNames} onSave={savePlan} onCancel={() => setPlanForm(null)} />}
                            </div>
                        ))}
                    </div>

                    {selected && <MemberPanel key={selected.id} boxId={boxId} member={selected} plans={plans} onChanged={load} onClose={() => setSelectedId(null)} />}

                    <div className="premium-card" style={card}>
                        <h4 style={{ margin: '0 0 0.75rem', fontWeight: 900 }}>Atletas</h4>
                        <div style={{ position: 'relative', marginBottom: '0.6rem' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                            <input style={{ ...field, paddingLeft: '2.2rem' }} placeholder="Procurar atleta" value={query} onChange={e => setQuery(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                            {[['all', 'Todos'], ['overdue', 'Em atraso / pendentes'], ['ok', 'Em dia'], ['none', 'Sem plano']].map(([k, l]) => (
                                <button key={k} onClick={() => setFilter(k)} style={{
                                    border: '1.5px solid var(--surface-color)', borderRadius: '999px', padding: '0.35rem 0.8rem', cursor: 'pointer', font: 'inherit', fontSize: '0.78rem', fontWeight: 800,
                                    background: filter === k ? 'var(--text-main)' : 'transparent', color: filter === k ? 'var(--bg-color)' : 'var(--text-muted)'
                                }}>{l}</button>
                            ))}
                        </div>
                        {members.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nenhum atleta neste filtro.</p>}
                        {members.map(m => (
                            <button key={m.id} onClick={() => { setSelectedId(m.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 0.25rem', border: 'none', borderTop: '1px solid var(--surface-color)',
                                background: selectedId === m.id ? 'var(--primary-glow)' : 'transparent', cursor: 'pointer', font: 'inherit', color: 'var(--text-main)', textAlign: 'left'
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                        {m.membership ? `${m.membership.plan.name} · ${m.membership.exempt ? 'isento' : euros(m.membership.amountDueCents)} · próximo ${fmtDate(m.membership.nextDueDate)}` : 'Sem plano atribuído'}
                                    </div>
                                </div>
                                <StatusPill status={m.membership?.status} />
                                {m.membership?.status?.code === 'OVERDUE' && <AlertTriangle size={16} color="#dc2626" />}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
