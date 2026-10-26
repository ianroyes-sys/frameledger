import Testing

@testable import FrameLedgerCore

@Test func weddingScenario() throws {
  #expect(try Snapshot.demo.available() == 47_000)
  #expect(try Snapshot.demo.afterPurchase(240_000) == -193_000)
}
@Test func exactDecimalParsing() throws {
  #expect(try Money.cents("67.01") == 6701)
  #expect(try Money.cents("0.1") == 10)
  #expect(throws: MoneyError.self) { try Money.cents("1.001") }
  #expect(throws: MoneyError.self) { try Money.cents("-100") }
  #expect(throws: MoneyError.self) { try Money.cents("1e6") }
  #expect(throws: MoneyError.self) { try Money.cents("999999999999999999999") }
}
@Test func zeroNegativeAndOverflow() throws {
  #expect(try Snapshot(balance: 0, taxes: 0, gear: 0, contractors: 0, travel: 0).available() == 0)
  #expect(throws: MoneyError.self) { try Snapshot.demo.afterPurchase(0) }
  #expect(throws: MoneyError.self) { try Money.sum([Int64.max, 1]) }
  #expect(throws: MoneyError.self) {
    try Snapshot(balance: 0, taxes: Int64.min, gear: 0, contractors: 0, travel: 0).available()
  }
  #expect(Money.format(-123).contains("1.23"))
}
