import Link from 'next/link';
export default function NotFound() { return <div className="empty-state"><h1>Página não encontrada</h1><p>Confira o endereço ou volte ao seu espaço de trabalho.</p><Link href="/">Voltar ao início</Link></div>; }
