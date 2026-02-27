import { DomainException } from "../../../../shared/exceptions/domain.exception";

export class InstrumentNotFoundException extends DomainException {
  constructor(id: string) {
    super("INSTRUMENT_NOT_FOUND", `Instrument with id '${id}' not found`);
    this.name = "InstrumentNotFoundException";
  }
}

export class InstrumentAlreadyExistsException extends DomainException {
  constructor(ticker: string) {
    super(
      "INSTRUMENT_ALREADY_EXISTS",
      `Instrument with ticker '${ticker}' already exists`,
    );
    this.name = "InstrumentAlreadyExistsException";
  }
}

export class PortfolioNotFoundException extends DomainException {
  constructor(id: string) {
    super("PORTFOLIO_NOT_FOUND", `Portfolio with id '${id}' not found`);
    this.name = "PortfolioNotFoundException";
  }
}

export class PortfolioAccessDeniedException extends DomainException {
  constructor() {
    super(
      "PORTFOLIO_ACCESS_DENIED",
      "You do not have access to this portfolio",
    );
    this.name = "PortfolioAccessDeniedException";
  }
}

export class PositionNotFoundException extends DomainException {
  constructor(id: string) {
    super("POSITION_NOT_FOUND", `Position with id '${id}' not found`);
    this.name = "PositionNotFoundException";
  }
}

export class PositionAlreadyClosedException extends DomainException {
  constructor(id: string) {
    super(
      "POSITION_ALREADY_CLOSED",
      `Position with id '${id}' is already closed`,
    );
    this.name = "PositionAlreadyClosedException";
  }
}

export class InvalidAssetClassException extends DomainException {
  constructor(assetClass: string) {
    super("INVALID_ASSET_CLASS", `Invalid asset class: '${assetClass}'`);
    this.name = "InvalidAssetClassException";
  }
}

export class InvalidTimeframeException extends DomainException {
  constructor(timeframe: string) {
    super("INVALID_TIMEFRAME", `Invalid timeframe: '${timeframe}'`);
    this.name = "InvalidTimeframeException";
  }
}

export class MarketDataProviderException extends DomainException {
  constructor(message: string) {
    super("MARKET_DATA_PROVIDER_ERROR", message);
    this.name = "MarketDataProviderException";
  }
}
