'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';

type PaginationFooterProps = {
  label: string;
  page: number;
  total: number;
  size?: number;
  busy?: boolean;
  onChange: (page: number) => void;
};

export function PaginationFooter({ label, page, total, size = 20, busy = false, onChange }: PaginationFooterProps) {
  return (
    <Pagination aria-label={label} aria-busy={busy} className="justify-end border-t pt-4">
      <PaginationContent className="flex-wrap justify-end gap-2">
        <PaginationItem className="mr-2 text-sm text-muted-foreground">{total} {total === 1 ? 'registro' : 'registros'}</PaginationItem>
        <PaginationItem>
          <Button type="button" variant="outline" size="icon" aria-label="Anterior" disabled={busy || page <= 1} onClick={() => onChange(page - 1)}>
            <ChevronLeft aria-hidden="true" />
          </Button>
        </PaginationItem>
        <PaginationItem aria-current="page" className="px-2 text-sm font-medium tabular-nums">Página {page}</PaginationItem>
        <PaginationItem>
          <Button type="button" variant="outline" size="icon" aria-label="Próxima" disabled={busy || page * size >= total} onClick={() => onChange(page + 1)}>
            <ChevronRight aria-hidden="true" />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
