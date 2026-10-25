// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import Testing

/// The typed-intention rule (SEMANTICS.md §7.5), the Swift twin of `TypedIntentionRule.test.ts`.
@Suite("typed intention rule")
struct TypedIntentionRuleTests {
    private func gate(level: Int, requiresTypedIntention: Bool? = nil) -> Gate {
        Gate(
            level: level,
            pauseSeconds: 15,
            frictionType: .reflect,
            requiresTypedIntention: requiresTypedIntention ?? (level >= 2),
            requiresGuardianKey: false
        )
    }

    /// Text and what `Intl.Segmenter('en', {granularity: 'word'})` with `isWordLike` counts (Node 24, ICU).
    private static let agreeing: [(String, Int)] = [
        ("", 0),
        ("   ", 0),
        ("check messages", 2),
        ("check my messages", 3),
        ("  read ,  -  the   news !! ", 3),
        ("read — news …", 2),
        ("  reply TO a   message ", 4),
        ("reply to the message", 4),
        ("revisar el correo", 3),
        ("don't scroll now", 3),
        ("e.g. this one", 3),
        ("U.S.A. trip plan", 3),
        ("3.14 is pi", 3),
        ("1,000 words now", 3),
        ("check 2 emails", 3),
        ("📱📱📱", 0),
        ("check 📱 now", 2),
        ("👍🏽 ok go", 2),
        ("😀 smile 😀 smile", 2),
        ("한국어 문장 입니다", 3),
        ("foo_bar baz qux", 3),
        ("_ _ _", 0),
        ("½ ² Ⅻ", 1),
        ("café naïve résumé", 3),
        ("école ok fine", 3),
        ("a.b.c d e", 3),
        ("hello...world again", 3),
        ("#hashtag \u{40}user test", 3),
        ("C++ and C#", 3),
        ("x=1 y=2 z=3", 6),
        ("مرحبا بك في", 3),
        ("שלום עולם טוב", 3),
        ("Привет мир сегодня", 3),
        ("tab\u{9}separated\u{a}words", 3),
        ("a b c", 3),
        ("'quoted' \"words\" here", 3),
        ("(paren) [bracket] {brace}", 3),
        ("rock'n'roll music now", 3),
        ("l'homme est là", 3),
        ("über straße groß", 3),
        ("ΟΔΟΣ οδός δρόμος", 3),
        ("١٢٣ ٤٥٦ ٧٨٩", 3),
        ("a1 b2 c3", 3),
        ("...", 0),
        ("--- *** ///", 0),
        ("reply to one message", 4),
        ("check the opening hours", 4),
        ("look up one recipe", 4),
        ("it’s a test", 3),
        ("well-known fact here", 4),
        ("e-mail my boss", 4),
        ("state-of-the-art tool", 5),
        ("naïve café ☕ break", 3),
        ("2026-10-25 meeting notes", 5),
        ("10:30 call today", 4),
        ("v1.2.3 release notes", 3),
        ("user\u{40}example.org mail check", 4),
        ("https://example.org read later", 4),
        ("A&B test here", 4),
        ("ＡＢＣ fullwidth text", 3),
        ("cafe\u{301} combining mark", 3),
        ("word\u{200b}joiner zero width", 4),
        ("hyphen‑nonbreaking word", 3),
        ("emoji👍inside word", 3),
        ("$100 budget plan", 3),
        ("50% done now", 3),
        ("Mr. Smith arrives", 3),
        ("don’t stop now", 3),
        ("O’Neil is here", 3),
    ]

    /// Text, the TypeScript (ICU) count and the count here: dictionary-segmented
    /// scripts, where Apple's dictionaries differ from ICU's (`TypedIntentionRule.swift`).
    private static let diverging: [(String, Int, Int)] = [
        ("我想 看 新闻", 3, 4),
        ("日本語のテキスト", 3, 4),
        ("我想看新闻", 3, 4),
        ("カタカナ ひらがな 漢字", 6, 3),
        ("สวัสดีครับ วันนี้", 4, 3),
    ]

    @Test("from level two three words and a new text are required")
    func fromLevelTwoThreeWordsAndANewTextAreRequired() {
        #expect(minIntentionWords == 3)
        #expect(
            intentionRequirements(gate(level: 2)) == IntentionRequirements(minWords: 3, mustDifferFromPrevious: true))
        #expect(
            intentionRequirements(gate(level: 3)) == IntentionRequirements(minWords: 3, mustDifferFromPrevious: true))
    }

    @Test("below level two and on the extension gate nothing is typed")
    func belowLevelTwoAndOnTheExtensionGateNothingIsTyped() {
        let none = IntentionRequirements(minWords: 0, mustDifferFromPrevious: false)
        #expect(intentionRequirements(gate(level: 0)) == none)
        #expect(intentionRequirements(gate(level: 1)) == none)
        #expect(intentionRequirements(gate(level: 2, requiresTypedIntention: false)) == none)
        #expect(isIntentionAcceptable("", previous: "reply to a message", gate: gate(level: 1)))
    }

    @Test("two words are not enough and three are")
    func twoWordsAreNotEnoughAndThreeAre() {
        #expect(!isIntentionAcceptable("check messages", previous: nil, gate: gate(level: 2)))
        #expect(isIntentionAcceptable("check my messages", previous: nil, gate: gate(level: 2)))
    }

    @Test("punctuation and repeated spaces are not words")
    func punctuationAndRepeatedSpacesAreNotWords() {
        #expect(intentionWordCount("  read ,  -  the   news !! ") == 3)
        #expect(!isIntentionAcceptable("read \u{2014} news \u{2026}", previous: nil, gate: gate(level: 2)))
    }

    @Test("the same text as last time is rejected ignoring case and spacing")
    func theSameTextAsLastTimeIsRejectedIgnoringCaseAndSpacing() {
        let previous = "Reply to a message"
        #expect(!isIntentionAcceptable("  reply TO a   message ", previous: previous, gate: gate(level: 3)))
        #expect(!isIntentionAcceptable("\u{3000}reply to a\tmessage\u{feff}", previous: previous, gate: gate(level: 3)))
        #expect(isIntentionAcceptable("reply to the message", previous: previous, gate: gate(level: 3)))
    }

    @Test("a blank previous text imposes nothing")
    func aBlankPreviousTextImposesNothing() {
        #expect(isIntentionAcceptable("reply to a message", previous: "   ", gate: gate(level: 2)))
    }

    @Test("canonically equivalent spellings are different texts, as in typescript")
    func canonicallyEquivalentSpellingsAreDifferentTexts() {
        #expect(
            isIntentionAcceptable(
                "read the caf\u{e9} menu", previous: "read the cafe\u{301} menu", gate: gate(level: 2)))
    }

    @Test("word counts agree with the typescript segmenter")
    func wordCountsAgreeWithTheTypescriptSegmenter() {
        let mismatches = Self.agreeing.compactMap { text, expected -> String? in
            let count = intentionWordCount(text)
            return count == expected ? nil : "\(text.debugDescription): \(count) != \(expected)"
        }

        #expect(mismatches.isEmpty, "\(mismatches)")
    }

    /// Pins the known gap so a platform change shows up here.
    @Test("known divergences from the typescript segmenter")
    func knownDivergencesFromTheTypescriptSegmenter() {
        for (text, typescript, swift) in Self.diverging {
            #expect(intentionWordCount(text) == swift, "\(text) (TypeScript counts \(typescript))")
        }
    }
}
