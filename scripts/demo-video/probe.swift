import AVFoundation
import Foundation

guard CommandLine.arguments.count == 2 else { exit(64) }
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let asset = AVURLAsset(url: url)
let duration = CMTimeGetSeconds(try await asset.load(.duration))
let video = try await asset.loadTracks(withMediaType: .video).first
let audio = try await asset.loadTracks(withMediaType: .audio).first
let size = try FileManager.default.attributesOfItem(atPath: url.path)[.size] as? NSNumber

func fourCC(_ code: FourCharCode?) -> String {
    guard let code else { return "missing" }
    let bytes = [24, 16, 8, 0].map { UInt8((code >> FourCharCode($0)) & 0xff) }
    return String(bytes: bytes, encoding: .ascii) ?? String(format: "0x%08x", code)
}

let videoDescriptions = try await video?.load(.formatDescriptions) ?? []
let audioDescriptions = try await audio?.load(.formatDescriptions) ?? []
let videoCodec = videoDescriptions.first.map { CMFormatDescriptionGetMediaSubType($0) }
let audioCodec = audioDescriptions.first.map { CMFormatDescriptionGetMediaSubType($0) }
let naturalSize = try await video?.load(.naturalSize) ?? .zero
let transform = try await video?.load(.preferredTransform) ?? .identity
let displaySize = naturalSize.applying(transform)
let width = Int(abs(displaySize.width).rounded())
let height = Int(abs(displaySize.height).rounded())
let fileBytes = size?.int64Value ?? 0

print("duration_seconds=\(String(format: "%.3f", duration))")
print("video_codec=\(fourCC(videoCodec))")
print("video_size=\(video == nil ? "missing" : "\(width)x\(height)")")
print("audio_codec=\(fourCC(audioCodec))")
print("audio_track=\(audio == nil ? "missing" : "present")")
print("file_bytes=\(fileBytes)")

let validAudioCodecs: Set<String> = ["aac ", "mp4a"]
guard duration.isFinite,
      duration > 0,
      duration <= 180,
      video != nil,
      audio != nil,
      width == 1920,
      height == 1080,
      fourCC(videoCodec) == "avc1",
      validAudioCodecs.contains(fourCC(audioCodec)),
      fileBytes >= 100_000 else {
    fputs("media constraints failed\n", stderr)
    exit(1)
}
