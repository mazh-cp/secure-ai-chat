// Category color mapping for attack types in dark mode
export function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    prompt_attack: '#A855F7',
    crime: '#F87171',
    credit_card: '#60A5FA',
    iban_code: '#34D399',
    address: '#22D3EE',
    us_social_security_number: '#3B82F6',
    profanity: '#FACC15',
    hate: '#FB923C',
    sexual: '#F472B6',
    violence: '#DC2626',
  }

  // Try exact match first
  const lowerCategory = category.toLowerCase()
  if (colorMap[lowerCategory]) {
    return colorMap[lowerCategory]
  }

  // Try partial matches
  for (const [key, color] of Object.entries(colorMap)) {
    if (lowerCategory.includes(key) || key.includes(lowerCategory)) {
      return color
    }
  }

  // Default fallback
  return '#EF4444' // flagged color
}
