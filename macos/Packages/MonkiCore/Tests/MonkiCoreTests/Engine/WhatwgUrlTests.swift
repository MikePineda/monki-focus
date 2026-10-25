// SPDX-License-Identifier: AGPL-3.0-or-later

import Testing

@testable import MonkiCore

/// The Swift WHATWG parser against `new URL(text)` of Node 24 (the TypeScript
/// engine's parser): each row is `(text, hostname, pathname)` as Node printed
/// them, nil for a parse failure. Hosts Node turns into IPv4 or IPv6
/// addresses fail here instead; §2 step 5 rejects both alike. User info is
/// written with `\u{40}` so the text never looks like an address.
@Suite("WHATWG URL")
struct WhatwgUrlTests {
    private static let node24: [(String, String?, String?)] = [
        ("https://a.com/a^b|c'd", "a.com", "/a%5Eb|c'd"),
        ("https://a.com/\u{7f}\u{1}x", "a.com", "/%7F%01x"),
        ("https://a.com/%zz%4", "a.com", "/%zz%4"),
        ("https://a.com/a/b/../../..", "a.com", "/"),
        ("https://a.com/a/%2E%2e", "a.com", "/"),
        ("https://a.com/a/.%2E/b", "a.com", "/b"),
        ("https://a.com/a/./", "a.com", "/a/"),
        ("https://a.com/a/..", "a.com", "/"),
        ("https://a.com?x", "a.com", "/"),
        ("https://a.com#x", "a.com", "/"),
        ("https://a.com\\?x", "a.com", "/"),
        (" \u{1}https://a.com/x \u{2}", "a.com", "/x"),
        ("https://a.c\tom/x\ny", "a.com", "/xy"),
        ("https://a.com:8080/x", "a.com", "/x"),
        ("https://a.com:abc/", nil, nil),
        ("https://a.com:65535/", "a.com", "/"),
        ("https://a.com:65536/", nil, nil),
        ("https://user:pw\u{40}a.com/x", "a.com", "/x"),
        ("https://a\u{40}b\u{40}c.com/x", "c.com", "/x"),
        ("https://a b.com/", nil, nil),
        ("https://a%20b.com/", nil, nil),
        ("https://a<b.com/", nil, nil),
        ("https://a%25.com/", nil, nil),
        ("https://a..com/", "a..com", "/"),
        ("https://.a.com/", ".a.com", "/"),
        ("https://a.com./", "a.com.", "/"),
        ("https://A.COM/", "a.com", "/"),
        ("https://%C3%BC.de/", "xn--tda.de", "/"),
        ("https://ü.de/", "xn--tda.de", "/"),
        ("https://a.%zz/", nil, nil),
        ("https://xn--bcher-kva.example/", "xn--bcher-kva.example", "/"),
        ("https://bücher.example/katalog", "xn--bcher-kva.example", "/katalog"),
        ("https://a.0x1/", nil, nil),
        ("https://a.1/", nil, nil),
        ("https://a.b1/", "a.b1", "/"),
        ("https://x", "x", "/"),
        ("https://", nil, nil),
        ("https:///a.com", "a.com", "/"),
        ("https:a.com/x", "a.com", "/x"),
        ("http:\\\\a.com\\x", "a.com", "/x"),
        ("https://a.com/é😀", "a.com", "/%C3%A9%F0%9F%98%80"),
        ("https://a.com/a b", "a.com", "/a%20b"),
        ("https://a.com/[x]", "a.com", "/[x]"),
        ("https://a.com/x\"y", "a.com", "/x%22y"),
        ("https://a.com/{x}", "a.com", "/%7Bx%7D"),
        ("https://a.com/`x", "a.com", "/%60x"),
        ("https://a.com/x;y", "a.com", "/x;y"),
        ("https://a.com/~x", "a.com", "/~x"),
        ("https://ß.de/", "xn--zca.de", "/"),
        ("https://a。b.com/", "a.b.com", "/"),
        ("https://a．b.com/", "a.b.com", "/"),
        ("https://exa_mple.com/", "exa_mple.com", "/"),
        ("https://a*b.com/", "a*b.com", "/"),
        ("https://a!b.com/", "a!b.com", "/"),
        ("https://a$b.com/", "a$b.com", "/"),
        ("https://a&b.com/", "a&b.com", "/"),
        ("https://a(b).com/", "a(b).com", "/"),
        ("https://a+b.com/", "a+b.com", "/"),
        ("https://a,b.com/", "a,b.com", "/"),
        ("https://a=b.com/", "a=b.com", "/"),
        ("https://a~b.com/", "a~b.com", "/"),
        ("https://a'b.com/", "a'b.com", "/"),
        ("https://a\"b.com/", "a\"b.com", "/"),
        ("https://a`b.com/", "a`b.com", "/"),
        ("https://a{b}.com/", "a{b}.com", "/"),
        ("https://a^b.com/", nil, nil),
        ("https://a|b.com/", nil, nil),
        ("https://a\u{7f}b.com/", nil, nil),
        ("https://Ａ.com/", "a.com", "/"),
        ("https://\u{ad}.com/", ".com", "/"),
        ("https://a\u{200b}b.com/", "ab.com", "/"),
        ("https://xn--abc.com/", "xn--abc.com", "/"),
        ("https://-a.com/", "-a.com", "/"),
        ("HTTPS://visitor!\u{40}Old.Reddit.com:443/r/x/?utm_source=share#c", "old.reddit.com", "/r/x/"),
        ("https://xn--.com/", "xn--.com", "/"),
        ("https://xn--zz-.com/", "xn--zz-.com", "/"),
        ("https://XN--BCHER-KVA.de/", "xn--bcher-kva.de", "/"),
        ("https://xn--bcher-kva.xn--a.de/", "xn--bcher-kva.xn--a.de", "/"),
        ("https://xn--ls8h.la/", "xn--ls8h.la", "/"),
        ("https://xn--a-ecp.ru/", "xn--a-ecp.ru", "/"),
        ("https://xn--55qx5d.cn/", "xn--55qx5d.cn", "/"),
        ("https://a.xn--p1ai/", "a.xn--p1ai", "/"),
        ("https://xn--tda.xn--tda/", "xn--tda.xn--tda", "/"),
        ("https://☃.net/", "xn--n3h.net", "/"),
        ("https://💩.la/", "xn--ls8h.la", "/"),
        ("https://Bücher.example/", "xn--bcher-kva.example", "/"),
        ("https://faß.de/", "xn--fa-hia.de", "/"),
        ("https://ΣΑΣ.gr/", "xn--mxa9ab.gr", "/"),
        ("https://ﬁ.com/", "fi.com", "/"),
        ("https://a\u{200d}b.com/", nil, nil),
        ("https://a\u{200c}b.com/", nil, nil),
        ("https://\u{301}a.com/", nil, nil),
        ("https://a\u{301}.com/", "xn--1ca.com", "/"),
        ("https://日本.jp/", "xn--wgv71a.jp", "/"),
        ("https://例え.テスト/", "xn--r8jz45g.xn--zckzah", "/"),
        ("https://xn--r8jz45g.xn--zckzah/", "xn--r8jz45g.xn--zckzah", "/"),
        ("https://مثال.إختبار/", "xn--mgbh0fb.xn--kgbechtv", "/"),
        ("https://a.b\u{202e}c.com/", nil, nil),
        ("https://a%2Eb.com/", "a.b.com", "/"),
        ("https://a%2eb.com/x", "a.b.com", "/x"),
        ("https://%41.com/", "a.com", "/"),
        ("https://a.com/%2e%2E/x", "a.com", "/x"),
        ("https://a.com/x/%2e", "a.com", "/x/"),
        ("https://a.com/^x", "a.com", "/%5Ex"),
        ("https://a.com/x|y", "a.com", "/x|y"),
        ("https://a.com/x\\y", "a.com", "/x/y"),
        ("https://a.com/\u{a0}x", "a.com", "/%C2%A0x"),
        ("https://a.com/x?y#z", "a.com", "/x"),
        ("https://a.com:0/", "a.com", "/"),
        ("https://a.com:/", "a.com", "/"),
        ("https://a.com:00080/", "a.com", "/"),
        ("https://\u{40}a.com/", "a.com", "/"),
        ("https://a\u{40}/", nil, nil),
        ("https://a:b\u{40}c.com/", "c.com", "/"),
        ("https://[::1]/", nil, nil),
        ("https://1.2.3.4/", nil, nil),
        ("https://0x7f.1/", nil, nil),
        ("https://a.09/", nil, nil),
        ("https://a.0x/", nil, nil),
        ("https://a.08/", nil, nil),
        ("https://example.123/", nil, nil),
        ("https://ex%00ample.com/", nil, nil),
        ("https://exa mple.com/", nil, nil),
        ("https://a.com/\u{2028}", "a.com", "/%E2%80%A8"),
        ("https://ａｂｃ．ｃｏｍ/", "abc.com", "/"),
        ("https://Ⅻ.com/", "xii.com", "/"),
        ("https://x.㍿.com/", "x.xn--6oqv20b1zgzxr.com", "/"),
        ("https://a\u{ad}b.com/", "ab.com", "/"),
        ("https://\u{feff}a.com/", "a.com", "/"),
        ("https://a.com/%F0%9F%98%80", "a.com", "/%F0%9F%98%80"),
        ("https://a.com/%", "a.com", "/%"),
        ("https://a.com/%%41", "a.com", "/%%41"),
        ("http://reddit.com:443/r/x", "reddit.com", "/r/x"),
        ("https://a.com/😀", "a.com", "/%F0%9F%98%80"),
        ("https://ab--cd.com/", "ab--cd.com", "/"),
        ("https://-.com/", "-.com", "/"),
        ("https://a-.com/", "a-.com", "/"),
        ("https://xn--a.com/", "xn--a.com", "/"),
        ("https://xn---.com/", "xn---.com", "/"),
        ("https://xn--ab-.com/", "xn--ab-.com", "/"),
        ("https://xn--Bcher-kva.de/", "xn--bcher-kva.de", "/"),
        ("https://xn--bcher-KVA.de/", "xn--bcher-kva.de", "/"),
        ("https://xn--maana-pta.com/", "xn--maana-pta.com", "/"),
        ("https://xn--mañana.com/", nil, nil),
        ("https://ab.xn--90a.com/", "ab.xn--90a.com", "/"),
        ("https://xn--a.xn--b.com/", "xn--a.xn--b.com", "/"),
        ("https://xn--1ca.com/", "xn--1ca.com", "/"),
        ("https://xn--0ca.com/", "xn--0ca.com", "/"),
        ("https://xn--nxa.com/", "xn--nxa.com", "/"),
        ("https://क्\u{200d}ष.in/m", "xn--11b2ezcw70k.in", "/m"),
        ("https://ᾈ.gr/", "xn--uxa970l.gr", "/"),
        ("https://mixed.xn--a.bücher.de/", nil, nil),
        ("https://xn--1ca.bücher.de/", "xn--1ca.xn--bcher-kva.de", "/"),
    ]

    @Test("parses hostname and pathname like node 24")
    func parsesHostnameAndPathnameLikeNode24() {
        let mismatches = Self.node24.compactMap { text, hostname, pathname -> String? in
            let parsed = WhatwgUrl.parse(text)
            guard parsed?.hostname != hostname || parsed?.pathname != pathname else { return nil }
            return
                "\(text.debugDescription) -> \(String(describing: parsed)), Node 24: \(String(describing: hostname)) "
                + "\(String(describing: pathname))"
        }

        #expect(mismatches.isEmpty, "\(mismatches)")
    }

    @Test("punycode matches rfc 3492 both ways")
    func punycodeMatchesRfc3492BothWays() {
        for (label, encoded) in [("bücher", "bcher-kva"), ("ß", "zca"), ("ü", "tda"), ("日本", "wgv71a")] {
            #expect(Punycode.encode(Array(label.unicodeScalars)) == encoded)
            #expect(Punycode.decode(encoded).map { String(String.UnicodeScalarView($0)) } == label)
        }
        #expect(Punycode.decode("ab-ç") == nil)
        #expect(Punycode.decode("99999999999999999999") == nil)
    }
}
