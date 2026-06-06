import type { BriefingSections } from './types';

function hasNewsItems(sections: BriefingSections | null | undefined): boolean {
  return Boolean(sections?.news?.ok && sections.news.data?.by_topic?.some((topic) => topic.items.length > 0));
}

function hasTrendItems(sections: BriefingSections | null | undefined): boolean {
  return Boolean(sections?.trends?.ok && sections.trends.data?.trends?.length);
}

export function shouldReuseBriefing(sections: BriefingSections | null | undefined): boolean {
  return hasNewsItems(sections) && hasTrendItems(sections);
}
