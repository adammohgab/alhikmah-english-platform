import schoolLogoUrl from "@/shared/assets/logo.png";

/**
 * School logo switch.
 *
 * The copyright for the Al Hikmah Private School logo is not cleared yet, so the logo is hidden.
 * To show it again everywhere, set this to `true`. The image file stays at
 * `shared/assets/logo.png`, and every spot that used it renders it again unchanged.
 */
export const SHOW_SCHOOL_LOGO = false;

/** The logo image URL, or `null` while the logo is hidden. */
export const SCHOOL_LOGO_SRC: string | null = SHOW_SCHOOL_LOGO ? schoolLogoUrl : null;
