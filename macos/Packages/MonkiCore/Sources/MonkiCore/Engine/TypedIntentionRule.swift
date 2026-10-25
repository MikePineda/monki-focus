// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

// The typed-intention rule (SEMANTICS.md §7.5). When a gate requires a typed
// intention (from L2, never on the short extension gate) the text MUST have
// at least 3 words and MUST differ from the previous intention text of the
// group, compared after trimming, collapsing whitespace and lower-casing. A
// word is a word-like segment of Unicode default word boundaries (UAX #29),
// so punctuation and repeated spaces never count. Only the word count
// reaches `nextEscalation` (`commit.typedWords`); the text itself never
// leaves the device.
//
// Segments come from `String.enumerateSubstrings(options: .byWords)` without
// `.localized`, so boundaries never depend on the device language. It is
// backed by ICU like `Intl.Segmenter` in the TypeScript engine and agrees
// with it on every Latin, Cyrillic, Greek, Arabic, Hebrew, Korean, digit,
// emoji and punctuation case `TypedIntentionRuleTests` pins (`e.g.`,
// `U.S.A.`, `foo_bar`, `it’s` and `well-known` included). It was preferred
// to `NLTokenizer(unit: .word)`, which splits `e.g.`, `U.S.A.`, `foo_bar`
// and e-mail addresses into several words and keeps emoji as tokens. Known
// divergences are dictionary-segmented scripts, where Apple's dictionaries
// differ from ICU's: Chinese (`我想看新闻` and `我想 看 新闻`: 4 here, 3 in
// TypeScript), Japanese (`日本語のテキスト`: 4 here, 3; `カタカナ ひらがな 漢字`:
// 3 here, 6) and Thai (`สวัสดีครับ วันนี้`: 3 here, 4).

/// What a gate asks of a typed intention.
public struct IntentionRequirements: Hashable, Sendable {
    public let minWords: Int
    public let mustDifferFromPrevious: Bool

    public init(minWords: Int, mustDifferFromPrevious: Bool) {
        self.minWords = minWords
        self.mustDifferFromPrevious = mustDifferFromPrevious
    }
}

public let minIntentionWords = 3

public func intentionRequirements(_ gate: Gate) -> IntentionRequirements {
    gate.requiresTypedIntention
        ? IntentionRequirements(minWords: minIntentionWords, mustDifferFromPrevious: true)
        : IntentionRequirements(minWords: 0, mustDifferFromPrevious: false)
}

/// A segment is word-like when it holds a letter or a decimal or letter
/// number, the code points UAX #29 builds words from (ICU's `isWordLike`);
/// punctuation, symbols and emoji are not.
private func isWordLike(_ segment: Substring) -> Bool {
    segment.unicodeScalars.contains { scalar in
        let properties = scalar.properties
        return properties.isAlphabetic || properties.numericType == .decimal
            || properties.generalCategory == .letterNumber
    }
}

/// Words in `text`: word-like segments of the platform word segmenter.
public func intentionWordCount(_ text: String) -> Int {
    var count = 0
    text.enumerateSubstrings(in: text.startIndex..<text.endIndex, options: .byWords) { _, range, _, _ in
        if isWordLike(text[range]) { count += 1 }
    }
    return count
}

/// JavaScript's `\s` (`WhiteSpace` plus `LineTerminator`), for the same comparison as TypeScript.
private func isJavaScriptSpace(_ scalar: Unicode.Scalar) -> Bool {
    switch scalar.value {
    case 0x09...0x0D, 0x20, 0xA0, 0x1680, 0x2000...0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF: true
    default: false
    }
}

/// Trimmed, whitespace runs collapsed to one space, lower-cased without a locale.
private func comparable(_ text: String) -> String {
    let words = text.unicodeScalars.split(whereSeparator: isJavaScriptSpace)
    return words.map { String(String.UnicodeScalarView($0)) }.joined(separator: " ").lowercased()
}

public func isIntentionAcceptable(_ text: String, previous: String?, requirements: IntentionRequirements) -> Bool {
    if intentionWordCount(text) < requirements.minWords { return false }
    guard requirements.mustDifferFromPrevious, let previous, !comparable(previous).isEmpty else { return true }
    // Code units, as JavaScript compares: canonically equivalent spellings still count as different texts.
    return !comparable(text).utf16.elementsEqual(comparable(previous).utf16)
}

public func isIntentionAcceptable(_ text: String, previous: String?, gate: Gate) -> Bool {
    isIntentionAcceptable(text, previous: previous, requirements: intentionRequirements(gate))
}
