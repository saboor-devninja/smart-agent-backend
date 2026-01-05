function parseNestedFormData(body) {
  const parsed = {};
  
  for (const [key, value] of Object.entries(body)) {
    // Handle array-based nested data: utilities[0][utilityType]
    const arrayMatch = key.match(/^([^\[]+)\[(\d+)\]\[([^\]]+)\]$/);
    if (arrayMatch) {
      const parentKey = arrayMatch[1];
      const index = parseInt(arrayMatch[2]);
      const childKey = arrayMatch[3];
      
      if (!parsed[parentKey]) {
        parsed[parentKey] = [];
      }
      if (!parsed[parentKey][index]) {
        parsed[parentKey][index] = {};
      }
      parsed[parentKey][index][childKey] = value;
    }
    // Handle simple nested data: bankAccount[accountHolderName]
    else if (key.includes('[') && key.includes(']')) {
      const match = key.match(/^([^\[]+)\[([^\]]+)\]$/);
      if (match) {
        const parentKey = match[1];
        const childKey = match[2];
        
        if (!parsed[parentKey]) {
          parsed[parentKey] = {};
        }
        parsed[parentKey][childKey] = value;
      } else {
        parsed[key] = value;
      }
    } else {
      parsed[key] = value;
    }
  }
  
  return parsed;
}

module.exports = { parseNestedFormData };

