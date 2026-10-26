import { staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";

export const C = {
  indigo: "#24336e",
  deep: "#121a3d",
  deeper: "#0b1029",
  cloth: "#e4e8f3",
  gold: "#f0b440",
  goldDeep: "#d9981c",
  soft: "#afc0f5",
  white: "#ffffff",
};

export const DISPLAY = "Young Serif";
export const BODY = "Atkinson Hyperlegible";

let loaded = false;
export const loadFonts = () => {
  if (loaded) return;
  loaded = true;
  loadFont({ family: DISPLAY, url: staticFile("fonts/young-serif-latin-400-normal.woff2"), weight: "400" });
  loadFont({ family: BODY, url: staticFile("fonts/atkinson-hyperlegible-latin-400-normal.woff2"), weight: "400" });
  loadFont({ family: BODY, url: staticFile("fonts/atkinson-hyperlegible-latin-700-normal.woff2"), weight: "700" });
};
