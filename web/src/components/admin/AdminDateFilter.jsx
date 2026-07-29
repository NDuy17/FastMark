import DashboardDateRange from '../DashboardDateRange';

export default function AdminDateFilter({
  label = 'Thời gian',
  from,
  to,
  preset,
  onApply,
}) {
  return (
    <div className="admin-filter-field reservation-date-filter">
      <DashboardDateRange
        label={label}
        from={from}
        to={to}
        preset={preset}
        allowAll
        onApply={onApply}
      />
    </div>
  );
}
