import { renderHook } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { createTestQueryClient } from '@/test/render';

import { makeItem } from './items.testutil';
import { useGalleryPaging, type UseGalleryPagingOptions } from './useGalleryPaging';

export interface FakePage {
  ids: string[];
  next?: number;
}

export type PageSource =
  Record<string, FakePage> | ((cursor: number | undefined) => FakePage | Promise<FakePage>);

type PagingTuning = Pick<UseGalleryPagingOptions<FakePage>, 'minItems' | 'minNewItems'>;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;
}

/** `useGalleryPaging` over fake pages (`'first'` key = the first page); `fetchPage` is a mock. */
export function setupPaging(pages: PageSource, tuning: PagingTuning = {}) {
  const fetchPage = jest.fn(async (cursor: number | undefined) => {
    const page = await (typeof pages === 'function'
      ? pages(cursor)
      : pages[String(cursor ?? 'first')]);
    if (!page) throw new Error(`no page ${cursor}`);
    return page;
  });
  return {
    fetchPage,
    render: () =>
      renderHook(
        () =>
          useGalleryPaging<FakePage>({
            queryKey: ['fake'],
            fetchPage,
            getItems: (page) => page.ids.map((id) => makeItem({ id })),
            getNextCursor: (page) => page.next,
            ...tuning,
          }),
        { wrapper },
      ),
  };
}

/** `n` ids `${prefix}0:0` … for building pages. */
export const ids = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}:0`);
