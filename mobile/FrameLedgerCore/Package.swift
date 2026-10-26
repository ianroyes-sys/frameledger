// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "FrameLedgerCore", platforms: [.iOS(.v18), .macOS(.v15)], products: [.library(name: "FrameLedgerCore", targets: ["FrameLedgerCore"])], targets: [.target(name: "FrameLedgerCore"), .testTarget(name: "FrameLedgerCoreTests", dependencies: ["FrameLedgerCore"])])
