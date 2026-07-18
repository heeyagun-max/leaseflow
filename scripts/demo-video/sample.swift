import AppKit
import AVFoundation
import Foundation

guard CommandLine.arguments.count == 3 else {
    fputs("usage: swift sample.swift <video.mp4> <output-dir>\n", stderr)
    exit(64)
}

let videoURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputDirectory = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

let asset = AVURLAsset(url: videoURL)
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero

for seconds in [5, 30, 60, 90] {
    let image = try await generator.image(at: CMTime(seconds: Double(seconds), preferredTimescale: 600)).image
    let bitmap = NSBitmapImageRep(cgImage: image)
    guard let data = bitmap.representation(using: .png, properties: [:]) else { exit(1) }
    let output = outputDirectory.appendingPathComponent(String(format: "frame-%03d.png", seconds))
    try data.write(to: output)
}

print("sampled_frames=4")
