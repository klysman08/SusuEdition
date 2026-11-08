import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";

export const SUPPORTED_LANGUAGES = [
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "en", label: "English" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const resources = {
  "pt-BR": { translation: ptBR },
  en: { translation: en },
} as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "pt-BR",
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    load: "currentOnly",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "susu.language",
      caches: ["localStorage"],
      // pt, pt-PT, pt-BR → pt-BR · en-US, en-GB → en
      convertDetectedLanguage: (lng: string) => (lng.startsWith("pt") ? "pt-BR" : lng.startsWith("en") ? "en" : lng),
    },
  });

document.documentElement.lang = i18n.resolvedLanguage ?? "pt-BR";
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
