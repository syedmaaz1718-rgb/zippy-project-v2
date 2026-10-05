export const Stars = ({ value }) => <span className="stars">{'★'.repeat(Math.round(value))}{'☆'.repeat(5 - Math.round(value))}</span>
export const RatingBadge = ({ rating, count }) => rating ? <span className="rate">★ {rating} <small>({count})</small></span> : null
