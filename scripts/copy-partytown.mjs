import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { copyLibFiles } from "@qwik.dev/partytown/utils";

const dest = "public/~partytown";
await copyLibFiles(dest);

const swPath = join(dest, "partytown-sw.js");
const swSource = readFileSync(swPath, "utf8");
const extractSandboxHtml = (source) => {
  const swIndex = source.indexOf("sw.html");
  if (swIndex === -1) return null;
  const respondIndex = source.indexOf("respondWith", swIndex);
  if (respondIndex === -1) return null;
  const openParen = source.indexOf("(", respondIndex);
  if (openParen === -1) return null;
  let i = openParen + 1;
  while (i < source.length && source[i] !== "'" && source[i] !== '"') i++;
  if (i >= source.length) return null;
  const quote = source[i];
  i++;
  let literal = "";
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === "\\" && i + 1 < source.length) {
      literal += ch + source[i + 1];
      i++;
      continue;
    }
    if (ch === quote) break;
    literal += ch;
  }
  if (i >= source.length) return null;
  return Function(`"use strict";return ${quote}${literal}${quote};`)();
};

const html = extractSandboxHtml(swSource);
if (!html) {
  throw new Error("partytown sandbox html not found in service worker");
}

writeFileSync(join(dest, "partytown-sandbox-sw.html"), html);
