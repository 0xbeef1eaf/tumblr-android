import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useToggleLike } from '@/features/auth';
import { MasonryGallery } from '@/features/gallery';
import { MessageView } from '@/features/tag/MessageView';
import { normalizeTag } from '@/features/tag/normalizeTag';
import { TagEmptyState } from '@/features/tag/TagEmptyState';
import { useTaggedPosts } from '@/features/tag/useTaggedPosts';
import { useTheme } from '@/ui/theme';

import { FilterRow, type KindFilter } from './FilterRow';
import { IdleView } from './IdleView';
import { SearchBar } from './SearchBar';
import { useSearchHistoryStore, type SearchHistoryEntry } from './searchHistoryStore';
import { Suggestions } from './Suggestions';
import { useSuggestions, type Suggestion } from './useSuggestions';

/** `idle` (no text) → `typing` (suggestions) → `results` (tag gallery). */
export type SearchMode = 'idle' | 'typing' | 'results';

export function searchMode(text: string, submittedTag: string | null): SearchMode {
  if (text.trim() === '') return 'idle';
  return submittedTag !== null ? 'results' : 'typing';
}

function Results({ tag }: { tag: string }) {
  const [kind, setKind] = useState<KindFilter>('all');
  const paging = useTaggedPosts(tag);
  const onLike = useToggleLike();
  const failed = paging.error != null && paging.items.length === 0 && !paging.isLoading;
  return (
    <View style={styles.flex} testID="search-results">
      <FilterRow value={kind} onChange={setKind} />
      {failed ? (
        <MessageView
          icon="cloud-offline-outline"
          title="Couldn't load results"
          actionLabel="Retry"
          onAction={() => void paging.refetch()}
        />
      ) : (
        <MasonryGallery
          items={paging.items}
          isLoading={paging.isLoading}
          isFetchingNextPage={paging.isFetchingNextPage}
          hasNextPage={paging.hasNextPage}
          onEndReached={() => void paging.fetchNextPage()}
          onRefresh={() => void paging.refetch()}
          isRefetching={paging.isRefetching}
          kindFilter={kind}
          onLike={onLike}
          emptyState={<TagEmptyState tag={tag} />}
        />
      )}
    </View>
  );
}

export function SearchScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const addHistory = useSearchHistoryStore((state) => state.add);
  const removeHistory = useSearchHistoryStore((state) => state.remove);
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [submittedTag, setSubmittedTag] = useState<string | null>(null);
  const suggestions = useSuggestions(debounced);
  const mode = searchMode(text, submittedTag);

  const changeText = useCallback((next: string) => {
    setText(next);
    // Editing after a search returns to the suggestions state.
    setSubmittedTag(null);
  }, []);

  const showTag = useCallback(
    (value: string) => {
      const tag = normalizeTag(value);
      if (!tag) return;
      addHistory('tag', tag);
      setText(tag);
      setDebounced(tag);
      setSubmittedTag(tag);
    },
    [addHistory],
  );

  const openBlog = useCallback(
    (name: string) => {
      addHistory('blog', name);
      router.push(`/blog/${encodeURIComponent(name)}`);
    },
    [addHistory, router],
  );

  const pickEntry = useCallback(
    (type: SearchHistoryEntry['type'], value: string) =>
      type === 'blog' ? openBlog(value) : showTag(value),
    [openBlog, showTag],
  );

  const select = (suggestion: Suggestion) => {
    if (suggestion.kind === 'tag') showTag(suggestion.value);
    else if (suggestion.kind === 'blog') openBlog(suggestion.value);
    else pickEntry(suggestion.entryType, suggestion.value);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <SearchBar
        value={text}
        onChangeText={changeText}
        onDebouncedChange={setDebounced}
        onSubmit={showTag}
        onClear={() => {
          changeText('');
          setDebounced('');
        }}
      />
      {mode === 'idle' ? <IdleView onPick={(entry) => pickEntry(entry.type, entry.value)} /> : null}
      {mode === 'typing' ? (
        <Suggestions
          suggestions={suggestions}
          onSelect={select}
          onRemoveRecent={(s) => removeHistory(s.entryType, s.value)}
        />
      ) : null}
      {mode === 'results' && submittedTag !== null ? <Results tag={submittedTag} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
