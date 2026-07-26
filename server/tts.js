// Free, keyless text-to-speech using Google Translate's public TTS
// endpoint (the same one the popular "gTTS" library wraps). No signup,
// no cost, no device voice packs required — the audio itself is
// generated server-side and just gets played back like any audio file.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MAX_CHUNK = 150;

function splitIntoChunks(text) {
  const sentences = text.split(/(?<=[.!?।])\s+/).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? current + " " + sentence : sentence;
    if (candidate.length <= MAX_CHUNK) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    if (sentence.length <= MAX_CHUNK) {
      current = sentence;
    } else {
      const words = sentence.split(" ");
      let piece = "";
      for (const word of words) {
        const next = piece ? piece + " " + word : word;
        if (next.length > MAX_CHUNK) {
          if (piece) chunks.push(piece);
          piece = word;
        } else {
          piece = next;
        }
      }
      current = piece;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text.slice(0, MAX_CHUNK)];
}

async function fetchChunkAudio(chunk, ttsCode) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${ttsCode}&client=tw-ob`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const buffer = Buffer.from(await res.arrayBuffer());
  const looksLikeAudio = res.ok && buffer.slice(0, 3).toString("hex") !== "3c68746d"; // not "<htm"
  if (!looksLikeAudio) {
    throw new Error(`TTS service rejected this text/language (HTTP ${res.status}).`);
  }
  return buffer;
}

async function synthesizeSpeech(text, ttsCode) {
  const chunks = splitIntoChunks(text.trim());
  const buffers = [];
  for (const chunk of chunks) {
    buffers.push(await fetchChunkAudio(chunk, ttsCode));
  }
  return Buffer.concat(buffers);
}

module.exports = { synthesizeSpeech };
