import Foundation

public enum MoneyError: Error { case invalidAmount, overflow }
public enum Money {
  public static func cents(_ input: String) throws -> Int64 {
    let clean = input.trimmingCharacters(in: .whitespacesAndNewlines)
    guard clean.range(of: "^[0-9]{1,9}(\\.[0-9]{1,2})?$", options: .regularExpression) != nil else {
      throw MoneyError.invalidAmount
    }
    let parts = clean.split(separator: ".")
    guard let whole = Int64(parts[0]) else { throw MoneyError.invalidAmount }
    let fraction =
      parts.count == 2
      ? Int64(String(parts[1]).padding(toLength: 2, withPad: "0", startingAt: 0))! : 0
    return whole * 100 + fraction
  }
  public static func sum(_ values: [Int64]) throws -> Int64 {
    try values.reduce(0) { total, next in
      let (value, overflow) = total.addingReportingOverflow(next)
      guard !overflow else { throw MoneyError.overflow }
      return value
    }
  }
  public static func format(_ cents: Int64) -> String {
    (Decimal(cents) / 100).formatted(.currency(code: "USD"))
  }
}
public struct Snapshot: Sendable {
  public let balance: Int64, taxes: Int64, gear: Int64, contractors: Int64, travel: Int64
  public init(balance: Int64, taxes: Int64, gear: Int64, contractors: Int64, travel: Int64) {
    self.balance = balance
    self.taxes = taxes
    self.gear = gear
    self.contractors = contractors
    self.travel = travel
  }
  public func available() throws -> Int64 {
    guard [taxes, gear, contractors, travel].allSatisfy({ $0 >= 0 }) else {
      throw MoneyError.invalidAmount
    }
    return try Money.sum([balance, -taxes, -gear, -contractors, -travel])
  }
  public func afterPurchase(_ amount: Int64) throws -> Int64 {
    guard amount > 0 else { throw MoneyError.invalidAmount }
    return try Money.sum([available(), -amount])
  }
  public static let demo = Snapshot(
    balance: 160_000, taxes: 40_000, gear: 16_000, contractors: 45_000, travel: 12_000)
}
