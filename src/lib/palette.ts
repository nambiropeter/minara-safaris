/**
 * Ocean/Sunset palette, independent of light/dark: next-themes owns the
 * `.dark` class, this owns `data-palette` on <html>. Sunset is the default
 * (no attribute). `PALETTE_SCRIPT` runs inline in the root layout and applies
 * the saved choice before first paint, so there is no flash of the default.
 */
export const PALETTE_STORAGE_KEY = "minara-palette";

export const PALETTE_SCRIPT = `try{if(localStorage.getItem("${PALETTE_STORAGE_KEY}")==="ocean")document.documentElement.dataset.palette="ocean"}catch(e){}`;
