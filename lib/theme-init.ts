import { defaultThemeMode, themeStorageKey } from "@/lib/theme";

export const themeInitScript = `(function(){try{var t=localStorage.getItem("${themeStorageKey}");if(t==="light"||t==="dark"){document.documentElement.classList.remove("light","dark");document.documentElement.classList.add(t);document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export { defaultThemeMode };
