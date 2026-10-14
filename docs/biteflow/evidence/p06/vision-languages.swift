import Vision
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
print("macOS Vision revision \(request.revision): \(try request.supportedRecognitionLanguages())")
