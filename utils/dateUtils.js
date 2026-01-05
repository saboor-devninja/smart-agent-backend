function parseLocalDateTime(dateString) {
  if (!dateString) return null;
  
  if (typeof dateString === 'string') {
    // Handle date-only strings (YYYY-MM-DD) from date input
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(Number);
      // Create date at local midnight (00:00:00) to preserve the exact date
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    }
    
    if (dateString.includes('T')) {
      if (dateString.endsWith('Z')) {
        const date = new Date(dateString);
        const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60 * 1000));
        return localDate;
      }
      if (dateString.includes('+') || (dateString.match(/-/g) || []).length > 2) {
        const date = new Date(dateString);
        const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60 * 1000));
        return localDate;
      }
      const parts = dateString.split('T');
      if (parts.length === 2) {
        const [datePart, timePart] = parts;
        const [year, month, day] = datePart.split('-').map(Number);
        const timeParts = timePart.split(':');
        const hours = parseInt(timeParts[0]) || 0;
        const minutes = parseInt(timeParts[1]) || 0;
        const seconds = timeParts[2] ? parseInt(timeParts[2]) : 0;
        return new Date(year, month - 1, day, hours, minutes, seconds);
      }
    }
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  }
  
  if (dateString instanceof Date) {
    return dateString;
  }
  
  return null;
}

function formatDateForStorage(date) {
  if (!date) return null;
  
  if (typeof date === 'string') {
    return parseLocalDateTime(date);
  }
  
  if (date instanceof Date) {
    return date;
  }
  
  return null;
}

function formatDateForResponse(date) {
  if (!date) return null;
  
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // For date-only fields (like availableFrom), return YYYY-MM-DD format
    // Check if it's a date at midnight (likely a date-only field)
    if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) {
      return `${year}-${month}-${day}`;
    }
    
    // Otherwise return with time
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }
  
  if (typeof date === 'string') {
    return date;
  }
  
  return null;
}

function getLocalDateTimeString(date) {
  return formatDateForResponse(date);
}

module.exports = {
  parseLocalDateTime,
  formatDateForStorage,
  formatDateForResponse,
  getLocalDateTimeString,
};

