// swift-tools-version: 6.0
// SPDX-License-Identifier: AGPL-3.0-or-later

import PackageDescription

// Thin adapters between MonkiCore and macOS: system clocks, GRDB storage,
// the activity watchers and, in later work packages, notifications and app blocking.
let package = Package(
    name: "MonkiPlatform",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "MonkiPlatform", targets: ["MonkiPlatform"])
    ],
    dependencies: [
        .package(path: "../MonkiCore"),
        // Pinned exactly: the Xcode project resolves packages on its own (its
        // Package.resolved lives in the ignored .xcodeproj), so a range would
        // let CI and local builds drift. Bump here and in Package.resolved.
        .package(url: "https://github.com/groue/GRDB.swift.git", exact: "7.11.1"),
    ],
    targets: [
        .target(
            name: "MonkiPlatform",
            dependencies: [
                .product(name: "MonkiCore", package: "MonkiCore"),
                .product(name: "GRDB", package: "GRDB.swift"),
            ]
        ),
        .testTarget(
            name: "MonkiPlatformTests",
            dependencies: [
                "MonkiPlatform",
                .product(name: "MonkiCore", package: "MonkiCore"),
                .product(name: "MonkiCoreTesting", package: "MonkiCore"),
                .product(name: "GRDB", package: "GRDB.swift"),
            ]
        ),
    ],
    swiftLanguageModes: [.v6]
)
