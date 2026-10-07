/**
 * Messages are plain nested objects of strings. English defines the shape; Korean must provide
 * exactly the same keys (checked by the compiler). Placeholders use `{name}` and are filled with
 * `fmt()`.
 */
export type Messages = { [key: string]: string | Messages };

type SameShape<T> = { [K in keyof T]: T[K] extends string ? string : SameShape<T[K]> };

export function defineMessages<T extends Messages>(messages: { en: T; ko: SameShape<T> }): { en: T; ko: SameShape<T> } {
  return messages;
}

/** Fills `{name}` placeholders: fmt("{count}개 케이스", { count: 3 }) → "3개 케이스". */
export function fmt(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
