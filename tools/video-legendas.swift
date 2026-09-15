// Lê as legendas gravadas no vídeo (terço de baixo) a cada 1,5 s com o Vision, em português
import AVFoundation
import Vision
import AppKit
let asset = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.maximumSize = CGSize(width: 720, height: 1280)
gen.requestedTimeToleranceBefore = .zero; gen.requestedTimeToleranceAfter = CMTime(seconds: 0.3, preferredTimescale: 600)
let dur = asset.duration.seconds
var ultimo = ""
var t = 0.5
while t < dur {
  if let img = try? gen.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil) {
    let req = VNRecognizeTextRequest()
    req.recognitionLanguages = ["pt-BR"]; req.recognitionLevel = .accurate; req.usesLanguageCorrection = true
    req.regionOfInterest = CGRect(x: 0.05, y: 0.12, width: 0.9, height: 0.16)
    try? VNImageRequestHandler(cgImage: img).perform([req])
    let linhas = (req.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ")
    if !linhas.isEmpty && linhas != ultimo {
      print(String(format: "%05.1f", t), linhas)
      ultimo = linhas
    }
  }
  t += 1.5
}
