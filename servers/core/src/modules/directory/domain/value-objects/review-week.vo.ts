/**
 * The week an access review belongs to: Monday, UTC.
 *
 * A weekly obligation rather than a rolling window, so that "reviewed" means
 * the same thing to everyone looking at the back office on the same day, and a
 * review done on Friday does not quietly satisfy the following Wednesday.
 */
export class ReviewWeek {
  private constructor(readonly start: Date) {}

  static containing(now: Date): ReviewWeek {
    const start = new Date(now);
    const day = start.getUTCDay();
    start.setUTCDate(start.getUTCDate() - (day === 0 ? 6 : day - 1));
    start.setUTCHours(0, 0, 0, 0);
    return new ReviewWeek(start);
  }

  includes(at: Date): boolean {
    return at >= this.start;
  }
}
