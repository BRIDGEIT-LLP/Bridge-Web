/** True if the link contains at least one "." that is followed by a character.
 *  Other "." characters may be trailing — we do not require a character after every ".". */
export function isValidMeetingLink(value: string): boolean {
  const link = value.trim();
  const dot = link.indexOf(".");
  return dot !== -1 && dot < link.length - 1;
}

export const MEETING_LINK_ERROR =
  'Link must include at least one "." with a character after it.';
