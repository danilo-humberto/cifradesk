'use client';
import { toast } from 'sonner';

// Stable IDs replace repeated results instead of stacking duplicate messages.
export const feedback = {
  success(message: string) {
    toast.dismiss('feedback-error');
    return toast.success(message, { id: 'feedback-success' });
  },
  error(message: string) {
    toast.dismiss('feedback-success');
    return toast.error(message, { id: 'feedback-error', duration: Infinity });
  },
  clear() { toast.dismiss(); }
};
