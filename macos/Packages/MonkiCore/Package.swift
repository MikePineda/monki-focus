// swift-tools-version: 6.0
// SPDX-License-Identifier: AGPL-3.0-or-later

import PackageDescription

// Pure domain for the macOS app: decision engine, analytics and bridge
// contracts. No AppKit, no SwiftUI, no I/O and no implicit clock; every
// time read goes through an injected `Clock` or `MonotonicClock`.
let package = Package(
    name: "MonkiCore",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "MonkiCore", targets: ["MonkiCore"]),
        // Fakes and shared-fixture access for the test targets of every package and the app.
        .library(name: "MonkiCoreTesting", targets: ["MonkiCoreTesting"]),
    ],
    targets: [
        .target(name: "MonkiCore"),
        .target(name: "MonkiCoreTesting", dependencies: ["MonkiCore"]),
        .testTarget(name: "MonkiCoreTests", dependencies: ["MonkiCore", "MonkiCoreTesting"]),
    ],
    swiftLanguageModes: [.v6]
)
