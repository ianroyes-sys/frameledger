import XCTest

final class FrameLedgerUITests: XCTestCase {
  @MainActor private func capture(_ name: String) {
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }
  @MainActor func testNativeCreatorJourney() throws {
    let app = XCUIApplication()
    app.launch()
    XCTAssertTrue(app.staticTexts["DEMO · SYNTHETIC DATA"].waitForExistence(timeout: 10))
    capture("ios-overview")
    app.buttons["Try a purchase"].tap()
    XCTAssertTrue(app.staticTexts["After this purchase"].waitForExistence(timeout: 5))
    XCTAssertTrue(app.staticTexts["-$1,930.00"].exists)
    capture("ios-purchase-simulator")
    app.buttons["Done"].tap()
    app.buttons["Your reserves"].tap()
    XCTAssertTrue(app.staticTexts["Second shooter"].waitForExistence(timeout: 5))
    app.buttons["Done"].tap()
    app.tabBars.buttons["Projects"].tap()
    app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Johnson Wedding")).firstMatch
      .tap()
    XCTAssertTrue(app.staticTexts["Estimated project profit"].waitForExistence(timeout: 5))
    XCTAssertTrue(app.staticTexts["$2,630.00"].exists)
    capture("ios-project-detail")
    app.tabBars.buttons["Invoices"].tap()
    XCTAssertTrue(app.staticTexts["Johnson · Booking retainer"].waitForExistence(timeout: 5))
    app.tabBars.buttons["You"].tap()
    XCTAssertTrue(app.staticTexts["Live connection is not enabled"].waitForExistence(timeout: 5))
  }
}
