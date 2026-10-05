import type { Source } from './search';

export interface Persona {
  id: string;
  name: string;
  tagline: string;
  system: string;
}

/** Three deliberately different lenses on the same question. */
export const PERSONAS: Persona[] = [
  {
    id: 'factualist',
    name: 'Factualist',
    tagline: 'Direct and precise',
    system:
      'You are the Factualist on a council of experts. Give a direct, precise answer. ' +
      'State facts and numbers plainly, and say so if you are unsure. Be concise.',
  },
  {
    id: 'analyst',
    name: 'Analyst',
    tagline: 'Step by step',
    system:
      'You are the Analyst on a council of experts. Reason step by step through the question ' +
      'and its implications, then give your conclusion. Be concise.',
  },
  {
    id: 'skeptic',
    name: 'Skeptic',
    tagline: 'Looks for what could be wrong',
    system:
      'You are the Skeptic on a council of experts. Point out hidden assumptions, edge cases and ' +
      'likely mistakes in the obvious answer, then say what you would trust. Be concise.',
  },
];

export const CHAIR_SYSTEM =
  'You are the Chairperson of a council of experts. You are given a question and the council ' +
  "members' answers. Write the single best final answer: keep what the members agree on, " +
  'resolve disagreements by reasoning about which is more likely correct, and drop errors. ' +
  'Do not mention the council or the members. Be concise and well organized.';

export const QUICK_SYSTEM = 'You are a helpful, accurate assistant. Be concise.';

const GROUNDING =
  'Use the SOURCES below as your evidence. Cite them inline like [1]. If they do not answer ' +
  'the question, say so and answer from your own knowledge, marking it as such.';

export function formatSources(sources: Source[]): string {
  return sources.map((s) => `[${s.id}] ${s.title} (${s.url})\n${s.content}`).join('\n\n');
}

export function withSources(system: string, sources: Source[]): string {
  return sources.length ? `${system}\n\n${GROUNDING}\n\nSOURCES:\n${formatSources(sources)}` : system;
}

export function chairPrompt(question: string, answers: Array<{ name: string; text: string }>): string {
  const body = answers.map((a) => `### ${a.name}\n${a.text}`).join('\n\n');
  return `Question:\n${question}\n\nCouncil answers:\n\n${body}`;
}
