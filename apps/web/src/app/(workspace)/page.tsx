import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowUpRight, Inbox, ListTodo, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  return <>
    <div className="page-heading"><p className="breadcrumb">Meu trabalho</p><h1>Seu trabalho, em um só lugar.</h1><p>Acompanhe o que você solicita e o que a equipe precisa de você.</p></div>
    <Card className="welcome-panel py-0" aria-labelledby="welcome-title">
      <div className="welcome-copy"><span className="section-icon"><ListTodo size={26} aria-hidden="true" /></span><h2 id="welcome-title">Um espaço para fazer acontecer.</h2><p>Em breve, suas tarefas e os chamados sob sua responsabilidade estarão aqui, com prioridades, conversas e prazos.</p><Button asChild variant="outline"><Link href="/settings">Personalizar aparência<ArrowUpRight aria-hidden="true" /></Link></Button></div>
      <div className="work-illustration" aria-hidden="true"><div className="illustration-window"><div className="illustration-dots"><i /><i /><i /></div><div className="illustration-line long" /><div className="illustration-task"><span /><i /></div><div className="illustration-task"><span /><i /></div><div className="illustration-task done"><span>✓</span><i /></div></div><span className="illustration-label">Cada demanda tem seu lugar.</span></div>
    </Card>
    <section className="workspace-guide" aria-labelledby="guide-title"><h2 id="guide-title">Conheça seu espaço</h2><div className="guide-links">
      <Link href="/requests"><Inbox aria-hidden="true" /><div><h3>Minhas solicitações</h3><p>O ponto de encontro dos pedidos que você faz.</p></div><ArrowUpRight className="guide-arrow" aria-hidden="true" /></Link>
      <Link href="/departments"><UsersRound aria-hidden="true" /><div><h3>Setores</h3><p>As demandas organizadas por equipe.</p></div><ArrowUpRight className="guide-arrow" aria-hidden="true" /></Link>
    </div></section>
    <p className="foundation-note">Esta é uma prévia da navegação. Chamados, tarefas e acesso por conta estarão disponíveis nas próximas entregas.</p>
  </>;
}
