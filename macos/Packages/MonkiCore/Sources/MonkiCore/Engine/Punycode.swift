// SPDX-License-Identifier: AGPL-3.0-or-later

/// Punycode (RFC 3492) of one domain label, the last step of the WHATWG
/// host's domain-to-ASCII. Foundation has no public IDNA API, so both
/// directions are implemented here (decoding only validates `xn--` labels).
enum Punycode {
    private static let base = 36
    private static let tMin = 1
    private static let tMax = 26
    private static let skew = 38
    private static let damp = 700
    private static let initialBias = 72
    private static let initialN = 0x80
    private static let maxCodePoint = 0x10FFFF

    /// The Punycode of a label, without the `xn--` prefix.
    static func encode(_ label: [Unicode.Scalar]) -> String? {
        let input = label.map { Int($0.value) }
        var output = String.UnicodeScalarView()
        for codePoint in input where codePoint < 0x80 {
            output.append(Unicode.Scalar(UInt8(codePoint)))
        }
        let basicCount = output.count
        var handled = basicCount
        if basicCount > 0 { output.append("-") }
        var n = initialN
        var delta = 0
        var bias = initialBias
        while handled < input.count {
            guard let next = input.filter({ $0 >= n }).min() else { return nil }
            let (product, overflow) = (next - n).multipliedReportingOverflow(by: handled + 1)
            guard !overflow, delta <= Int.max - product else { return nil }
            delta += product
            n = next
            for codePoint in input {
                if codePoint < n { delta += 1 }
                if codePoint == n {
                    var q = delta
                    var k = base
                    while true {
                        let t = threshold(k, bias)
                        if q < t { break }
                        output.append(digit(t + (q - t) % (base - t)))
                        q = (q - t) / (base - t)
                        k += base
                    }
                    output.append(digit(q))
                    bias = adapt(delta, points: handled + 1, first: handled == basicCount)
                    delta = 0
                    handled += 1
                }
            }
            delta += 1
            n += 1
        }
        return String(output)
    }

    /// The code points a Punycode label (without `xn--`) stands for, or nil when it is malformed.
    static func decode(_ text: String) -> [Unicode.Scalar]? {
        let scalars = Array(text.unicodeScalars)
        guard scalars.allSatisfy({ $0.isASCII }) else { return nil }
        var output: [Int] = []
        var start = 0
        if let delimiter = scalars.lastIndex(of: "-") {
            output = scalars[..<delimiter].map { Int($0.value) }
            start = delimiter + 1
        }
        var n = initialN
        var i = 0
        var bias = initialBias
        var index = start
        while index < scalars.count {
            let oldI = i
            var weight = 1
            var k = base
            while true {
                guard index < scalars.count, let value = digitValue(scalars[index]) else { return nil }
                index += 1
                let (scaled, overflow) = value.multipliedReportingOverflow(by: weight)
                guard !overflow, i <= Int.max - scaled, i + scaled <= maxCodePoint * (output.count + 1) else {
                    return nil
                }
                i += scaled
                let t = threshold(k, bias)
                if value < t { break }
                let (nextWeight, weightOverflow) = weight.multipliedReportingOverflow(by: base - t)
                guard !weightOverflow else { return nil }
                weight = nextWeight
                k += base
            }
            bias = adapt(i - oldI, points: output.count + 1, first: oldI == 0)
            n += i / (output.count + 1)
            i %= output.count + 1
            guard n <= maxCodePoint else { return nil }
            output.insert(n, at: i)
            i += 1
        }
        var result: [Unicode.Scalar] = []
        for codePoint in output {
            guard let scalar = Unicode.Scalar(UInt32(codePoint)) else { return nil }
            result.append(scalar)
        }
        return result
    }

    private static func threshold(_ k: Int, _ bias: Int) -> Int {
        if k <= bias { return tMin }
        if k >= bias + tMax { return tMax }
        return k - bias
    }

    private static func digit(_ value: Int) -> Unicode.Scalar {
        Unicode.Scalar(UInt8(value < 26 ? 97 + value : 22 + value))
    }

    private static func digitValue(_ scalar: Unicode.Scalar) -> Int? {
        switch scalar {
        case "a"..."z": Int(scalar.value) - 97
        case "A"..."Z": Int(scalar.value) - 65
        case "0"..."9": Int(scalar.value) - 22
        default: nil
        }
    }

    private static func adapt(_ delta: Int, points: Int, first: Bool) -> Int {
        var d = first ? delta / damp : delta / 2
        d += d / points
        var k = 0
        while d > ((base - tMin) * tMax) / 2 {
            d /= base - tMin
            k += base
        }
        return k + (base - tMin + 1) * d / (d + skew)
    }
}
