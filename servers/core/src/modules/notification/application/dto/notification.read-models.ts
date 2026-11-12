/** The tallies the overview is assembled from, straight out of SQL. */
export interface DeliveryTallies {
  recent: {
    channel: string;
    sent: number;
    delivered: number;
    failed: number;
  }[];
  queued: { channel: string; queued: number }[];
  suppressed: { channel: string; suppressed: number }[];
  series: { day: string; sent: number; failed: number }[];
}
