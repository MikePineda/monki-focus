// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// The reference the capture pipeline is checked against, written from the
/// definition rather than from the implementation: a state observed at `t`
/// holds until the next observation, so the stream is a piecewise-constant
/// timeline. Its events are the maximal stretches of one state; a stretch
/// that resumes the previous event's state within pulsetime after a stop
/// joins it (ActivityWatch merge); a zero-length event is replaced by the
/// next one when that starts at the same instant.
enum CaptureModel {
    struct Run {
        var start: Int
        var end: Int
        var data: EventData?
    }

    /// Observation instants as the emitter sees them: never going backwards.
    static func instants(_ offsets: [Int]) -> [Int] {
        var latest = Int.min
        return offsets.map { offset in
            latest = max(latest, offset)
            return latest
        }
    }

    /// The timeline as maximal runs of one state (nil runs are stops).
    static func runs(_ observations: [(Int, EventData?)]) -> [Run] {
        let times = instants(observations.map(\.0))
        var runs: [Run] = []
        for index in observations.indices.dropLast() {
            let segment = Run(start: times[index], end: times[index + 1], data: observations[index].1)
            if let last = runs.last, last.data == segment.data {
                runs[runs.count - 1].end = segment.end
            } else {
                runs.append(segment)
            }
        }
        return runs
    }

    static func events(_ observations: [(Int, EventData?)], pulsetime: Int) -> [ActivityEvent] {
        var events: [Run] = []
        for run in runs(observations) where run.data != nil {
            if let last = events.last, last.data == run.data, run.start <= last.end + pulsetime {
                events[events.count - 1].end = max(last.end, run.end)
                continue
            }
            if let last = events.last, last.start == last.end, last.start == run.start {
                events.removeLast()
            }
            events.append(run)
        }
        return events.compactMap { run in
            run.data.map {
                ActivityEvent(
                    timestamp: utcInstantOf(CaptureSamples.origin + run.start), duration: run.end - run.start, data: $0)
            }
        }
    }

    /// The stopped stretches of the timeline, in epoch seconds.
    static func stops(_ observations: [(Int, EventData?)]) -> [Interval] {
        runs(observations).filter { $0.data == nil }.map {
            Interval(start: CaptureSamples.origin + $0.start, end: CaptureSamples.origin + $0.end)
        }
    }
}
