import AppKit
import AVFoundation
import CoreGraphics
import CoreText
import CoreVideo

struct Shot {
    let image: String
    let title: String
    let caption: String
    let weight: Double
    let cropAnchor: Double
}

let arguments = CommandLine.arguments
guard arguments.count >= 4 else {
    fputs("usage: swift render.swift <frame-dir> <narration.aiff> <output.mp4>\n", stderr)
    exit(64)
}

let frameDirectory = URL(fileURLWithPath: arguments[1], isDirectory: true)
let narrationURL = URL(fileURLWithPath: arguments[2])
let outputURL = URL(fileURLWithPath: arguments[3])
let temporaryVideoURL = outputURL.deletingLastPathComponent().appendingPathComponent(".video-only-\(UUID().uuidString).mp4")
let temporaryFinalURL = outputURL.deletingLastPathComponent().appendingPathComponent(".final-\(UUID().uuidString).mp4")
defer {
    try? FileManager.default.removeItem(at: temporaryVideoURL)
    try? FileManager.default.removeItem(at: temporaryFinalURL)
}

let shots = [
    Shot(image: "01-admin-source-registry.png", title: "들어오는 양식을 자산으로", caption: "원자료 등록 · 분류 · 중복과 버전 관리", weight: 1.1, cropAnchor: 0.72),
    Shot(image: "02-admin-data-steward-review.png", title: "AI 결과는 후보입니다", caption: "데이터 담당자가 출처와 변경안 4건을 확인", weight: 1.0, cropAnchor: 0.35),
    Shot(image: "03-admin-published-v2.png", title: "선임 게시 후 v2만 현재본", caption: "v1은 이력으로 보존하고 외부 사용은 차단", weight: 1.2, cropAnchor: 0.70),
    Shot(image: "04-mobile-package-draft.png", title: "현재 정보로 안내 자료 준비", caption: "200평 · 최신 평면도 v2 · 설정된 수신자", weight: 1.15, cropAnchor: 0.45),
    Shot(image: "05-mobile-human-approved.png", title: "사람 승인 전에는 발송 불가", caption: "실제 이메일이 아닌 샌드박스 발송 기록", weight: 1.0, cropAnchor: 0.55),
    Shot(image: "06-weekly-source-backed-patch.png", title: "근거가 있는 변경만 제안", caption: "앱 활동과 합성 메일을 연결한 주간 보고 패치", weight: 1.15, cropAnchor: 0.52),
    Shot(image: "07-weekly-approved.png", title: "건물별 보고서도 다시 승인", caption: "외부 보고 수신자와 전송 조건은 코드가 통제", weight: 1.0, cropAnchor: 0.55),
    Shot(image: "03-admin-published-v2.png", title: "빠른 AI, 책임 있는 운영", caption: "합성 데이터 · 감사 기록 · 실제 외부 연동 없음", weight: 0.9, cropAnchor: 0.45),
]

for shot in shots {
    let url = frameDirectory.appendingPathComponent(shot.image)
    guard FileManager.default.fileExists(atPath: url.path) else {
        fputs("missing frame: \(url.path)\n", stderr)
        exit(66)
    }
}

let audioAsset = AVURLAsset(url: narrationURL)
let audioDurationTime = try await audioAsset.load(.duration)
let audioDuration = CMTimeGetSeconds(audioDurationTime)
guard audioDuration.isFinite, audioDuration > 1, audioDuration <= 178 else {
    fputs("narration duration must be between 1 and 178 seconds; got \(audioDuration)\n", stderr)
    exit(65)
}

let width = 1920
let height = 1080
let fps: Int32 = 15
let writer = try AVAssetWriter(outputURL: temporaryVideoURL, fileType: .mp4)
let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 4_000_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    ],
])
videoInput.expectsMediaDataInRealTime = false

let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: videoInput,
    sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
    ]
)
guard writer.canAdd(videoInput) else { fatalError("cannot add H.264 input") }
writer.add(videoInput)
guard writer.startWriting() else { throw writer.error ?? NSError(domain: "LeaseFlowVideo", code: 1) }
writer.startSession(atSourceTime: .zero)

let totalWeight = shots.reduce(0) { $0 + $1.weight }
let durations = shots.map { audioDuration * $0.weight / totalWeight }
let images: [CGImage] = try shots.map { shot in
    let imageURL = frameDirectory.appendingPathComponent(shot.image)
    guard let image = NSImage(contentsOf: imageURL),
          let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        throw NSError(domain: "LeaseFlowVideo", code: 2, userInfo: [NSLocalizedDescriptionKey: "cannot decode \(imageURL.path)"])
    }
    return cgImage
}

func drawText(_ text: String, size: CGFloat, weight: NSFont.Weight, color: NSColor, x: CGFloat, y: CGFloat, context: CGContext) {
    let font = NSFont.systemFont(ofSize: size, weight: weight)
    let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color]
    let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attributes))
    context.textPosition = CGPoint(x: x, y: y)
    CTLineDraw(line, context)
}

func makeFrame(image: CGImage, shot: Shot, progress: Double) throws -> CVPixelBuffer {
    var pixelBuffer: CVPixelBuffer?
    let status = CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA, [
        kCVPixelBufferCGImageCompatibilityKey: true,
        kCVPixelBufferCGBitmapContextCompatibilityKey: true,
    ] as CFDictionary, &pixelBuffer)
    guard status == kCVReturnSuccess, let buffer = pixelBuffer else { throw NSError(domain: "LeaseFlowVideo", code: 3) }

    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard let context = CGContext(
        data: CVPixelBufferGetBaseAddress(buffer), width: width, height: height,
        bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
    ) else { throw NSError(domain: "LeaseFlowVideo", code: 4) }

    context.setFillColor(NSColor(calibratedRed: 0.96, green: 0.95, blue: 0.93, alpha: 1).cgColor)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))

    let imageArea = CGRect(x: 48, y: 48, width: 1824, height: 860)
    let scale = max(imageArea.width / CGFloat(image.width), imageArea.height / CGFloat(image.height)) * CGFloat(1.02 + progress * 0.025)
    let drawWidth = CGFloat(image.width) * scale
    let drawHeight = CGFloat(image.height) * scale
    let overflowY = max(0, drawHeight - imageArea.height)
    let anchor = min(1, max(0, shot.cropAnchor + (progress - 0.5) * 0.08))
    let drawRect = CGRect(
        x: imageArea.midX - drawWidth / 2,
        y: imageArea.minY - overflowY * CGFloat(anchor),
        width: drawWidth,
        height: drawHeight
    )
    context.saveGState()
    context.clip(to: imageArea)
    context.interpolationQuality = .high
    context.draw(image, in: drawRect)
    context.restoreGState()

    context.setFillColor(NSColor(calibratedRed: 0.055, green: 0.14, blue: 0.22, alpha: 0.96).cgColor)
    context.fill(CGRect(x: 0, y: 908, width: width, height: 172))
    drawText(shot.title, size: 52, weight: .bold, color: .white, x: 68, y: 1000, context: context)
    drawText(shot.caption, size: 29, weight: .medium, color: NSColor(calibratedWhite: 0.9, alpha: 1), x: 70, y: 946, context: context)
    drawText("LeaseFlow · SYNTHETIC DEMO", size: 22, weight: .semibold, color: NSColor(calibratedRed: 0.46, green: 0.72, blue: 1, alpha: 1), x: 1510, y: 1008, context: context)
    return buffer
}

var frameIndex: Int64 = 0
for (shotIndex, shot) in shots.enumerated() {
    let frameCount = max(1, Int((durations[shotIndex] * Double(fps)).rounded()))
    for localFrame in 0..<frameCount {
        while !videoInput.isReadyForMoreMediaData {
            try await Task.sleep(for: .milliseconds(2))
        }
        let progress = frameCount <= 1 ? 0 : Double(localFrame) / Double(frameCount - 1)
        let buffer = try makeFrame(image: images[shotIndex], shot: shot, progress: progress)
        let time = CMTime(value: frameIndex, timescale: fps)
        guard adaptor.append(buffer, withPresentationTime: time) else {
            throw writer.error ?? NSError(domain: "LeaseFlowVideo", code: 5)
        }
        frameIndex += 1
    }
}

videoInput.markAsFinished()
await writer.finishWriting()
guard writer.status == .completed else { throw writer.error ?? NSError(domain: "LeaseFlowVideo", code: 6) }

let composition = AVMutableComposition()
let videoAsset = AVURLAsset(url: temporaryVideoURL)
guard let sourceVideo = try await videoAsset.loadTracks(withMediaType: .video).first,
      let sourceAudio = try await audioAsset.loadTracks(withMediaType: .audio).first,
      let videoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
      let audioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else {
    throw NSError(domain: "LeaseFlowVideo", code: 7, userInfo: [NSLocalizedDescriptionKey: "missing video or narration track"])
}

let finalDuration = min(try await videoAsset.load(.duration), audioDurationTime)
try videoTrack.insertTimeRange(CMTimeRange(start: .zero, duration: finalDuration), of: sourceVideo, at: .zero)
try audioTrack.insertTimeRange(CMTimeRange(start: .zero, duration: finalDuration), of: sourceAudio, at: .zero)

guard let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
    throw NSError(domain: "LeaseFlowVideo", code: 8)
}
exporter.outputURL = temporaryFinalURL
exporter.outputFileType = .mp4
exporter.shouldOptimizeForNetworkUse = true
try await exporter.export(to: temporaryFinalURL, as: .mp4)

func fourCC(_ code: FourCharCode?) -> String {
    guard let code else { return "missing" }
    let bytes = [24, 16, 8, 0].map { UInt8((code >> FourCharCode($0)) & 0xff) }
    return String(bytes: bytes, encoding: .ascii) ?? String(format: "0x%08x", code)
}

let finalAsset = AVURLAsset(url: temporaryFinalURL)
let verifiedDuration = CMTimeGetSeconds(try await finalAsset.load(.duration))
let verifiedVideo = try await finalAsset.loadTracks(withMediaType: .video).first
let verifiedAudio = try await finalAsset.loadTracks(withMediaType: .audio).first
let videoDescriptions = try await verifiedVideo?.load(.formatDescriptions) ?? []
let audioDescriptions = try await verifiedAudio?.load(.formatDescriptions) ?? []
let videoCodec = videoDescriptions.first.map { CMFormatDescriptionGetMediaSubType($0) }
let audioCodec = audioDescriptions.first.map { CMFormatDescriptionGetMediaSubType($0) }
let naturalSize = try await verifiedVideo?.load(.naturalSize) ?? .zero
let transform = try await verifiedVideo?.load(.preferredTransform) ?? .identity
let displaySize = naturalSize.applying(transform)
let verifiedWidth = Int(abs(displaySize.width).rounded())
let verifiedHeight = Int(abs(displaySize.height).rounded())
let fileBytes = (try FileManager.default.attributesOfItem(atPath: temporaryFinalURL.path)[.size] as? NSNumber)?.int64Value ?? 0

guard verifiedDuration.isFinite,
      verifiedDuration > 0,
      verifiedDuration <= 180,
      verifiedVideo != nil,
      verifiedAudio != nil,
      verifiedWidth == 1920,
      verifiedHeight == 1080,
      fourCC(videoCodec) == "avc1",
      ["aac ", "mp4a"].contains(fourCC(audioCodec)),
      fileBytes >= 100_000 else {
    throw NSError(domain: "LeaseFlowVideo", code: 9, userInfo: [NSLocalizedDescriptionKey: "rendered media failed final validation"])
}

if FileManager.default.fileExists(atPath: outputURL.path) {
    _ = try FileManager.default.replaceItemAt(outputURL, withItemAt: temporaryFinalURL)
} else {
    try FileManager.default.moveItem(at: temporaryFinalURL, to: outputURL)
}

print(String(format: "Rendered %.2f seconds to %@", CMTimeGetSeconds(finalDuration), outputURL.path))
