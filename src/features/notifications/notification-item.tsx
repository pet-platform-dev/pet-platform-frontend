import Link from "next/link";
import {
  notificationDate,
  notificationBody,
  safeNotificationHref,
  type Notification,
} from "./model";
export function NotificationItem({
  item,
  pending,
  onRead,
}: {
  item: Notification;
  pending: boolean;
  onRead: (id: string) => void;
}) {
  const href = safeNotificationHref(item.href);
  return (
    <li
      className={`notification-item${(item.readAt ? "" : " is-unread") + (item.type === "PET_REMINDER_DUE" ? " is-pet-reminder" : "")}`}
    >
      <div className="notification-item-heading">
        <strong>
          {href ? (
            <Link
              href={href}
              onClick={() => {
                if (!item.readAt) onRead(item.id);
              }}
            >
              {item.title}
            </Link>
          ) : (
            item.title
          )}
        </strong>
        {!item.readAt && (
          <span className="notification-unread">Непрочитане</span>
        )}
      </div>
      <p>{notificationBody(item)}</p>
      <div className="notification-item-footer">
        <time dateTime={item.createdAt}>
          {notificationDate(item.createdAt)}
        </time>
        {!item.readAt && (
          <button
            type="button"
            disabled={pending}
            className="notification-read"
            onClick={() => onRead(item.id)}
          >
            Позначити як прочитане
          </button>
        )}
      </div>
    </li>
  );
}
