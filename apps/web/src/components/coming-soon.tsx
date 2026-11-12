import { Card } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return <><div className="page-heading"><h1>{title}</h1><p>{description}</p></div><Card className="empty-state gap-0"><Construction size={34} aria-hidden="true" /><h2>Estamos preparando este espaço</h2><p>Esta área ainda não está disponível. Por enquanto, você pode explorar a navegação e escolher a aparência em Preferências.</p></Card></>;
}
