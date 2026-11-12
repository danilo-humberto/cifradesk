import { SessionControls } from '@/components/session-controls';
import { Card } from '@/components/ui/card';
import { ThemeSettings } from '@/components/theme-settings';
export const metadata = { title: 'Preferências' };
export default function Settings() { return <><div className="page-heading"><h1>Preferências</h1><p>Deixe seu espaço de trabalho confortável para você.</p></div><Card className="settings-panel gap-0" aria-labelledby="appearance-title"><h2 id="appearance-title">Aparência</h2><ThemeSettings /></Card><SessionControls /></>; }

