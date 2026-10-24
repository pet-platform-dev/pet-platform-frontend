import { metricLabels, type Dashboard } from "./model";
export function DashboardCards({ data }: { data: Dashboard }) {
  return (
    <dl className="admin-metrics">
      {(Object.keys(metricLabels) as (keyof Dashboard["metrics"])[]).map(
        (key) => (
          <div className="dashboard-card admin-metric" key={key}>
            <dt>{metricLabels[key].title}</dt>
            <dd>{new Intl.NumberFormat("uk-UA").format(data.metrics[key])}</dd>
            <dd className="muted admin-metric-description">
              {metricLabels[key].description}
            </dd>
          </div>
        ),
      )}
    </dl>
  );
}
