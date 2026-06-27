import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { listNotifications } from "@/lib/db/notification";
import { NotificationList, type NotificationItem } from "./NotificationList";

// /account/notifications — in-app notification feed (M8b / §3).
export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await listNotifications(user.id);

  const initial: NotificationItem[] = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    url: n.url,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-pine">Notifications</h2>
          <p className="mt-0.5 text-sm text-ink/55">Updates on your saved searches and listings.</p>
        </div>
        <Link href="/account" className="text-sm text-brass hover:underline">
          ← Back to account
        </Link>
      </div>

      <NotificationList initial={initial} />
    </div>
  );
}
