import type { MediaMeta } from "./media";

export type MessageBody = {
  text: string;
  files?: MediaMeta[];
};

export function encodeMessageBody(body: MessageBody): string {
  if (!body.files?.length) return body.text;
  return JSON.stringify({ v: 1, text: body.text, files: body.files });
}

export function decodeMessageBody(content: string): MessageBody {
  if (!content.startsWith("{")) return { text: content };
  try {
    const o = JSON.parse(content) as {
      v?: number;
      text?: string;
      files?: MediaMeta[];
    };
    if (o?.v === 1) {
      return { text: o.text ?? "", files: o.files };
    }
  } catch {
    /* plain text */
  }
  return { text: content };
}
