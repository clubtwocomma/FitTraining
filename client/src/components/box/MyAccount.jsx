// "A minha conta" do atleta: plano, estado da mensalidade, próximo pagamento,
// histórico e as regras de marcação da box. Só aparece com mensalidades ligadas;
// as regras também são mostradas na lista de aulas (BookingRulesNote).
import React from 'react';
import { CreditCard, AlertTriangle, CalendarClock, ListChecks } from 'lucide-react';
import { euros, PERIODS, METHODS, StatusPill, STATUS_STYLE } from './BillingAdmin';

const fmtDate = (d) => new Date(d).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const rulesList = (rules) => {
    if (!rules) return [];
    const out = [];
    if (rules.maxDaysAhead != null) out.push(`Podes marcar aulas com até ${rules.maxDaysAhead} ${rules.maxDaysAhead === 1 ? 'dia' : 'dias'} de antecedência.`);
    if (rules.minMinutesBefore != null) out.push(`As marcações fecham ${rules.minMinutesBefore} minutos antes de a aula começar.`);
    if (rules.dailyLimit != null) out.push(`Máximo de ${rules.dailyLimit} ${rules.dailyLimit === 1 ? 'aula' : 'aulas'} por dia.`);
    if (rules.dailyLimitPerType != null) out.push(`Máximo de ${rules.dailyLimitPerType} ${rules.dailyLimitPerType === 1 ? 'aula' : 'aulas'} do mesmo tipo por dia.`);
    return out;
};

export function BookingRulesNote({ account }) {
    const rules = rulesList(account?.bookingRules);
    const plan = account?.billingEnabled ? account?.membership?.plan : null;
    if (!rules.length && !plan) return null;
    return (
        <details className="premium-card" style={{ background: 'var(--bg-color)', padding: '0.9rem 1.1rem', marginBottom: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', listStyle: 'none' }}>
                <ListChecks size={16} color="var(--primary-color)" /> Regras de marcação
                {plan && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Plano: {plan.name}</span>}
            </summary>
            <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.2rem', fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--text-main)' }}>
                {rules.map(r => <li key={r}>{r}</li>)}
                {plan?.weeklyLimit != null && <li>O teu plano inclui {plan.weeklyLimit} aulas por semana.</li>}
                {plan?.classTypes?.length > 0 && <li>Aulas incluídas no teu plano: {plan.classTypes.join(', ')}.</li>}
            </ul>
        </details>
    );
}

export default function MyAccount({ account }) {
    if (!account?.billingEnabled) return null;
    const m = account.membership;
    const rules = rulesList(account.bookingRules);

    if (!m) {
        return (
            <div className="premium-card" style={{ background: 'var(--bg-color)', padding: '1.5rem', textAlign: 'center' }}>
                <CreditCard size={36} color="var(--text-muted)" style={{ marginBottom: '0.75rem' }} />
                <div style={{ fontWeight: 900, marginBottom: '0.3rem' }}>Ainda não tens plano atribuído</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Fala com a tua box para escolheres o plano de mensalidade.</p>
            </div>
        );
    }

    const st = STATUS_STYLE[m.status.code];
    const late = m.status.code === 'OVERDUE' || m.status.code === 'DUE';
    return (
        <div className="animate-fade">
            <div className="premium-card" style={{ padding: '1.5rem', marginBottom: '1rem', background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>O teu plano</div>
                    <StatusPill status={m.status} />
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '1rem' }}>{m.plan.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    <div><div style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.6, textTransform: 'uppercase' }}>Valor</div><div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{m.exempt ? 'Isento' : euros(m.amountDueCents)}</div></div>
                    <div><div style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.6, textTransform: 'uppercase' }}>Pagamento</div><div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{PERIODS[m.plan.periodMonths]}</div></div>
                    <div><div style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.6, textTransform: 'uppercase' }}>Frequência</div><div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{m.plan.weeklyLimit ? `${m.plan.weeklyLimit}×/semana` : 'Ilimitado'}</div></div>
                </div>
                {!m.exempt && (
                    <div style={{ marginTop: '1.1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <CalendarClock size={18} style={{ opacity: 0.8 }} />
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                            {late ? 'Venceu a ' : 'Próximo pagamento: '}<b>{fmtDate(m.nextDueDate)}</b>
                            {m.status.code === 'OK' && m.status.daysUntilDue != null && <span style={{ opacity: 0.7 }}> · daqui a {m.status.daysUntilDue} {m.status.daysUntilDue === 1 ? 'dia' : 'dias'}</span>}
                        </span>
                    </div>
                )}
            </div>

            {late && (
                <div className="premium-card" style={{ padding: '1rem 1.25rem', marginBottom: '1rem', background: st.bg, border: `1.5px solid ${st.color}`, display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <AlertTriangle size={20} color={st.color} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        A tua mensalidade {m.status.code === 'OVERDUE' ? 'está em atraso' : 'venceu'} há {m.status.daysOverdue} {m.status.daysOverdue === 1 ? 'dia' : 'dias'}. Regulariza o pagamento com a box.
                        {account.blockOverdue && m.status.code === 'DUE' && <> Depois de {account.graceDays} dias de atraso deixas de poder marcar aulas.</>}
                        {account.blockOverdue && m.status.code === 'OVERDUE' && <> Enquanto estiver em atraso não podes marcar aulas.</>}
                    </div>
                </div>
            )}

            <div className="premium-card" style={{ background: 'var(--bg-color)', padding: '1.25rem', marginBottom: '1rem' }}>
                <h4 style={{ margin: '0 0 0.6rem', fontWeight: 900 }}>Aulas que podes marcar</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {m.plan.classTypes?.length
                        ? m.plan.classTypes.map(t => <span key={t} style={{ fontSize: '0.78rem', fontWeight: 800, padding: '0.3rem 0.7rem', borderRadius: '999px', background: 'var(--primary-glow)', color: 'var(--primary-color)' }}>{t}</span>)
                        : <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Todas as aulas da box.</span>}
                </div>
                {rules.length > 0 && (
                    <>
                        <h4 style={{ margin: '1rem 0 0.4rem', fontWeight: 900 }}>Regras da box</h4>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.84rem', lineHeight: 1.6 }}>{rules.map(r => <li key={r}>{r}</li>)}</ul>
                    </>
                )}
            </div>

            <div className="premium-card" style={{ background: 'var(--bg-color)', padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.4rem', fontWeight: 900 }}>Pagamentos</h4>
                {!account.payments?.length && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Ainda sem pagamentos registados.</p>}
                {account.payments?.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderTop: '1px solid var(--surface-color)', gap: '0.5rem' }}>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{fmtDate(p.periodStart)} → {fmtDate(p.periodEnd)}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{METHODS[p.method] || p.method} · pago a {new Date(p.paidAt).toLocaleDateString('pt-PT')}</div>
                        </div>
                        <div style={{ fontWeight: 900, color: '#16a34a', whiteSpace: 'nowrap' }}>{euros(p.amountCents)}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
