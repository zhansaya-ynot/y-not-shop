import * as React from "react";
import { AnnouncementBar } from "./announcement-bar";
import { getAnnouncementMessages } from "@/server/data/content";

/**
 * Server wrapper that feeds the client AnnouncementBar with the live
 * messages from /admin/content/announcements. Falls back to the
 * component's built-in defaults when no active messages are configured,
 * so the bar is never blank. Rendered on every storefront page (server
 * trees only — client pages keep the bare <AnnouncementBar/> defaults).
 */
export async function AnnouncementBarServer({
  className,
}: {
  className?: string;
}): Promise<React.ReactElement> {
  const messages = await getAnnouncementMessages();
  return (
    <AnnouncementBar
      {...(messages.length > 0 ? { messages } : {})}
      {...(className ? { className } : {})}
    />
  );
}
