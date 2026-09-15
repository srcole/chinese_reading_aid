import { pinyin, addTraditionalDict } from 'pinyin-pro';
import TraditionalDict from '@pinyin-pro/data/traditional';

addTraditionalDict(TraditionalDict);

export function splitText(text, mode = 'sentences') {
  const paragraphs = text.replace(/\r\n?/g, '\n').split('\n').map(line => line.trim()).filter(Boolean);
  if (mode === 'newlines') return paragraphs;
  return paragraphs.flatMap(line => (line.match(/[^。！？!?…]+(?:[。！？!?…]+[”’」』）)]*)?|[。！？!?…]+[”’」』）)]*/gu) || []).map(part => part.trim()).filter(Boolean));
}

// Blank translation lines are intentional placeholders and preserve alignment.
export function translations(text) {
  return text.trim() ? text.replace(/\r\n?/g, '\n').split('\n').map(line => line.trim()) : [];
}

export function englishSentences(text) {
  const paragraph = text.replace(/\s+/gu, ' ').trim();
  if (!paragraph) return [];
  const segments = typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter('en', { granularity: 'sentence' }).segment(paragraph), item => item.segment.trim())
    : (paragraph.match(/[\s\S]+?(?:[.!?…]+["”’')\]]*(?=\s|$)|$)/gu) || []).map(item => item.trim());
  const result = [];
  for (const segment of segments.filter(Boolean)) {
    // Sentence segmenters can treat titles and initials as complete sentences.
    if (result.length && /\b(?:Mr|Mrs|Ms|Dr|Prof|Rev|Capt|St|[A-Z])\.$/u.test(result.at(-1))) {
      result[result.length - 1] += ` ${segment}`;
    } else result.push(segment);
  }
  return result;
}

export function matchTranslations(text, chineseCount, mode = 'auto') {
  const byLine = translations(text);
  if (mode === 'newlines') return { items: byLine, method: 'lines' };
  // An already matching line count (including blank placeholders) is intentional.
  if (mode === 'auto' && (byLine.length === chineseCount || byLine.includes(''))) {
    return { items: byLine, method: 'lines' };
  }
  const bySentence = englishSentences(text);
  if (mode === 'sentences' || (byLine.length === 1 && chineseCount > 1)
      || (bySentence.length > 1 && Math.abs(bySentence.length - chineseCount) < Math.abs(byLine.length - chineseCount))) {
    return { items: bySentence, method: 'sentences' };
  }
  return { items: byLine, method: 'lines' };
}

export function makeLines(text, english, mode, englishMode = 'auto') {
  const chineseLines = splitText(text, mode);
  const { items: supplied } = matchTranslations(english, chineseLines.length, englishMode);
  return chineseLines.map((chinese, index) => ({
    chinese,
    pinyin: pinyin(chinese, { traditional: true }),
    english: supplied[index] || '',
  }));
}
