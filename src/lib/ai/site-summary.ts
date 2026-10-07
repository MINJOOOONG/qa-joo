import type { ProjectAnalysis } from "@/lib/analyzer/types";
import type { Locale } from "@/lib/i18n/config";

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const uniq = (values: string[]) => Array.from(new Set(values.map(clean).filter(Boolean)));

/** First prose paragraph of a README (skips headings, badges, code and lists). */
function readmeIntro(readme: string | null): string | null {
  if (!readme) return null;
  for (const block of readme.split(/\n\s*\n/)) {
    const text = block.trim();
    if (!text || /^(#|!\[|\[!\[|```|<|[-*|>]|\d+\.)/.test(text)) continue;
    const plain = clean(text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, ""));
    if (plain.length >= 20) return plain.slice(0, 240);
  }
  return null;
}

const list = (values: string[], max: number) => values.slice(0, max).join(", ");

/**
 * Korean particle for a word, chosen from the batchim (final consonant) of its last Hangul syllable.
 * Returns null when the word does not end in Hangul (Latin, digits…): the caller should then
 * rephrase without a particle, because the pronunciation is unknown.
 */
export function josa(word: string, kind: "이에요" | "은" | "과" | "으로" | "이"): string | null {
  const code = word.trim().charCodeAt(word.trim().length - 1) - 0xac00;
  if (Number.isNaN(code) || code < 0 || code > 11171) return null;
  const batchim = code % 28;
  switch (kind) {
    case "이에요":
      return batchim ? "이에요" : "예요";
    case "은":
      return batchim ? "은" : "는";
    case "과":
      return batchim ? "과" : "와";
    case "이":
      return batchim ? "이" : "가";
    case "으로":
      // ㄹ (8) takes 로 like an open syllable.
      return batchim && batchim !== 8 ? "으로" : "로";
  }
}

/**
 * Plain-language summary of what the analyzed site is, built from the crawl and repository
 * signals. Used when no AI provider is configured (the AI writes its own summary otherwise).
 */
export function heuristicSiteSummary(projectName: string, analysis: ProjectAnalysis, locale: Locale): string {
  const pages = analysis.app?.pages ?? [];
  const home = pages[0];
  const repo = analysis.repo;
  const what = clean(home?.description ?? "") || clean(repo?.description ?? "") || readmeIntro(repo?.readme ?? null);
  const screens = uniq(pages.flatMap((page) => page.headings)).filter((h) => h.length <= 60);
  const menus = uniq(pages.flatMap((page) => page.navLabels));
  const fields = uniq(pages.flatMap((page) => [...page.forms.flatMap((f) => f.fields), ...page.looseFields]).map((f) => f.label ?? f.placeholder ?? f.name ?? ""));
  const buttons = uniq(pages.flatMap((page) => [...page.buttons, ...page.forms.flatMap((f) => f.submitLabels)]));
  const title = clean(home?.title ?? "") || projectName;

  const sentences: string[] = [];
  if (locale === "en") {
    sentences.push(what ? `${title}: ${what}` : `${title} is the product connected to this project.`);
    if (screens.length) sentences.push(`Main screens: ${list(screens, 4)}.`);
    if (menus.length) sentences.push(`Menu: ${list(menus, 5)}.`);
    if (fields.length || buttons.length) {
      sentences.push(
        `Users interact through ${[fields.length ? `inputs such as ${list(fields, 3)}` : null, buttons.length ? `actions such as ${list(buttons, 3)}` : null].filter(Boolean).join(" and ")}.`,
      );
    }
    if (repo) {
      sentences.push(
        `The GitHub repository is a ${repo.framework ?? repo.language ?? "web"} project with ${repo.routes.length} page route(s) and ${repo.apiEndpoints.length} API endpoint(s).`,
      );
    }
  } else {
    if (what) {
      // The site's own description is usually English: quote it as a label instead of mixing it into a Korean sentence.
      sentences.push(`${title} · 사이트 소개 문구: "${what}"`);
    } else {
      const topic = josa(title, "은");
      sentences.push(topic ? `${title}${topic} 이 프로젝트에 연결된 서비스예요.` : `연결된 서비스: ${title}.`);
    }
    if (screens.length) {
      const value = list(screens, 4);
      const copula = josa(value, "이에요");
      sentences.push(copula ? `주요 화면은 ${value}${copula}.` : `주요 화면: ${value}.`);
    }
    if (menus.length) {
      const value = list(menus, 5);
      const particle = josa(value, "으로");
      sentences.push(particle ? `메뉴는 ${value}${particle} 구성돼 있어요.` : `메뉴: ${value}.`);
    }
    if (fields.length || buttons.length) {
      const parts = [fields.length ? `${list(fields, 3)} 같은 입력칸` : null, buttons.length ? `${list(buttons, 3)} 같은 버튼` : null].filter(
        (part): part is string => Boolean(part),
      );
      const joined = parts.length === 2 ? `${parts[0]}${josa(parts[0], "과")} ${parts[1]}` : parts[0];
      sentences.push(`사용자는 ${joined}${josa(joined, "으로")} 기능을 사용해요.`);
    }
    if (repo) {
      sentences.push(
        `깃허브 기준 ${repo.framework ?? repo.language ?? "웹"} 프로젝트이며, 페이지 라우트 ${repo.routes.length}개와 API ${repo.apiEndpoints.length}개가 있어요.`,
      );
    }
  }
  return sentences.join(" ").slice(0, 900);
}
