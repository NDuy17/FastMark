function pad2(value) {
  return String(value).padStart(2, '0');
}

export function formatPickupInputs(date) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    return { dateInput: '', timeInput: '' };
  }

  return {
    dateInput: `${pad2(value.getDate())}/${pad2(value.getMonth() + 1)}/${value.getFullYear()}`,
    timeInput: `${pad2(value.getHours())}:${pad2(value.getMinutes())}`,
  };
}

export function parsePickupInputs(dateInput, timeInput) {
  const dateMatch = String(dateInput || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const timeMatch = String(timeInput || '').trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }

  return parsed;
}

export function formatDistanceMeters(meters) {
  const value = Number(meters) || 0;
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace('.0', '')} km`;
  }
  return `${Math.round(value)} m`;
}

export function formatDurationSeconds(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.ceil(total / 60);
  if (minutes < 60) {
    return `${minutes} phút`;
  }
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return remain > 0 ? `${hours} giờ ${remain} phút` : `${hours} giờ`;
}
