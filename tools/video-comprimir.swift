// Comprime o vídeo de montagem para a web: H.264 com taxa de bits controlada + AAC, fast start.
//   swift transcode.swift entrada.mp4 saida.mp4 [kbps_video=1700]
import AVFoundation
let args = CommandLine.arguments
let src = URL(fileURLWithPath: args[1]), dst = URL(fileURLWithPath: args[2])
let kbps = args.count > 3 ? Int(args[3])! : 1700
try? FileManager.default.removeItem(at: dst)
let asset = AVURLAsset(url: src)
let vt = asset.tracks(withMediaType: .video).first!
let at = asset.tracks(withMediaType: .audio).first
let reader = try! AVAssetReader(asset: asset)
let vOut = AVAssetReaderTrackOutput(track: vt, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange])
vOut.alwaysCopiesSampleData = false
reader.add(vOut)
var aOut: AVAssetReaderTrackOutput?
if let at {
  let o = AVAssetReaderTrackOutput(track: at, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM, AVLinearPCMBitDepthKey: 16, AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false, AVLinearPCMIsNonInterleaved: false])
  reader.add(o); aOut = o
}
let writer = try! AVAssetWriter(outputURL: dst, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true
let size = vt.naturalSize
let vIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: Int(size.width), AVVideoHeightKey: Int(size.height),
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: kbps * 1000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel, AVVideoMaxKeyFrameIntervalKey: 60]])
vIn.transform = vt.preferredTransform
writer.add(vIn)
var aIn: AVAssetWriterInput?
if aOut != nil {
  let i = AVAssetWriterInput(mediaType: .audio, outputSettings: [AVFormatIDKey: kAudioFormatMPEG4AAC, AVNumberOfChannelsKey: 2, AVSampleRateKey: 44100, AVEncoderBitRateKey: 128_000])
  writer.add(i); aIn = i
}
guard reader.startReading() else { print("erro leitura", reader.error as Any); exit(1) }
guard writer.startWriting() else { print("erro escrita", writer.error as Any); exit(1) }
writer.startSession(atSourceTime: .zero)
let grupo = DispatchGroup()
func bombear(_ input: AVAssetWriterInput, _ out: AVAssetReaderTrackOutput, _ nome: String) {
  grupo.enter()
  input.requestMediaDataWhenReady(on: DispatchQueue(label: nome)) {
    while input.isReadyForMoreMediaData {
      if reader.status == .reading, let buf = out.copyNextSampleBuffer() { input.append(buf) }
      else { input.markAsFinished(); grupo.leave(); return }
    }
  }
}
bombear(vIn, vOut, "video")
if let aIn, let aOut { bombear(aIn, aOut, "audio") }
grupo.notify(queue: .main) {
  writer.finishWriting {
    print("status", writer.status.rawValue, writer.error?.localizedDescription ?? "ok")
    exit(writer.status == .completed ? 0 : 1)
  }
}
dispatchMain()
