import { formatDate } from '../../utils/format';

export default function AdminTimeline({ events = [], title = 'Tiến trình' }) {
  if (!events.length) return null;

  return (
    <article className="admin-panel">
      <div className="admin-panel-head">
        <h2>{title}</h2>
      </div>
      <div className="admin-panel-body">
        <ol className="admin-timeline">
          {events.map((event, index) => (
            <li
              key={`${event.label}-${index}`}
              className={`admin-timeline-item${event.tone ? ` tone-${event.tone}` : ''}`}
            >
              <span className="admin-timeline-dot" aria-hidden="true" />
              <div>
                <strong>{event.label}</strong>
                {event.at ? <p>{formatDate(event.at)}</p> : null}
                {event.detail ? <p>{event.detail}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}
