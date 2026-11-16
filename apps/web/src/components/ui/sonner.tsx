'use client';

// shadcn/ui Sonner (MIT), adapted to CifraDesk tokens and Portuguese labels.
import { useEffect, useRef, type CSSProperties } from 'react';
import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

export function Toaster() {
  const { theme = 'system' } = useTheme();
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = layer.current;
    // Native top layer when available; fixed positioning remains the fallback.
    if (element && typeof element.showPopover === 'function') {
      element.showPopover();
      return () => { if (element.matches(':popover-open')) element.hidePopover(); };
    }
  }, []);
  return <div ref={layer} popover="manual" className="toast-layer">
    <Sonner theme={theme as ToasterProps['theme']} className="toaster" position="bottom-right"
      containerAriaLabel="Notificações" hotkey={['altKey', 'KeyT']} closeButton expand visibleToasts={3}
      offset={24} mobileOffset={16} duration={6000}
      icons={{ success: <CircleCheck aria-hidden="true" />, info: <Info aria-hidden="true" />, warning: <TriangleAlert aria-hidden="true" />, error: <OctagonX aria-hidden="true" />, loading: <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> }}
      style={{ '--normal-bg': 'var(--surface)', '--normal-text': 'var(--foreground)', '--normal-border': 'var(--border)', '--border-radius': '14px' } as CSSProperties}
      toastOptions={{ closeButtonAriaLabel: 'Fechar notificação', classNames: { toast: 'cifra-toast', title: 'cifra-toast-title', description: 'cifra-toast-description', closeButton: 'cifra-toast-close' } }} />
  </div>;
}
