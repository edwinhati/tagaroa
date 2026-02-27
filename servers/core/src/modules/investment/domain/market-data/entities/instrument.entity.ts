import type { AssetClass } from "../../value-objects/asset-class.value-object";

export class Instrument {
  constructor(
    public readonly id: string,
    public readonly ticker: string,
    public readonly name: string,
    public readonly assetClass: AssetClass,
    public readonly exchange: string | null,
    public readonly currency: string,
    public readonly metadata: Record<string, unknown> | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
