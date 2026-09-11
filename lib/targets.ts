/**
 * Coverage inventory. One entry per page/view the client wants covered.
 * The report keys 1:1 to this list so coverage is auditable.
 */
export type Target = { name: string; path: string; smokeOnly?: boolean };

export const TARGETS: Target[] = [
  { name: 'home', path: '/' },
];

/**
 * Width sweep. Named breakpoints plus the in-between widths where layouts
 * actually break (1024 = iPad landscape / small laptop; 834 = iPad portrait).
 */
export const WIDTHS = [320, 360, 390, 480, 600, 768, 834, 1024, 1280, 1440, 1920];
