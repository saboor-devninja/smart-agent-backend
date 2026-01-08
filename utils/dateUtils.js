function parseLocalDateTime(dateString) {
  if (!dateString) return null;
  
  if (typeof dateString === 'string') {
    // Handle date-only strings (YYYY-MM-DD) from date input
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(Number);
      // Create date at UTC midnight to preserve the exact date regardless of server timezone
      return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    }
    
    if (dateString.includes('T')) {
      // Parse date-time strings and preserve exact values using UTC
      const parts = dateString.split('T');
      if (parts.length === 2) {
        const [datePart, timePart] = parts;
        const [year, month, day] = datePart.split('-').map(Number);
        
        // Remove timezone info if present (Z, +HH:MM, -HH:MM)
        let cleanTimePart = timePart;
        if (cleanTimePart.endsWith('Z')) {
          cleanTimePart = cleanTimePart.slice(0, -1);
        } else {
          const tzIndex = cleanTimePart.search(/[+-]\d{2}:?\d{2}/);
          if (tzIndex !== -1) {
            cleanTimePart = cleanTimePart.substring(0, tzIndex);
          }
        }
        
        const timeParts = cleanTimePart.split(':');
        const hours = parseInt(timeParts[0]) || 0;
        const minutes = parseInt(timeParts[1]) || 0;
        const seconds = timeParts[2] ? parseInt(timeParts[2].split('.')[0]) : 0;
        
        // Use UTC to preserve exact date/time without timezone conversion
        return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
      }
    }
    
    // For other date strings, parse and convert to UTC if needed
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    
    // If it's a valid date, ensure we're working with UTC values
    // Extract UTC components and create a new UTC date to avoid timezone shifts
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    ));
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
    // Use UTC methods to get the exact date without timezone conversion
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    
    // For date-only fields (like startDate, endDate, availableFrom), return YYYY-MM-DD format
    // Check if it's a date at UTC midnight (likely a date-only field)
    if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0) {
      return `${year}-${month}-${day}`;
    }
    
    // Otherwise return with time
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    
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

