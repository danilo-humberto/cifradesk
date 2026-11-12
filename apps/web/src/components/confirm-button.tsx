'use client';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
export function ConfirmButton({ label, description, onConfirm, disabled }: { label: string; description: string; onConfirm: () => void | Promise<void>; disabled?: boolean }) {
  return <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" disabled={disabled}>{label}</Button></AlertDialogTrigger>
    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{label}?</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => void onConfirm()}>Confirmar</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>;
}
