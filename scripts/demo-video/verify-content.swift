import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count == 2 else {
    fputs("usage: swift verify-content.swift <frame-dir>\n", stderr)
    exit(64)
}

let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
    .filter { $0.pathExtension.lowercased() == "png" && $0.lastPathComponent.first?.isNumber == true }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }

var combinedText = ""

for file in files {
    guard let image = NSImage(contentsOf: file),
          let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        throw NSError(domain: "LeaseFlowVideoVerification", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot load \(file.path)"])
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["ko-KR", "en-US"]
    request.usesLanguageCorrection = true
    try VNImageRequestHandler(cgImage: cgImage).perform([request])
    let text = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
    combinedText += "\n--- \(file.lastPathComponent) ---\n\(text)"
}

let secretPatterns = [
    #"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]{12,}"#,
    #"\bsk-[A-Za-z0-9_-]{16,}"#,
    #"(?i)\b(?:api[_ -]?key|access[_ -]?token|client[_ -]?secret)\b\s*[:=]\s*['\"]?[A-Za-z0-9._~+/=-]{8,}"#,
    #"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----"#,
]

for pattern in secretPatterns {
    if combinedText.range(of: pattern, options: .regularExpression) != nil {
        fputs("generic secret pattern found in captured UI\n", stderr)
        exit(1)
    }
}

var blockedTerms: [String] = []
if let path = ProcessInfo.processInfo.environment["LEASEFLOW_VIDEO_BLOCKED_TERMS_FILE"], !path.isEmpty {
    let contents = try String(contentsOfFile: path, encoding: .utf8)
    blockedTerms += contents.components(separatedBy: .newlines)
}
blockedTerms = blockedTerms.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }

for phrase in blockedTerms where combinedText.localizedCaseInsensitiveContains(phrase) {
    fputs("locally configured blocked term found in captured UI\n", stderr)
    exit(1)
}

guard combinedText.localizedCaseInsensitiveContains("Cobalt") || combinedText.contains("합성") else {
    fputs("expected synthetic demo markers were not recognized\n", stderr)
    exit(1)
}

print("verified_frames=\(files.count)")
print("generic_secret_matches=0")
print("local_blocked_terms=\(blockedTerms.isEmpty ? "not_configured" : "checked_\(blockedTerms.count)")")
print("synthetic_demo_markers=present")
