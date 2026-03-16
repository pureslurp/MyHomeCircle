const CATEGORY_STYLES = {
  Work:       'bg-amber-100 text-amber-700',
  Family:     'bg-emerald-100 text-emerald-700',
  Friends:    'bg-violet-100 text-violet-700',
  Gym:        'bg-red-100 text-red-700',
  Restaurant: 'bg-orange-100 text-orange-700',
  Shopping:   'bg-cyan-100 text-cyan-700',
  Healthcare: 'bg-pink-100 text-pink-700',
}

export const CATEGORY_COLORS = {
  Work:       '#d97706',
  Family:     '#059669',
  Friends:    '#7c3aed',
  Gym:        '#dc2626',
  Restaurant: '#ea580c',
  Shopping:   '#0891b2',
  Healthcare: '#db2777',
  default:    '#6b7280',
}

export function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.default
}

export default function CategoryBadge({ category }) {
  const style = CATEGORY_STYLES[category] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${style}`}>
      {category || 'Uncategorized'}
    </span>
  )
}
