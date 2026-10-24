// SPDX-License-Identifier: AGPL-3.0-or-later

// monki-bridge: the native messaging host the browser extension starts
// (`dev.monkifocus.bridge`). It lives at `MonkiFocus.app/Contents/Helpers/`.
//
// M1 stub: reads framed JSON messages from stdin until the browser closes
// the port and answers each one with `{"type":"app.unavailable"}`. It never
// logs or stores what it reads. A malformed frame ends the process with
// status 1, which the extension sees as a disconnect. The relay to the app's
// Unix socket arrives with work package M5.

import Foundation
import MonkiCore

let input = FileHandle.standardInput
let output = FileHandle.standardOutput

while true {
    let header = input.readData(ofLength: NativeMessageFrame.headerByteCount)
    if header.isEmpty {
        exit(0)
    }
    do {
        let length = try NativeMessageFrame.payloadLength(header: header)
        let payload = input.readData(ofLength: length)
        guard payload.count == length, (try? JSONSerialization.jsonObject(with: payload)) != nil else {
            exit(1)
        }
        try output.write(contentsOf: NativeMessageFrame.encode(BridgeReply.appUnavailable))
    } catch {
        exit(1)
    }
}
