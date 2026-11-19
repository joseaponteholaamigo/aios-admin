// El tono de una insignia (las clases `badge` del panel viejo) y su texto. Puras: las usan las
// etiquetas de empresas y de personas.

export type Tone = '' | 'ok' | 'warn' | 'bad' | 'accent' | 'violet';
export type Label = { text: string; tone: Tone };

export const badgeClass = (tone: Tone) => (tone ? `badge ${tone}` : 'badge');
