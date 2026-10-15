import { NotificationItem } from "./notification-item";
import type { NotificationList } from "./model";
type Props = {
  id: string;
  open?: boolean;
  count: number;
  page: number;
  data?: NotificationList;
  pending: boolean;
  error: boolean;
  mutating: boolean;
  mutationError: boolean;
  onRetry: () => void;
  onRead: (id: string) => void;
  onReadAll: () => void;
  onPage: (page: number) => void;
};
export function NotificationPanel({
  id,
  open = true,
  count,
  page,
  data,
  pending,
  error,
  mutating,
  mutationError,
  onRetry,
  onRead,
  onReadAll,
  onPage,
}: Props) {
  return (
    <section
      id={id}
      className="notification-panel motion-surface"
      data-motion={open ? "open" : "closed"}
      aria-hidden={!open}
      inert={!open}
      aria-label="Сповіщення"
      tabIndex={-1}
    >
      <div className="notification-panel-heading">
        <h2>Сповіщення</h2>
        {count > 0 && (
          <button
            type="button"
            className="notification-read"
            disabled={mutating}
            onClick={onReadAll}
          >
            Позначити всі як прочитані
          </button>
        )}
      </div>
      {mutationError && (
        <p className="notification-state" role="alert">
          Не вдалося позначити сповіщення. Спробуйте ще раз.
        </p>
      )}
      {pending ? (
        <p className="notification-state" role="status">
          Завантаження сповіщень…
        </p>
      ) : error ? (
        <div className="notification-state" role="alert">
          <p>Не вдалося завантажити сповіщення.</p>
          <button
            type="button"
            className="button secondary compact"
            onClick={onRetry}
          >
            Спробувати ще раз
          </button>
        </div>
      ) : (
        data && (
          <>
            {data.data.length ? (
              <ul className="notification-list">
                {data.data.map((item) => (
                  <NotificationItem
                    key={item.id}
                    item={item}
                    pending={mutating}
                    onRead={onRead}
                  />
                ))}
              </ul>
            ) : (
              <p className="notification-state">Сповіщень поки немає</p>
            )}
            {(data.meta.pages > 1 || page > 1) && (
              <div
                className="notification-pagination"
                aria-label="Сторінки сповіщень"
              >
                <button
                  className="button secondary compact"
                  type="button"
                  disabled={page <= 1 || mutating}
                  onClick={() => onPage(page - 1)}
                >
                  Попередні
                </button>
                <span>
                  {page} / {Math.max(page, data.meta.pages)}
                </span>
                <button
                  className="button secondary compact"
                  type="button"
                  disabled={page >= data.meta.pages || mutating}
                  onClick={() => onPage(page + 1)}
                >
                  Наступні
                </button>
              </div>
            )}
          </>
        )
      )}
    </section>
  );
}
