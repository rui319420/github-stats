import { ApiError } from "./apiError";

const MAX_ACTIVE_AGGREGATIONS = 4;
let activeAggregations = 0;

export async function withAggregationSlot<T>(work: () => Promise<T>): Promise<T> {
  if (activeAggregations >= MAX_ACTIVE_AGGREGATIONS) {
    throw new ApiError("現在集計が混み合っています。少し待って再試行してください。", 429, 5);
  }
  activeAggregations++;
  try {
    return await work();
  } finally {
    activeAggregations--;
  }
}
