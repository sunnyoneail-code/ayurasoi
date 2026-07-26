// Shared language config. Kept free — every code here works with the
// free Lingva Translate service for text, except "yue" (Cantonese):
// Google Translate's exposed language list (which Lingva wraps) has no
// distinct Cantonese text target, so its written text reuses "zh"
// (Mandarin). Audio is different: Google's TTS voices DO have a distinct
// Cantonese voice (verified — "yue" produces genuinely different audio
// than "zh"), so narration for Cantonese is real, not a Mandarin reuse.
//
// ttsCode is null where the free TTS engine has no voice at all for that
// language (verified — Odia currently returns an error, not audio).

const LANGUAGES = [
  { code: "en", label: "English", speech: "en-US", translateCode: "en", ttsCode: "en" },
  { code: "hi", label: "हिन्दी", speech: "hi-IN", translateCode: "hi", ttsCode: "hi" },
  { code: "bn", label: "বাংলা", speech: "bn-IN", translateCode: "bn", ttsCode: "bn" },
  { code: "mr", label: "मराठी", speech: "mr-IN", translateCode: "mr", ttsCode: "mr" },
  { code: "ta", label: "தமிழ்", speech: "ta-IN", translateCode: "ta", ttsCode: "ta" },
  { code: "te", label: "తెలుగు", speech: "te-IN", translateCode: "te", ttsCode: "te" },
  { code: "kn", label: "ಕನ್ನಡ", speech: "kn-IN", translateCode: "kn", ttsCode: "kn" },
  { code: "or", label: "ଓଡ଼ିଆ", speech: "or-IN", translateCode: "or", ttsCode: null },
  { code: "gu", label: "ગુજરાતી", speech: "gu-IN", translateCode: "gu", ttsCode: "gu" },
  { code: "pa", label: "ਪੰਜਾਬੀ", speech: "pa-IN", translateCode: "pa", ttsCode: "pa" },
  { code: "fr", label: "Français", speech: "fr-FR", translateCode: "fr", ttsCode: "fr" },
  { code: "es", label: "Español", speech: "es-ES", translateCode: "es", ttsCode: "es" },
  { code: "de", label: "Deutsch", speech: "de-DE", translateCode: "de", ttsCode: "de" },
  { code: "ru", label: "Русский", speech: "ru-RU", translateCode: "ru", ttsCode: "ru" },
  { code: "zh", label: "中文（普通话）", speech: "zh-CN", translateCode: "zh", ttsCode: "zh" },
  { code: "yue", label: "粵語（廣東話）", speech: "zh-HK", translateCode: "zh", ttsCode: "yue" }
];

module.exports = { LANGUAGES };
